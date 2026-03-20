import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchK8sEvents, type K8sEvent } from '@/api';
import { Badge } from '@tremor/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PodEventsTabProps {
    namespace?: string;
    podName: string;
}

export function PodEventsTab({ namespace, podName }: PodEventsTabProps) {
    const { data: podEvents = [], isLoading } = useQuery<K8sEvent[]>({
        queryKey: ['k8sEvents', namespace, podName],
        queryFn: () => fetchK8sEvents({ namespace, podName }),
        enabled: !!podName,
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center animate-pulse text-muted-foreground text-sm">
                이벤트 스트림을 불러오는 중입니다...
            </div>
        );
    }

    if (podEvents.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-2">
                <Info className="w-8 h-8 opacity-20" />
                <p className="text-sm italic">이 Pod에서 표시할 이벤트가 없습니다.</p>
                <p className="text-xs text-center text-muted-foreground">기본 Kubernetes 이벤트 TTL은 보통 1시간이라, 오래된 Pod는 이벤트가 남아 있지 않을 수 있습니다.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
                {podEvents.map((event, idx) => (
                    <div key={event.id} className="relative pl-6 pb-4 group last:pb-0">
                        {/* Timeline Line */}
                        {idx !== podEvents.length - 1 && (
                            <div className="absolute left-[9px] top-5 bottom-0 w-[1px] bg-border group-hover:bg-primary/30 transition-colors" />
                        )}

                        {/* Timeline Dot/Icon */}
                        <div className={cn(
                            "absolute left-0 top-1 w-5 h-5 rounded-full border-2 bg-background flex items-center justify-center z-10",
                            event.type === 'Warning' ? "border-amber-500 text-amber-500" :
                                event.type === 'Failed' ? "border-red-500 text-red-500" : "border-emerald-500 text-emerald-500"
                        )}>
                            {event.type === 'Warning' ? <AlertCircle className="w-3 h-3" /> :
                                event.type === 'Failed' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        </div>

                        <div className="bg-muted/30 hover:bg-muted/50 transition-colors rounded-lg p-3 border border-border/50">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <Badge size="xs" color={event.type === 'Warning' ? 'amber' : event.type === 'Failed' ? 'red' : 'emerald'}>
                                        {event.reason}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {new Date(event.lastTimestamp).toLocaleString()}
                                    </span>
                                </div>
                                {event.count > 1 && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                        x{event.count}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs leading-relaxed text-foreground font-medium">
                                {event.message}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
