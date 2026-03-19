import { Card, Text, Metric } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuClusterOverview, fetchNpuWorkloadMapping } from '@/api';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, ServerCog, Workflow } from 'lucide-react';

interface ClusterOverviewViewProps {
    onOpenTab?: (tab: 'hardware' | 'workload') => void;
}

export function ClusterOverviewView({ onOpenTab }: ClusterOverviewViewProps) {
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
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Cluster Overview...</div>;
    }

    const { totalCapacity, allocated, hardwareVersions, nodeAllocation } = overview;
    const podMappings = workloadData?.podMappings || [];

    const available = Math.max(totalCapacity - allocated, 0);
    const requestRatio = totalCapacity > 0 ? Math.round((allocated / totalCapacity) * 100) : 0;
    const activeNodes = nodeAllocation.filter((n: any) => n.allocated > 0).length;
    const workloadCount = podMappings.length;

    const statusTone =
        requestRatio >= 90 ? 'bg-red-50 border-red-200 text-red-900' :
        requestRatio >= 70 ? 'bg-amber-50 border-amber-200 text-amber-900' :
        'bg-emerald-50 border-emerald-200 text-emerald-900';

    const statusLabel =
        requestRatio >= 90 ? '혼잡' :
        requestRatio >= 70 ? '주의' :
        '안정';

    const summarySentence =
        requestRatio >= 90
            ? `현재 NPU ${totalCapacity}개 중 ${allocated}개가 요청되어 추가 배치 여유가 거의 없습니다. 우선 노드별 상세와 워크로드 분산 상태를 확인하는 것이 좋습니다.`
            : requestRatio >= 70
                ? `현재 NPU ${totalCapacity}개 중 ${allocated}개가 요청되어 있습니다. 아직 여유는 있지만 신규 워크로드를 배치하기 전 노드별 편차를 확인하는 것이 좋습니다.`
                : `현재 NPU ${totalCapacity}개 중 ${allocated}개가 요청되어 있으며 ${available}개를 추가로 배치할 수 있습니다. 클러스터는 전반적으로 안정 상태입니다.`;

    const hardwareVersionMap = new Map(
        hardwareVersions.map((item: any) => [item.node, item])
    );

    const nodeComparisons = nodeAllocation.map((nodeInfo: any) => {
        const podsOnNode = podMappings.filter((mapping: any) => mapping.node === nodeInfo.node);
        const topPods = podsOnNode.slice(0, 2).map((mapping: any) => mapping.podName);
        const nodeRatio = nodeInfo.capacity > 0 ? Math.round((nodeInfo.allocated / nodeInfo.capacity) * 100) : 0;
        const nodeStatus =
            nodeRatio >= 90 ? '혼잡' :
            nodeRatio >= 70 ? '주의' :
            nodeInfo.allocated > 0 ? '사용 중' : '대기';

        return {
            ...nodeInfo,
            topPods,
            podCount: podsOnNode.length,
            nodeRatio,
            nodeStatus,
            hardware: hardwareVersionMap.get(nodeInfo.node),
        };
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className={`p-5 border shadow-sm ${statusTone}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-background/60 px-2.5 py-1 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                현재 상태: {statusLabel}
                            </span>
                        </div>
                        <h3 className="mt-3 text-lg font-bold">현재 상태 결론</h3>
                        <p className="mt-2 text-sm leading-relaxed opacity-90">{summarySentence}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 min-w-[240px]">
                        <div className="rounded-lg border border-current/10 bg-background/70 p-3">
                            <p className="text-[11px] uppercase opacity-70">요청 비율</p>
                            <p className="mt-1 text-2xl font-black">{requestRatio}%</p>
                        </div>
                        <div className="rounded-lg border border-current/10 bg-background/70 p-3">
                            <p className="text-[11px] uppercase opacity-70">추가 가능량</p>
                            <p className="mt-1 text-2xl font-black">{available}</p>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">요청 할당량</Text>
                        <InfoTooltip content="Kubernetes Pod requests 기준으로 현재 요청된 NPU 수량입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{allocated} / {totalCapacity}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">현재 전체 용량의 {requestRatio}%가 요청되어 있습니다.</p>
                </Card>

                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">즉시 사용 가능</Text>
                        <InfoTooltip content="현재 요청량을 제외하고 바로 추가 배치 가능한 NPU 수량입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{available}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">신규 NPU 워크로드가 바로 사용할 수 있는 여유 자원입니다.</p>
                </Card>

                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">활성 워크로드</Text>
                        <InfoTooltip content="NPU requests가 설정된 실행 중 워크로드 수입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{workloadCount}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">현재 NPU를 요청한 Pod 수를 기준으로 집계합니다.</p>
                </Card>

                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <Text className="font-bold text-foreground">활성 노드</Text>
                        <InfoTooltip content="NPU 요청이 하나 이상 배치된 노드 수입니다." />
                    </div>
                    <Metric className="mt-3 text-4xl font-black text-foreground">{activeNodes} / {nodeAllocation.length}</Metric>
                    <p className="mt-2 text-sm text-muted-foreground">현재 요청 워크로드가 실제로 배치되어 있는 노드 수입니다.</p>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold">노드별 비교</h3>
                        <p className="text-sm text-muted-foreground mt-1">어느 노드에 여유가 있고, 어떤 워크로드가 배치되어 있는지 빠르게 비교합니다.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {nodeComparisons.map((node: any) => (
                        <Card key={node.node} className="p-5 border-border shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-lg font-bold">{node.node}</h4>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        상태: {node.nodeStatus} · 워크로드 {node.podCount}개
                                    </p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                    node.nodeRatio >= 90 ? 'bg-red-100 text-red-700' :
                                    node.nodeRatio >= 70 ? 'bg-amber-100 text-amber-700' :
                                    node.allocated > 0 ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {node.nodeStatus}
                                </span>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">요청 할당량</span>
                                    <span className="text-muted-foreground">{node.allocated} / {node.capacity}</span>
                                </div>
                                <div className="mt-2 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            node.nodeRatio >= 90 ? 'bg-red-500' :
                                            node.nodeRatio >= 70 ? 'bg-amber-500' :
                                            'bg-emerald-500'
                                        }`}
                                        style={{ width: `${node.nodeRatio}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">남은 여유</p>
                                    <p className="mt-1 font-bold">{Math.max(node.capacity - node.allocated, 0)} NPU</p>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">드라이버 / 제품</p>
                                    <p className="mt-1 font-bold">{node.hardware?.driverVersion ? `v${node.hardware.driverVersion}` : '-'}</p>
                                    <p className="text-xs text-muted-foreground">{node.hardware?.product || '-'}</p>
                                </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-border p-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase">대표 워크로드</p>
                                {node.topPods.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {node.topPods.map((podName: string) => (
                                            <span key={podName} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                                                {podName}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">현재 이 노드에 NPU 요청 워크로드가 없습니다.</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                            <ServerCog className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold">노드와 장치 상태를 더 자세히 보기</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                장치별 사용률, 메모리 사용량, 온도, 전력 상태를 보고 싶다면 `Hardware Details`에서 확인하는 것이 가장 빠릅니다.
                            </p>
                            <Button className="mt-4" variant="outline" onClick={() => onOpenTab?.('hardware')}>
                                Hardware Details 열기
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-border shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                            <Workflow className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold">워크로드와 요청량을 확인하기</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                어떤 Pod가 어느 노드에 몇 개의 NPU를 요청했는지, 그리고 telemetry 기준으로 어떤 장치가 관측되는지 보려면 `Workload & Pod Mapping`으로 이동하세요.
                            </p>
                            <Button className="mt-4" variant="outline" onClick={() => onOpenTab?.('workload')}>
                                Workload & Pod Mapping 열기
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
