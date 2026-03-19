import { Card, Text, Metric } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuWorkloadMapping, type NpuProcessContext } from '@/api';
import { Search } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export function WorkloadMappingView() {
    const { data: workloadData, isLoading } = useQuery({
        queryKey: ['npuWorkloadMapping'],
        queryFn: fetchNpuWorkloadMapping,
        refetchInterval: 10000
    });

    const podMappings = workloadData?.podMappings || [];
    const contexts = (workloadData?.contexts || []) as NpuProcessContext[];

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
                name: 'Requested NPU',
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
                            <InfoTooltip content="현재 Kubernetes 스펙상 NPU requests가 설정된 파드의 총 개수입니다." />
                        </div>
                        <Metric className="text-4xl font-black text-green-500">{podMappings.length}</Metric>
                        <Text className="text-xs text-muted-foreground mt-2">Pods with NPU requests in spec</Text>
                    </div>
                    <div className="w-full h-px bg-border"></div>
                    <div>
                        <div className="flex items-center mb-1">
                            <Text className="font-bold text-foreground">구동 중인 NPU 프로세스</Text>
                            <InfoTooltip content="실제 PID를 직접 수집하는 표가 아니라, 장치 telemetry 상에서 메모리 점유나 사용률이 관측된 NPU device row 수를 요약한 값입니다." />
                        </div>
                        <Metric className="text-4xl font-black text-foreground">{contexts.length}</Metric>
                        <Text className="text-xs text-muted-foreground mt-2">Telemetry-observed active device rows</Text>
                    </div>
                </Card>
            </div>

            {/* Pod Mapping Table */}
            <Card className="overflow-hidden p-0 border-border shadow-sm">
                <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                    <div className="flex items-center">
                        <h3 className="font-bold text-sm">파드 ↔ K8s 호스트 노드 매핑 현황</h3>
                        <InfoTooltip content="Kubernetes API의 Pod 스펙과 스케줄링 정보를 기준으로, 어떤 파드가 어느 노드에 배치되었고 몇 개의 NPU를 요청했는지 보여줍니다. 개별 디바이스 이름과의 직접 매핑은 현재 telemetry만으로는 확정할 수 없습니다." />
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
                                <th className="px-4 py-3 font-bold">Allocation Source</th>
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
                                            <span className="px-2 py-1 text-xs bg-muted border border-border rounded-md text-muted-foreground">
                                                Kubernetes Pod request ({mapping.requested})
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Device Context Table */}
            <Card className="overflow-hidden p-0 border-border shadow-sm">
                <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                        <div className="flex items-center">
                            <h3 className="font-bold text-sm">NPU 프로세스 상세 컨텍스트 정보 (rbln-smi)</h3>
                            <InfoTooltip content="Pod나 컨테이너 매핑 추정 없이, exporter telemetry에서 실제로 관측되는 NPU 장치 상태만 단순하게 보여줍니다. 상태(Status)는 장치 telemetry 기준이며 `연산 중` 또는 `메모리 점유` 값을 가질 수 있습니다." />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Telemetry-based NPU device rows observed from exporter metrics.</p>
                    </div>
                </div>
                <div className="w-full max-h-[400px] overflow-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-bold">Node</th>
                                <th className="px-4 py-3 font-bold">Device</th>
                                <th className="px-4 py-3 font-bold">Status</th>
                                <th className="px-4 py-3 font-bold text-right">Memory Usage</th>
                                <th className="px-4 py-3 font-bold text-right">Util</th>
                                <th className="px-4 py-3 font-bold text-right">Temp</th>
                                <th className="px-4 py-3 font-bold text-right">Power</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                            ) : contexts.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No active NPU telemetry rows found.</td></tr>
                            ) : (
                                contexts.map((ctx, idx: number) => (
                                    <tr key={`${ctx.node}-${ctx.deviceIdx}-${idx}`} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-muted-foreground">{ctx.node}</td>
                                        <td className="px-4 py-3 font-mono text-foreground font-medium">{ctx.deviceIdx}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {ctx.status === 'Compute' ? '연산 중' : ctx.status === 'Memory Resident' ? '메모리 점유' : ctx.status === 'Error' ? '오류' : '유휴'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{ctx.memalloc}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{ctx.utilization}%</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{ctx.temperature}C</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{ctx.power}W</td>
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
