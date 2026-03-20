import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { sendDiagnosisChat, type DiagnosisChatMessage } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { formatClockTime } from '@/lib/format';

type ChatMessage = DiagnosisChatMessage & {
    id: string;
    createdAt: number;
};

const starterPrompts = [
    '현재 NPU inference 환경 전반 상태를 진단해줘',
    '최근 장애 징후가 있는 파드와 원인을 정리해줘',
    'VictoriaLogs와 Kubernetes 이벤트를 기준으로 위험 신호를 찾아줘',
];

function buildMessageId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkloadPage() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: buildMessageId(),
            role: 'assistant',
            content: '진단이 필요한 내용을 자연어로 입력하면 MCP AI Agent를 통해 Kubernetes, VictoriaLogs, 메트릭 정보를 종합해 답변합니다.',
            createdAt: Date.now(),
        },
    ]);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);

    const diagnosisMutation = useMutation({
        mutationFn: async (payload: { message: string; history: DiagnosisChatMessage[] }) => {
            return sendDiagnosisChat(payload.message, payload.history);
        },
        onSuccess: (data) => {
            setMessages((prev) => [
                ...prev,
                {
                    id: buildMessageId(),
                    role: 'assistant',
                    content: data.reply,
                    createdAt: Date.now(),
                },
            ]);
        },
        onError: (error) => {
            const message = error instanceof Error
                ? error.message
                : 'AI 진단 요청에 실패했습니다. MCP agent 연결 상태를 확인해주세요.';
            setMessages((prev) => [
                ...prev,
                {
                    id: buildMessageId(),
                    role: 'assistant',
                    content: `요청 처리 중 문제가 발생했습니다.\n\n${message}`,
                    createdAt: Date.now(),
                },
            ]);
        },
    });

    useEffect(() => {
        if (!scrollViewportRef.current) return;
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }, [messages, diagnosisMutation.isPending]);

    const submitMessage = (rawMessage: string) => {
        const message = rawMessage.trim();
        if (!message || diagnosisMutation.isPending) return;

        setMessages((prev) => [
            ...prev,
            {
                id: buildMessageId(),
                role: 'user',
                content: message,
                createdAt: Date.now(),
            },
        ]);
        setInput('');
        diagnosisMutation.mutate({
            message,
            history: [],
        });
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
                    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
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
                                    disabled={diagnosisMutation.isPending}
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
                            <p className="text-sm font-bold text-foreground">대화형 장애 진단</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                자연어로 질문하면 AI Agent가 인프라 상태를 진단하고 원인 및 조치 방향을 정리합니다.
                            </p>
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
                                            <div className="whitespace-pre-wrap text-sm leading-6">
                                                {message.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {diagnosisMutation.isPending && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[85%] rounded-2xl border border-border bg-muted/30 px-4 py-3 text-foreground shadow-sm">
                                            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold opacity-80">
                                                AI Agent
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                진단 요청을 처리하는 중입니다...
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
                                            submitMessage(input);
                                        }
                                    }}
                                />
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                        `Shift + Enter`로 줄바꿈, `Enter`로 전송
                                    </p>
                                    <Button
                                        onClick={() => submitMessage(input)}
                                        disabled={diagnosisMutation.isPending || !input.trim()}
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
