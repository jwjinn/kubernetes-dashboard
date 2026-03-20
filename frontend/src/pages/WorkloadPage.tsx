import React, { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import {
    streamDiagnosisChat,
    type DiagnosisChatMessage,
    type DiagnosisNodeEvent,
    type DiagnosisNodeStatus,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, LoaderCircle, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { formatClockTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type ChatMessage = DiagnosisChatMessage & {
    id: string;
    createdAt: number;
};

type NodeStatusMap = Record<string, DiagnosisNodeStatus | string>;
type NodeErrorMap = Record<string, string | undefined>;

const starterPrompts = [
    '현재 NPU inference 환경 전반 상태를 진단해줘',
    '최근 장애 징후가 있는 파드와 원인을 정리해줘',
    'VictoriaLogs와 Kubernetes 이벤트를 기준으로 위험 신호를 찾아줘',
];

function buildMessageId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const diagnosisNodes = [
    'start',
    'router',
    'simple_agent',
    'orchestrator',
    'worker_k8s',
    'worker_metric',
    'worker_log',
    'synthesizer',
    'agent',
    'end',
] as const;

const buildIdleNodeStatusMap = (): NodeStatusMap => ({
    start: 'idle',
    router: 'idle',
    simple_agent: 'idle',
    orchestrator: 'idle',
    worker_k8s: 'idle',
    worker_metric: 'idle',
    worker_log: 'idle',
    synthesizer: 'idle',
    agent: 'idle',
    end: 'idle',
});

const buildInitialStreamingNodeStatusMap = (): NodeStatusMap => ({
    ...buildIdleNodeStatusMap(),
    start: 'success',
    router: 'running',
});

function getNodeLabel(nodeId: string) {
    switch (nodeId) {
        case 'start':
            return '시작';
        case 'router':
            return '라우터';
        case 'simple_agent':
            return '단일 응답';
        case 'orchestrator':
            return '오케스트레이터';
        case 'worker_k8s':
            return 'Kubernetes';
        case 'worker_metric':
            return '메트릭';
        case 'worker_log':
            return '로그';
        case 'synthesizer':
            return '종합';
        case 'agent':
            return '에이전트';
        case 'end':
            return '완료';
        default:
            return nodeId;
    }
}

function nodeStatusClass(status: DiagnosisNodeStatus | string | undefined) {
    switch (status) {
        case 'running':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'success':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'error':
            return 'border-rose-200 bg-rose-50 text-rose-700';
        default:
            return 'border-border bg-background/70 text-muted-foreground';
    }
}

function renderInlineMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`${part}-${index}`} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
}

function MarkdownMessage({ content }: { content: string }) {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const elements: React.ReactNode[] = [];
    let bulletItems: string[] = [];
    let orderedItems: string[] = [];
    let paragraphLines: string[] = [];

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        elements.push(
            <p key={`p-${elements.length}`} className="whitespace-pre-wrap leading-6">
                {renderInlineMarkdown(paragraphLines.join(' '))}
            </p>,
        );
        paragraphLines = [];
    };

    const flushBullets = () => {
        if (bulletItems.length === 0) return;
        elements.push(
            <ul key={`ul-${elements.length}`} className="list-disc space-y-1 pl-5">
                {bulletItems.map((item, index) => (
                    <li key={`ul-item-${index}`}>{renderInlineMarkdown(item)}</li>
                ))}
            </ul>,
        );
        bulletItems = [];
    };

    const flushOrdered = () => {
        if (orderedItems.length === 0) return;
        elements.push(
            <ol key={`ol-${elements.length}`} className="list-decimal space-y-1 pl-5">
                {orderedItems.map((item, index) => (
                    <li key={`ol-item-${index}`}>{renderInlineMarkdown(item)}</li>
                ))}
            </ol>,
        );
        orderedItems = [];
    };

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            flushBullets();
            flushOrdered();
            return;
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            flushParagraph();
            flushBullets();
            flushOrdered();

            const level = heading[1].length;
            const text = heading[2];
            const className = level <= 2
                ? 'text-base font-semibold'
                : 'text-sm font-semibold';
            elements.push(
                <div key={`h-${elements.length}`} className={className}>
                    {renderInlineMarkdown(text)}
                </div>,
            );
            return;
        }

        const bullet = trimmed.match(/^[-*]\s+(.*)$/);
        if (bullet) {
            flushParagraph();
            flushOrdered();
            bulletItems.push(bullet[1]);
            return;
        }

        const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
        if (ordered) {
            flushParagraph();
            flushBullets();
            orderedItems.push(ordered[1]);
            return;
        }

        paragraphLines.push(trimmed);
    });

    flushParagraph();
    flushBullets();
    flushOrdered();

    return <div className="space-y-3 text-sm leading-6">{elements}</div>;
}

