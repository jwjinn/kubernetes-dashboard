import { Card, Metric, Text } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuClusterOverview, fetchNpuWorkloadMapping } from '@/api';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export function ClusterOverviewView() {
    const { data: overview, isLoading: isOverviewLoading } = useQuery({
        queryKey: ['npuClusterOverview'],
        queryFn: fetchNpuClusterOverview,
        refetchInterval: 10000
    });

    const { data: workloadData, isLoading: isWorkloadLoading } = useQuery({
        queryKey: ['npuWorkloadMapping'],
        queryFn: fetchNpuWorkloadMapping,
        refetchInterval: 10000
    });

    if (isOverviewLoading || isWorkloadLoading || !overview || !workloadData) {
        return <div className="animate-pulse p-8 text-center text-muted-foreground">Loading Cluster Overview...</div>;
    }

    const { totalCapacity, allocated, hardwareVersions, nodeAllocation } = overview;
    const podMappings = (workloadData?.podMappings || []) as Array<{ node: string }>;
    const available = Math.max(totalCapacity - allocated, 0);
    const requestRatio = totalCapacity > 0 ? Math.round((allocated / totalCapacity) * 100) : 0;
    const activeNodes = nodeAllocation.filter((node: any) => node.allocated > 0).length;

    const hardwareVersionMap = new Map(
        hardwareVersions.map((item: any) => [item.node, item])
    );

    const nodeRows = nodeAllocation
        .map((nodeInfo: any) => {
            const nodeRatio = nodeInfo.capacity > 0 ? Math.round((nodeInfo.allocated / nodeInfo.capacity) * 100) : 0;
            const podsOnNode = podMappings.filter((mapping) => mapping.node === nodeInfo.node).length;

            return {
                ...nodeInfo,
                nodeRatio,
                podsOnNode,
                hardware: hardwareVersionMap.get(nodeInfo.node),
            };
        })
        .sort((a, b) => b.nodeRatio - a.nodeRatio);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">총 NPU 용량</Text>
                        <InfoTooltip content="클러스터 전체에서 스케줄링 가능한 NPU 총량입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{totalCapacity}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">현재 감지된 전체 NPU 리소스 수입니다.</p>
                </Card>

                <Card className="border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">요청 할당량</Text>
                        <InfoTooltip content="Kubernetes Pod requests 기준으로 현재 요청된 NPU 수량입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{allocated}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">전체 용량 대비 {requestRatio}%가 현재 워크로드에 요청되어 있습니다.</p>
                </Card>

                <Card className="border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">사용 가능량</Text>
                        <InfoTooltip content="현재 요청량을 제외하고 추가 배치할 수 있는 NPU 수량입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{available}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">지금 바로 신규 워크로드에 사용할 수 있는 여유 자원입니다.</p>
                </Card>

                <Card className="border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">활성 노드</Text>
                        <InfoTooltip content="NPU 요청이 하나 이상 배치된 노드 수입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{activeNodes} / {nodeAllocation.length}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">현재 요청 워크로드가 실제로 올라가 있는 노드 수입니다.</p>
                </Card>
            </div>

            <Card className="border-border p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-base font-bold">노드별 요청 현황</h3>
                        <p className="mt-1 text-sm text-muted-foreground">NPU 요청 비율, Pod 수, 드라이버 버전을 기준으로 노드 상태를 요약합니다.</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                        requestRatio >= 90
                            ? 'bg-red-100 text-red-700'
                            : requestRatio >= 70
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        전체 요청률 {requestRatio}%
                    </div>
                </div>

                <div className="mt-5 space-y-4">
                    {nodeRows.map((node: any) => (
                        <div key={node.node} className="rounded-xl border border-border bg-background/70 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h4 className="font-bold">{node.node}</h4>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Pod {node.podsOnNode}개 · 드라이버 {node.hardware?.driverVersion ? `v${node.hardware.driverVersion}` : '-'} · 제품 {node.hardware?.product || '-'}
                                    </p>
                                </div>
                                <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                    node.nodeRatio >= 90
                                        ? 'bg-red-100 text-red-700'
                                        : node.nodeRatio >= 70
                                            ? 'bg-amber-100 text-amber-700'
                                            : node.allocated > 0
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {node.allocated > 0 ? `${node.nodeRatio}% 요청 중` : '유휴'}
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">할당량</span>
                                    <span className="text-muted-foreground">{node.allocated} / {node.capacity}</span>
                                </div>
                                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={`h-full rounded-full ${
                                            node.nodeRatio >= 90
                                                ? 'bg-red-500'
                                                : node.nodeRatio >= 70
                                                    ? 'bg-amber-500'
                                                    : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(node.nodeRatio, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
