import React, { useState } from 'react';
import { Card, Text, Flex, Badge, TabGroup, TabList, Tab } from '@tremor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ReactECharts from 'echarts-for-react';
import { ShieldAlert, Info, AlertTriangle, Filter, Calendar } from 'lucide-react';

export function EventsTab() {
    const [levelFilter, setLevelFilter] = useState("all");
    const [hideTags, setHideTags] = useState(false);

    // Mock data for Event Trend
    const trendOption = {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}:00`), axisTick: { show: false } },
        yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
        series: [{
            name: 'Events',
            type: 'bar',
            barWidth: '60%',
            data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 20)),
            itemStyle: { color: '#3b82f6' }
        }]
    };

    const k8sEvents = [
        { time: '18:27:54', type: 'Warning', reason: 'BackOff', object: 'pod/order-service-923', msg: 'Back-off restarting failed container', node: 'node-0' },
        { time: '18:24:41', type: 'Normal', reason: 'Pulled', object: 'pod/auth-service-441', msg: 'Container image already present', node: 'node-2' },
        { time: '17:10:12', type: 'Warning', reason: 'FailedScheduling', object: 'pod/gpu-job-55', msg: '0/8 nodes available: 8 Insufficient nvidia.com/gpu', node: 'cluster' },
    ];

    const filteredEvents = k8sEvents.filter(evt => {
        if (levelFilter === "warning" && evt.type !== "Warning") return false;
        if (levelFilter === "critical" && evt.type !== "Critical") return false;
        return true;
    });

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-border shadow-sm">
                <Text className="font-bold">Kubernetes 이벤트</Text>

                <div className="flex gap-3">
                    <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md border border-border">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">최근 1일</span>
                    </div>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                        <SelectTrigger className="w-32 h-9">
                            <SelectValue placeholder="레벨" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체 레벨</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="h-48 p-4 shrink-0 flex flex-col">
                <Flex className="mb-2">
                    <Text className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">이벤트 발생 추이 (건수)</Text>
                </Flex>
                <div className="flex-1">
                    <ReactECharts option={trendOption} style={{ height: '120px' }} />
                </div>
            </Card>

            <div className="flex-1 overflow-hidden border border-border rounded-lg bg-card shadow-sm flex flex-col">
                <div className="p-3 border-b border-border bg-muted/30 flex justify-between">
                    <Text className="text-sm font-bold flex items-center gap-2">
                        <Filter className="w-4 h-4" /> 이벤트 기록 목록
                    </Text>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded" checked={hideTags} onChange={(e) => setHideTags(e.target.checked)} />
                            <span className="text-xs">태그 숨기기</span>
                        </label>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {filteredEvents.map((evt, i) => (
                        <div key={i} className="p-3 hover:bg-muted/50 transition-colors flex items-start gap-4 group">
                            <div className={`w-1 h-12 shrink-0 rounded-full ${evt.type === 'Warning' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge size="xs" color={evt.type === 'Warning' ? 'amber' : 'gray'} className="px-1 py-0 h-4">
                                        {evt.type}
                                    </Badge>
                                    <span className="text-xs font-bold text-foreground font-mono">{evt.time}</span>
                                    {!hideTags && <span className="text-xs text-blue-600 font-bold">[{evt.reason}]</span>}
                                </div>
                                <p className="text-xs font-medium text-foreground truncate">{evt.object}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
                                    {evt.msg}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded border border-border">
                                    {evt.node}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
