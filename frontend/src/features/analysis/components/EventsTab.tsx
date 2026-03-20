import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchK8sEvents, type K8sEvent } from '@/api';
import { Badge, Text } from '@tremor/react';
import { Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventsTabProps {
    namespace?: string | null;
    podName?: string | null;
}

export function EventsTab({ namespace, podName }: EventsTabProps) {
    const [levelFilter, setLevelFilter] = useState('all');

    const { data: events = [], isLoading } = useQuery<K8sEvent[]>({
        queryKey: ['analysisEvents', namespace, podName],
        queryFn: () => fetchK8sEvents({
            namespace: namespace || undefined,
            podName: podName || undefined,
        }),
        enabled: !!podName,
        refetchInterval: 15000,
    });

    const filteredEvents = useMemo(() => {
        return events.filter((evt) => {
            if (levelFilter === 'warning') return evt.type === 'Warning';
            if (levelFilter === 'normal') return evt.type === 'Normal';
            return true;
        });
    }, [events, levelFilter]);

    if (!podName) {
        return (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-muted-foreground">
                대상을 선택해주세요.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm">
                <div>
                    <Text className="font-bold">Kubernetes 이벤트</Text>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {namespace}/{podName} 이벤트 기록
                    </p>
                </div>

                <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="h-9 w-32">
                        <SelectValue placeholder="레벨" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 레벨</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                기본 Kubernetes 이벤트 보존 기간은 보통 1시간입니다. 오래된 Pod는 이벤트가 없어 보일 수 있습니다.
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-muted/30 p-3">
                    <Text className="text-sm font-bold">이벤트 기록 목록</Text>
                </div>

                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
                        이벤트를 불러오는 중입니다...
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Info className="h-8 w-8 opacity-20" />
                        <p className="text-sm italic">이 Pod에서 표시할 이벤트가 없습니다.</p>
                        <p className="text-xs text-muted-foreground">기본 Kubernetes 이벤트 TTL은 보통 1시간이라, 오래된 Pod는 이벤트가 비어 보일 수 있습니다.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4 p-4">
                            {filteredEvents.map((event, idx) => (
                                <div key={event.id} className="relative pl-6 pb-4 last:pb-0">
                                    {idx !== filteredEvents.length - 1 && (
                                        <div className="absolute bottom-0 left-[9px] top-5 w-[1px] bg-border" />
                                    )}

                                    <div className={cn(
                                        "absolute left-0 top-1 h-5 w-5 rounded-full border-2 bg-background",
                                        event.type === 'Warning'
                                            ? 'border-amber-500'
                                            : 'border-emerald-500'
                                    )} />

                                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                                        <div className="mb-1 flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge size="xs" color={event.type === 'Warning' ? 'amber' : 'emerald'}>
                                                    {event.reason}
                                                </Badge>
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(event.lastTimestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            {event.count > 1 && (
                                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                                    x{event.count}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-medium text-foreground">{event.object}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.message}</p>
                                        <div className="mt-2 text-[10px] text-muted-foreground">
                                            From: {event.component || '-'} {event.node ? `· Node: ${event.node}` : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
