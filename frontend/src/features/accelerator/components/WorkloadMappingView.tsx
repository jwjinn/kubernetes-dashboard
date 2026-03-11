import { Card, Text, Metric } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuWorkloadMapping } from '@/api';
import { Search } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export function WorkloadMappingView() {
    const { data: workloadData, isLoading } = useQuery({
        queryKey: ['npuWorkloadMapping'],
        queryFn: fetchNpuWorkloadMapping,
        refetchInterval: 10000
    });

    const podMappings = workloadData?.podMappings || [];
    const contexts = workloadData?.contexts || [];

    // Simple bar chart to visualize pod requirements
    const podChartOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', name: 'NPU Count' },
        yAxis: { 
            type: 'category', 
            data: podMappings.map((p: any) => p.podName.replace('rbln-pytorch-pod-', '')),
            axisLabel: { width: 120, overflow: 'truncate' }
        },
        series: [
            {
                name: 'Allocated Devices',
                type: 'bar',
                stack: 'total',
                label: { show: true },
                emphasis: { focus: 'series' },
                itemStyle: { color: '#059669' },
                data: podMappings.map((p: any) => p.requested)
            }
        ],
        dataZoom: [
            { type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseWheel: true, start: 0, end: podMappings.length > 5 ? (5 / podMappings.length) * 100 : 100 }
        ]
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Workload charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="col-span-1 lg:col-span-2 p-0 border-border shadow-sm flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center">
                        <h3 className="font-bold text-sm">파드별 NPU 요청량 (Pod Allocation Volume)</h3>
                        <InfoTooltip content="각 파드가 쿠버네티스 스펙상(resources.requests) 몇 개의 NPU를 요구하고 할당받았는지 보여주는 Bar 차트입니다." />
                    </div>
                    <div className="p-4 flex-1 h-[300px]">
                        {isLoading ? (
                            <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading allocation chart...</div>
                        ) : (
                            <ReactECharts option={podChartOption} style={{ height: '100%', width: '100%' }} />
                        )}
                    </div>
                </Card>

                <Card className="p-4 border-border shadow-sm flex flex-col justify-center space-y-6">
                    <div>
                        <div className="flex items-center mb-1">
                            <Text className="font-bold text-foreground">활성 파드 맵핑 (Active Pods)</Text>
                            <InfoTooltip content="현재 NPU를 할당받아 점유하고 있는 파드의 총 개수입니다." />
                        </div>
                        <Metric className="text-4xl font-black text-green-500">{podMappings.length}</Metric>
                        <Text className="text-xs text-muted-foreground mt-2">Pods requesting NPU resources</Text>
                    </div>
                    <div className="w-full h-px bg-border"></div>
                    <div>
                        <div className="flex items-center mb-1">
                            <Text className="font-bold text-foreground">구동 중인 NPU 프로세스</Text>
                            <InfoTooltip content="rbln-smi 로그를 통해 추적가능한 현재 작동 중인 AI 프로세스(PID)의 수입니다. 파드는 삭제되었지만 프로세스가 남은 '좀비 프로세스' 여부를 교차 검증할 수 있습니다." />
                        </div>
                        <Metric className="text-4xl font-black text-foreground">{contexts.length}</Metric>
                        <Text className="text-xs text-muted-foreground mt-2">Identified via rbln-smi context</Text>
                    </div>
                </Card>
            </div>

            {/* Pod Mapping Table */}
            <Card className="overflow-hidden p-0 border-border shadow-sm">
                <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                    <div className="flex items-center">
                        <h3 className="font-bold text-sm">파드 ↔ K8s 호스트 노드 매핑 현황</h3>
                        <InfoTooltip content="Kubernetes API의 Pod 스펙 정보와 할당받은 NPU 호스트 정보를 조인(Join)하여, 어떤 파드가 어느 노드에서 몇 개의 NPU를 사용 중인지 명확하게 나열합니다." />
                    </div>
                    <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">From Kubernetes API</span>
                </div>
                <div className="w-full max-h-[400px] overflow-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-bold">Pod Name</th>
                                <th className="px-4 py-3 font-bold">Node</th>
                                <th className="px-4 py-3 font-bold text-center">Req NPU Count</th>
                                <th className="px-4 py-3 font-bold">Allocated Devices</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                            ) : (
                                podMappings.map((mapping: any) => (
                                    <tr key={mapping.podName} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">{mapping.podName}</td>
                                        <td className="px-4 py-3 font-mono text-muted-foreground">{mapping.node}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 font-bold text-xs">
                                                {mapping.requested}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5 flex-wrap">
                                                {mapping.devices.map((d: string) => (
                                                    <span key={d} className="px-2 py-0.5 text-xs bg-muted border border-border rounded-md font-mono text-muted-foreground">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Process Context Table */}
            <Card className="overflow-hidden p-0 border-border shadow-sm">
                <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                        <div className="flex items-center">
                            <h3 className="font-bold text-sm">NPU 프로세스 상세 컨텍스트 정보 (rbln-smi)</h3>
                            <InfoTooltip content="워커 노드별 물리 NPU 칩(deviceIdx) 내부에서 실제로 동작 중인 프로세스의 PID, 상태, 메모리 할당량(Memalloc)을 나타냅니다. 파드 레벨에서는 알 수 없는 디바이스의 세부 상태를 진단할 때 필수적인 창입니다." />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Real-time driver context extracted from rbln-smi on hosts.</p>
                    </div>
                </div>
                <div className="w-full max-h-[400px] overflow-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-bold">Node</th>
                                <th className="px-4 py-3 font-bold">Device</th>
                                <th className="px-4 py-3 font-bold">PID</th>
                                <th className="px-4 py-3 font-bold">Process</th>
                                <th className="px-4 py-3 font-bold">Priority</th>
                                <th className="px-4 py-3 font-bold">Status</th>
                                <th className="px-4 py-3 font-bold text-right">Memalloc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                            ) : contexts.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No active NPU processes found.</td></tr>
                            ) : (
                                contexts.map((ctx: any, idx: number) => (
                                    <tr key={`${ctx.pid}-${idx}`} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-muted-foreground">{ctx.node}</td>
                                        <td className="px-4 py-3 font-mono text-foreground font-medium">{ctx.deviceIdx}</td>
                                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">{ctx.pid}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                {ctx.processName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{ctx.priority}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{ctx.status}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{ctx.memalloc}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