export default function WorkloadPage() {
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [nodeStatusMap, setNodeStatusMap] = useState<NodeStatusMap>(buildIdleNodeStatusMap);
    const [nodeErrorMap, setNodeErrorMap] = useState<NodeErrorMap>({});
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: buildMessageId(),
            role: 'assistant',
            content: '진단이 필요한 내용을 자연어로 입력하면 MCP AI Agent를 통해 Kubernetes, VictoriaLogs, 메트릭 정보를 종합해 답변합니다.',
            createdAt: Date.now(),
        },
    ]);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!scrollViewportRef.current) return;
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }, [messages, isStreaming]);

    useEffect(() => () => {
        abortControllerRef.current?.abort();
    }, []);

    const updateNodeStatus = (event: DiagnosisNodeEvent) => {
        setNodeStatusMap((prev) => ({
            ...prev,
            [event.nodeId]: event.status,
        }));
        setNodeErrorMap((prev) => ({
            ...prev,
            [event.nodeId]: event.error,
        }));
    };

    const updateAssistantMessage = (assistantId: string, updater: (content: string) => string) => {
        setMessages((prev) => prev.map((message) => (
            message.id === assistantId
                ? { ...message, content: updater(message.content) }
                : message
        )));
    };

    const submitMessage = async (rawMessage: string) => {
        const message = rawMessage.trim();
        if (!message || isStreaming) return;

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userMessage: ChatMessage = {
            id: buildMessageId(),
            role: 'user',
            content: message,
            createdAt: Date.now(),
        };
        const assistantId = buildMessageId();
        const assistantPlaceholder: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: Date.now(),
        };

        setNodeStatusMap(buildInitialStreamingNodeStatusMap());
        setNodeErrorMap({});
        setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
        setInput('');
        setIsStreaming(true);

        try {
            await streamDiagnosisChat(message, {
                onNodeStatus: (event) => {
                    updateNodeStatus(event);
                },
                onToken: (token) => {
                    updateAssistantMessage(assistantId, (content) => `${content}${token}`);
                },
                onDone: () => {},
            }, controller.signal);

            setMessages((prev) => prev.map((entry) => (
                entry.id === assistantId && !entry.content.trim()
                    ? { ...entry, content: '응답이 비어 있습니다.' }
                    : entry
            )));
        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'AI 진단 요청에 실패했습니다. MCP agent 연결 상태를 확인해주세요.';
            updateAssistantMessage(assistantId, (content) => (
                content.trim()
                    ? `${content}\n\n요청 처리 중 문제가 발생했습니다.\n${errorMessage}`
                    : `요청 처리 중 문제가 발생했습니다.\n\n${errorMessage}`
            ));
            setNodeStatusMap((prev) => ({
                ...prev,
                agent: 'error',
                end: 'error',
            }));
            setNodeErrorMap((prev) => ({
                ...prev,
                agent: errorMessage,
                end: errorMessage,
            }));
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <DashboardLayout>
            <div className="flex h-[calc(100vh-140px)] flex-col gap-4 animate-in fade-in duration-500">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-primary" />
                            <h2 className="text-2xl font-bold tracking-tight">장애 진단 AI Assistant</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            MCP AI Agent와 연동해 Kubernetes, VictoriaLogs, 메트릭 정보를 바탕으로 장애 원인과 대응 방향을 대화형으로 진단합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1 px-3 py-1">
                            <Bot className="h-3.5 w-3.5" />
                            MCP Agent 연결
                        </Badge>
                        <Badge variant="secondary" className="gap-1 px-3 py-1">
                            <Sparkles className="h-3.5 w-3.5" />
                            Chat Diagnosis
                        </Badge>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="hidden flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm xl:flex">
                        <div>
                            <p className="text-sm font-bold text-foreground">추천 질문</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                자주 쓰는 진단 프롬프트를 바로 보낼 수 있습니다.
                            </p>
                        </div>

                        <div className="space-y-2">
                            {starterPrompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => submitMessage(prompt)}
                                    disabled={isStreaming}
                                    className="w-full rounded-lg border border-border bg-muted/30 p-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                            <p className="font-semibold text-foreground">안내</p>
                            <p className="mt-2 leading-5">
                                답변은 백엔드 프록시를 통해 MCP agent pod로 전달됩니다. 질의 내용에 따라 Kubernetes 상태, 로그, 메트릭 결과를 종합해 서술형으로 응답합니다.
                            </p>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
                        <div className="border-b border-border px-5 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <LoaderCircle className={cn('h-4 w-4', isStreaming && 'animate-spin')} />
                                    진행 상황
                                </div>
                                <Badge variant="outline" className="w-fit">
                                    {isStreaming ? '스트리밍 수신 중' : '대기 중'}
                                </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 xl:hidden">
                                {starterPrompts.map((prompt) => (
                                    <button
                                        key={`compact-${prompt}`}
                                        onClick={() => submitMessage(prompt)}
                                        disabled={isStreaming}
                                        className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-3">
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                    {diagnosisNodes.map((nodeId) => (
                                        <div
                                            key={nodeId}
                                            className={cn(
                                                'rounded-lg border px-2.5 py-2 text-[11px]',
                                                nodeStatusClass(nodeStatusMap[nodeId]),
                                            )}
                                        >
                                            <div className="font-medium leading-4">{getNodeLabel(nodeId)}</div>
                                            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
                                                {nodeStatusMap[nodeId] || 'idle'}
                                            </div>
                                            {nodeErrorMap[nodeId] && (
                                                <div className="mt-1 line-clamp-2 text-[10px] normal-case tracking-normal opacity-80">
                                                    {nodeErrorMap[nodeId]}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <ScrollArea className="min-h-0 flex-1">
                            <div
                                ref={(node) => {
                                    scrollViewportRef.current = node;
                                }}
                                className="space-y-4 p-5"
                            >
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                                            message.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'border border-border bg-muted/30 text-foreground'
                                        }`}>
                                            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold opacity-80">
                                                {message.role === 'user' ? '사용자' : 'AI Agent'}
                                                <span>{formatClockTime(message.createdAt)}</span>
                                            </div>
                                            {message.role === 'assistant'
                                                ? <MarkdownMessage content={message.content} />
                                                : (
                                                    <div className="whitespace-pre-wrap text-sm leading-6">
                                                        {message.content}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                ))}

                                {isStreaming && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[85%] rounded-2xl border border-border bg-muted/30 px-4 py-3 text-foreground shadow-sm">
                                            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold opacity-80">
                                                AI Agent
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                응답을 스트리밍으로 받아오는 중입니다...
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="border-t border-border p-4">
                            <div className="rounded-xl border border-border bg-background p-3">
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="예: 현재 NPU inference 환경 전반 상태를 진단해줘"
                                    className="min-h-[96px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void submitMessage(input);
                                        }
                                    }}
                                />
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                        `Shift + Enter`로 줄바꿈, `Enter`로 전송
                                    </p>
                                    <Button
                                        onClick={() => void submitMessage(input)}
                                        disabled={isStreaming || !input.trim()}
                                        className="gap-2"
                                    >
                                        <Send className="h-4 w-4" />
                                        전송
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
