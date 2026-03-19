import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Text, Flex, Badge } from '@tremor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactECharts from 'echarts-for-react';
import { Info, Filter, Calendar } from 'lucide-react';
import { fetchK8sEvents, type K8sEvent } from '@/api';

interface EventsTabProps {
    namespace?: string | null;
    podName?: string | null;
}

export function EventsTab({ namespace, podName }: EventsTabProps) {
    const [levelFilter, setLevelFilter] = useState('all');
    const [hideTags, setHideTags] = useState(false);

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
            if (levelFilter === 'warning' && evt.type !== 'Warning') return false;
            if (levelFilter === 'normal' && evt.type !== 'Normal') return false;
            return true;
        });
    }, [events, levelFilter]);

    const trendBuckets = useMemo(() => {
        const now = new Date();
        const labels: string[] = [];
        const counts = new Array(24).fill(0);

        for (let offset = 23; offset >= 0; offset--) {
            const bucket = new Date(now.getTime() - offset * 60 * 60 * 1000);
            labels.push(`${bucket.getHours()}:00`);
        }

        events.forEach((event) => {
            const eventTime = new Date(event.lastTimestamp);
            const diffHours = Math.floor((now.getTime() - eventTime.getTime()) / (60 * 60 * 1000));
            if (diffHours >= 0 && diffHours < 24) {
                counts[23 - diffHours] += Math.max(event.count || 1, 1);
            }
        });

        return { labels, counts };
    }, [events]);

    const trendOption = {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: { type: 'category', data: trendBuckets.labels, axisTick: { show: false } },
        yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
        series: [{
            name: 'Events',
            type: 'bar',
            barWidth: '60%',
            data: trendBuckets.counts,
            itemStyle: { color: '#3b82f6' }
        }]
    };

    if (!podName) {
        return (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-muted-foreground">
                대상을 선택해주세요.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col space-y-4 overflow-hidden">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm">
                <div>
                    <Text className="font-bold">Kubernetes 이벤트</Text>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {namespace}/{podName} 최근 이벤트
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">최근 1일</span>
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
            </div>

            <Card className="flex h-48 shrink-0 flex-col p-4">
                <Flex className="mb-2">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">이벤트 발생 추이 (건수)</Text>
                </Flex>
                <div className="flex-1">
                    <ReactECharts option={trendOption} style={{ height: '120px' }} />
                </div>
            </Card>

            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex justify-between border-b border-border bg-muted/30 p-3">
                    <Text className="flex items-center gap-2 text-sm font-bold">
                        <Filter className="h-4 w-4" /> 이벤트 기록 목록
                    </Text>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" className="rounded" checked={hideTags} onChange={(e) => setHideTags(e.target.checked)} />
                        <span className="text-xs">태그 숨기기</span>
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
                            Loading events...
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Info className="h-8 w-8 opacity-20" />
                            <p className="text-sm italic">No recent events for this pod.</p>
                        </div>
                    ) : (
                        filteredEvents.map((evt) => (
                            <div key={evt.id} className="group flex items-start gap-4 p-3 transition-colors hover:bg-muted/50">
                                <div className={`h-12 w-1 shrink-0 rounded-full ${evt.type === 'Warning' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                        <Badge size="xs" color={evt.type === 'Warning' ? 'amber' : 'gray'} className="h-4 px-1 py-0">
                                            {evt.type}
                                        </Badge>
                                        <span className="font-mono text-xs font-bold text-foreground">
                                            {new Date(evt.lastTimestamp).toLocaleTimeString()}
                                        </span>
                                        {!hideTags && <span className="text-xs font-bold text-blue-600">[{evt.reason}]</span>}
                                    </div>
                                    <p className="truncate text-xs font-medium text-foreground">{evt.object}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground transition-all line-clamp-1 group-hover:line-clamp-none">
                                        {evt.message}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                        {evt.node || evt.component || '-'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
