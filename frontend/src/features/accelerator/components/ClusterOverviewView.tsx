import { Card, Text, Metric } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuClusterOverview } from '@/api';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export function ClusterOverviewView() {
    const { data: overview, isLoading } = useQuery({
        queryKey: ['npuClusterOverview'],
        queryFn: fetchNpuClusterOverview,
        refetchInterval: 10000
    });

    if (isLoading || !overview) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Cluster Overview...</div>;
    }

    const { totalCapacity, allocated, hardwareVersions, nodeAllocation } = overview;
    const utilizationPercent = Math.round((allocated / totalCapacity) * 100) || 0;

    const gaugeOption = {
        series: [
            {
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                pointer: { show: false },
                progress: { 
                    show: true, 
                    overlap: false, 
                    roundCap: true, 
                    clip: false, 
                    itemStyle: { color: '#22c55e' } // NPU Green
                },
                axisLine: { lineStyle: { width: 15, color: [[1, '#e2e8f0']] } },
                splitLine: { show: false },
                axisTick: { show: false },
                axisLabel: { show: false },
                data: [{ value: utilizationPercent, name: 'Allocated' }],
                title: { fontSize: 12, color: '#64748b', offsetCenter: ['0%', '30%'] },
                detail: {
                    width: 50,
                    height: 14,
                    fontSize: 24,
                    color: '#22c55e',
                    fontWeight: 'bold',
                    formatter: '{value}%',
                    offsetCenter: ['0%', '-10%']
                }
            }
        ]
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                    <div className="flex items-center mb-4">
                        <Text className="font-bold text-foreground">통합 NPU 자원 현황 (Capacity)</Text>
                        <InfoTooltip content="클러스터 내에서 rebellions.ai/ATOM 리소스로 노출되는 전체 NPU 칩의 수량 대비 현재 파드(Pod)에 할당되어 사용 중인 NPU 개수입니다." />
                    </div>
                    <div className="flex justify-between items-end px-4">
                        <div className="flex flex-col items-center">
                            <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                            <Metric className="text-4xl font-black text-foreground">{totalCapacity}</Metric>
                        </div>
                        <div className="flex flex-col items-center">
                            <Text className="flex items-center gap-1.5 text-xs font-bold text-green-500 uppercase mb-1">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> 할당됨 (Allocated)
                            </Text>
                            <Metric className="text-4xl font-black text-green-500">{allocated}</Metric>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-border shadow-sm">
                    <div className="flex items-center mb-2">
                        <Text className="font-bold text-foreground">클러스터 자원 점유율</Text>
                        <InfoTooltip content="현재 전체 NPU 용량 대비 할당된 NPU의 백분율(%)입니다. 이 수치가 100%에 도달하면 추가적인 AI 워크로드를 스케줄링할 수 없습니다." />
                    </div>
                    <div className="h-[120px] -mt-4">
                        <ReactECharts option={gaugeOption} style={{ height: '100%' }} />
                    </div>
                </Card>

                <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                    <div className="flex items-center mb-4">
                        <Text className="font-bold text-foreground">NPU 장착 노드 현황</Text>
                        <InfoTooltip content="네임스페이스와 무관하게 NPU 장비가 장착된 워커 노드의 총합과, 현재 활발히 AI 연산을 처리하고 있는 (1개 이상의 NPU가 할당된) 노드의 개수를 나타냅니다." />
                    </div>
                    <div className="flex justify-between items-end px-4">
                        <div className="flex flex-col items-center">
                            <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Nodes</Text>
                            <Metric className="text-4xl font-black text-foreground">{nodeAllocation.length}</Metric>
                        </div>
                        <div className="flex flex-col items-center">
                            <Text className="text-xs font-bold text-green-500 uppercase mb-1">Active</Text>
                            <Metric className="text-4xl font-black text-green-500">
                                {nodeAllocation.filter((n: any) => n.allocated > 0).length}
                            </Metric>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Node Allocations & Software Versions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center">
                        <h3 className="font-bold text-sm">노드별 할당 (Allocation) 현황</h3>
                        <InfoTooltip content="각 물리적 워커 노드별로 NPU가 어느 정도 점유되어 있는지 게이지를 통해 직관적으로 보여줍니다. 불균형적인 워크로드 분배를 파악할 때 유용합니다." />
                    </div>
                    <div className="p-4 flex-1 max-h-[300px] overflow-y-auto">
                        <div className="space-y-4">
                            {nodeAllocation.map((nodeInfo: any) => (
                                <div key={nodeInfo.node} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium">{nodeInfo.node}</span>
                                        <span className="text-muted-foreground">{nodeInfo.allocated} / {nodeInfo.capacity} Allocated</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(nodeInfo.allocated / nodeInfo.capacity) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center">
                        <h3 className="font-bold text-sm">소프트웨어 및 드라이버 호환성 요약</h3>
                        <InfoTooltip content="각 노드의 쿠버네티스 레이블(rebellions.ai/driver-version 등)을 기반으로 NPU Product Family와 런타임 드라이버 버전을 비교하여 일관성을 확인합니다." />
                    </div>
                    <div className="w-full max-h-[300px] overflow-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Node</th>
                                    <th className="px-4 py-3 font-bold">Driver Version</th>
                                    <th className="px-4 py-3 font-bold">Family</th>
                                    <th className="px-4 py-3 font-bold">Product</th>
                                    <th className="px-4 py-3 font-bold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {hardwareVersions.map((hv: any) => (
                                    <tr key={hv.node} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-muted-foreground">{hv.node}</td>
                                        <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">v{hv.driverVersion}</td>
                                        <td className="px-4 py-3">{hv.family}</td>
                                        <td className="px-4 py-3">{hv.product}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Healthy
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
