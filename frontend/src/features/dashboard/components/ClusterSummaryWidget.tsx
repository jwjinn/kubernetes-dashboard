import React from 'react';
import { Card, Text, Metric, Flex, ProgressBar, BadgeDelta, Grid } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import {
    fetchClusterSummary,
    fetchNpuClusterOverview,
    fetchNpuHardwareDetails,
    fetchNpuWorkloadMapping,
} from '@/api';
import { useFilterStore } from '@/store/filterStore';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronRight, Server, Workflow } from 'lucide-react';
import { getEnv } from '@/config/env';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { formatClockTime } from '@/lib/format';

type NpuDeviceSummary = {
    node: string;
    utilization: number;
    temperature: number;
    status: string;
};

export function ClusterSummaryWidget() {
    const { selectedCluster } = useFilterStore();
    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU');
    const isNpu = acceleratorMode === 'NPU';

    const clusterSummaryQuery = useQuery({
        queryKey: ['clusterSummary', selectedCluster],
        queryFn: () => fetchClusterSummary(selectedCluster),
        enabled: !isNpu
    });

    const npuOverviewQuery = useQuery({
        queryKey: ['npuClusterOverview', selectedCluster],
        queryFn: fetchNpuClusterOverview,
        enabled: isNpu
    });

    const npuHardwareQuery = useQuery({
        queryKey: ['npuHardwareDetails', selectedCluster],
        queryFn: fetchNpuHardwareDetails,
        enabled: isNpu
    });

    const npuWorkloadQuery = useQuery({
        queryKey: ['npuWorkloadMapping', selectedCluster],
        queryFn: fetchNpuWorkloadMapping,
        enabled: isNpu
    });

    const isLoading = isNpu
        ? npuOverviewQuery.isLoading || npuHardwareQuery.isLoading || npuWorkloadQuery.isLoading
        : clusterSummaryQuery.isLoading;

    if (isLoading) {
        return <div className="animate-pulse flex gap-4"><Card className="h-32 w-full" /><Card className="h-32 w-full" /><Card className="h-32 w-full" /></div>;
    }
    const lastUpdatedAt = isNpu
        ? Math.max(npuOverviewQuery.dataUpdatedAt, npuHardwareQuery.dataUpdatedAt, npuWorkloadQuery.dataUpdatedAt)
        : clusterSummaryQuery.dataUpdatedAt;

    const data = clusterSummaryQuery.data;
    const npuOverview = npuOverviewQuery.data;
    const npuHardware = npuHardwareQuery.data;
    const workloadData = npuWorkloadQuery.data;

    if ((!isNpu && (!data || clusterSummaryQuery.error)) || (isNpu && (!npuOverview || !npuHardware || !workloadData))) {
        return <Card>Error loading cluster data.</Card>;
    }

    if (isNpu) {
        const devices = (npuHardware?.devices || []) as NpuDeviceSummary[];
        const podMappings = (workloadData?.podMappings || []) as Array<{ node: string; podName: string }>;
        const nodeAllocation = (npuOverview.nodeAllocation || []) as Array<{ node: string; allocated: number; capacity: number }>;
        const hardwareVersions = (npuOverview.hardwareVersions || []) as Array<{ node: string; driverVersion?: string; product?: string }>;

        const available = Math.max(npuOverview.totalCapacity - npuOverview.allocated, 0);
        const requestRatio = npuOverview.totalCapacity > 0
            ? Math.round((npuOverview.allocated / npuOverview.totalCapacity) * 100)
            : 0;
        const hotDevices = devices.filter((device) => device.temperature >= 85).length;
        const errorDevices = devices.filter((device) => device.status === 'Error').length;
        const activeNodes = nodeAllocation.filter((node) => node.allocated > 0).length;
        const hardwareVersionMap = new Map(hardwareVersions.map((item) => [item.node, item]));
        const nodeDeviceMap = new Map<string, NpuDeviceSummary[]>();

        devices.forEach((device) => {
            const current = nodeDeviceMap.get(device.node) || [];
            current.push(device);
            nodeDeviceMap.set(device.node, current);
        });

        const nodeComparisons = nodeAllocation
            .map((nodeInfo) => {
                const podsOnNode = podMappings.filter((mapping) => mapping.node === nodeInfo.node);
                const nodeDevices = nodeDeviceMap.get(nodeInfo.node) || [];
                const nodeRatio = nodeInfo.capacity > 0 ? Math.round((nodeInfo.allocated / nodeInfo.capacity) * 100) : 0;
                const hottestDevice = nodeDevices.length > 0
                    ? Math.max(...nodeDevices.map((device) => device.temperature))
                    : 0;
                const hasError = nodeDevices.some((device) => device.status === 'Error');
                const nodeStatus = hasError
                    ? '장치 오류'
                    : nodeRatio >= 90
                        ? '혼잡'
                        : nodeRatio >= 70
                            ? '주의'
                            : nodeInfo.allocated > 0
                                ? '안정'
                                : '대기';

                return {
                    ...nodeInfo,
                    hardware: hardwareVersionMap.get(nodeInfo.node),
                    podCount: podsOnNode.length,
                    topPods: podsOnNode.slice(0, 2).map((mapping) => mapping.podName),
                    nodeRatio,
                    hottestDevice,
                    hasError,
                    nodeStatus,
                };
            })
            .sort((a, b) => {
                if (a.hasError !== b.hasError) {
                    return a.hasError ? -1 : 1;
                }

                return b.nodeRatio - a.nodeRatio;
            });

        const attentionNodes = nodeComparisons.filter((node) => node.hasError || node.nodeRatio >= 70 || node.hottestDevice >= 85).length;

        const statusTone = attentionNodes > 0 || requestRatio >= 70 || hotDevices > 0
            ? requestRatio >= 90 || errorDevices > 0
                ? 'border-red-200 bg-red-50 text-red-950'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-emerald-200 bg-emerald-50 text-emerald-950';

        const statusLabel = requestRatio >= 90 || errorDevices > 0
            ? '즉시 점검 필요'
            : requestRatio >= 70 || attentionNodes > 0
                ? '주의 필요'
                : '안정';

        const summarySentence = `총 ${npuOverview.totalCapacity} NPU 중 ${npuOverview.allocated}개가 요청되어 있으며, 즉시 사용 가능한 여유는 ${available}개입니다.`;
        const summaryReason = `근거: 요청률 ${requestRatio}% · 오류 장치 ${errorDevices}개 · 주의 노드 ${attentionNodes}개`;
        const summaryRuleGuide = '점검 필요: 오류 장치 감지 · 주의: 요청률 70% 이상 또는 고온/주의 노드 존재 · 안정: 그 외';

        return (
            <div className="space-y-6">
                <Card className={`border shadow-sm ${statusTone}`}>
                    <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-current/15 bg-background/70 px-3 py-1 text-xs font-bold">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {statusLabel}
                            </div>
                            <h3 className="mt-3 text-lg font-bold">메인 클러스터 요약</h3>
                            <p className="mt-2 text-sm leading-6 opacity-90">{summarySentence}</p>
                            <p className="mt-3 text-xs font-medium opacity-90">{summaryReason}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs opacity-80">
                                <span>마지막 갱신 {formatClockTime(lastUpdatedAt)}</span>
                                <span>판단 기준 보기</span>
                                <InfoTooltip content={summaryRuleGuide} />
                            </div>
                        </div>
                        <div className="grid min-w-[260px] grid-cols-2 gap-3">
                            <div className="rounded-xl border border-current/10 bg-background/75 p-4">
                                <p className="text-[11px] font-bold uppercase opacity-70">요청 비율</p>
                                <p className="mt-2 text-3xl font-black">{requestRatio}%</p>
                            </div>
                            <div className="rounded-xl border border-current/10 bg-background/75 p-4">
                                <p className="text-[11px] font-bold uppercase opacity-70">즉시 사용 가능</p>
                                <p className="mt-2 text-3xl font-black">{available}</p>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <Text className="font-bold text-foreground">요청 할당량</Text>
                            <InfoTooltip content="Kubernetes Pod requests 기준으로 현재 요청된 NPU 수량입니다." />
                        </div>
                        <Metric className="mt-3 text-4xl font-black text-foreground">{npuOverview.allocated} / {npuOverview.totalCapacity}</Metric>
                        <p className="mt-2 text-sm text-muted-foreground">전체 용량의 {requestRatio}%가 현재 워크로드에 요청되어 있습니다.</p>
                    </Card>

                    <Card className="border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <Text className="font-bold text-foreground">즉시 사용 가능</Text>
                            <InfoTooltip content="현재 요청량을 제외하고 바로 새 워크로드에 배치할 수 있는 NPU 수량입니다." />
                        </div>
                        <Metric className="mt-3 text-4xl font-black text-foreground">{available}</Metric>
                        <p className="mt-2 text-sm text-muted-foreground">새 AI 워크로드가 바로 사용할 수 있는 여유 자원입니다.</p>
                    </Card>

                    <Card className="border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <Text className="font-bold text-foreground">활성 워크로드</Text>
                            <InfoTooltip content="NPU requests가 설정된 실행 중 Pod 수입니다." />
                        </div>
                        <Metric className="mt-3 text-4xl font-black text-foreground">{podMappings.length}</Metric>
                        <p className="mt-2 text-sm text-muted-foreground">현재 NPU를 요청한 워크로드 수를 기준으로 집계합니다.</p>
                    </Card>

                    <Card className="border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <Text className="font-bold text-foreground">주의 노드</Text>
                            <InfoTooltip content="오류 장치가 있거나 할당률 또는 온도가 높은 노드 수입니다." />
                        </div>
                        <Metric className="mt-3 text-4xl font-black text-foreground">{attentionNodes}</Metric>
                        <p className="mt-2 text-sm text-muted-foreground">활성 노드 {activeNodes}개 중 운영상 먼저 확인할 노드 수입니다.</p>
                    </Card>
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-bold">노드별 비교</h3>
                        <p className="mt-1 text-sm text-muted-foreground">여유 자원, 대표 워크로드, 하드웨어 버전을 한 화면에서 비교합니다.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {nodeComparisons.map((node) => (
                            <Card key={node.node} className="border-border p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className="text-lg font-bold">{node.node}</h4>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            상태: {node.nodeStatus} · 워크로드 {node.podCount}개 · 최고 온도 {node.hottestDevice || 0}°C
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            판단 근거: 요청률 {node.nodeRatio}%, 오류 장치 {node.hasError ? '있음' : '없음'}, 최고 온도 {node.hottestDevice || 0}°C
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                        node.hasError
                                            ? 'bg-red-100 text-red-700'
                                            : node.nodeRatio >= 90 || node.hottestDevice >= 85
                                                ? 'bg-amber-100 text-amber-700'
                                                : node.allocated > 0
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {node.nodeStatus}
                                    </span>
                                </div>

                                <div className="mt-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">요청 할당량</span>
                                        <span className="text-muted-foreground">{node.allocated} / {node.capacity}</span>
                                    </div>
                                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                node.hasError
                                                    ? 'bg-red-500'
                                                    : node.nodeRatio >= 90
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${Math.min(node.nodeRatio, 100)}%` }}
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
                                    <p className="text-xs font-bold uppercase text-muted-foreground">대표 워크로드</p>
                                    {node.topPods.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {node.topPods.map((podName) => (
                                                <span key={podName} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
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

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Link to="/accelerator" className="block">
                        <Card className="group h-full border-border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                    <Workflow className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold">NPU 상세 현황 보기</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        장치별 사용률, 하드웨어 상태, Pod 매핑을 더 자세히 보려면 Accelerator Dashboard로 이동합니다.
                                    </p>
                                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                                        Accelerator Dashboard 열기
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>

                    <Link to="/cluster-dashboard" className="block">
                        <Card className="group h-full border-border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
                                    <Server className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold">시스템 상세 지표 보기</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        CPU, 메모리, 디스크, 네트워크 같은 노드 시스템 지표는 Node Metrics 화면에서 이어서 확인할 수 있습니다.
                                    </p>
                                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                                        Node Metrics 열기
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>
        );
    }

    const summary = {
        used: data.usedGpu,
        total: data.totalGpu,
        idle: data.idleGpu,
        allocationPercent: data.totalGpu > 0 ? Math.round((data.usedGpu / data.totalGpu) * 100) : 0,
        utilizationPercent: data.totalGpu > 0 ? Math.round((data.usedGpu / data.totalGpu) * 100) : 0,
        temperature: data.temperature,
        healthStatus: data.healthStatus,
    };

    return (
        <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
            <Card decoration="top" decorationColor="indigo" className="relative group cursor-pointer transition-all hover:shadow-md">
                <Link to="/cluster-dashboard" className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 transition-colors group-hover:text-primary">
                            GPU Allocation
                            <InfoTooltip content="클러스터 전체 GPU 수 대비 현재 워크로드에 할당된 GPU 수입니다." />
                            <ChevronRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                        </Text>
                        <Metric>{summary.used} / {summary.total}</Metric>
                    </div>
                    <BadgeDelta deltaType={summary.utilizationPercent > 90 ? 'moderateDecrease' : 'moderateIncrease'}>
                        {summary.utilizationPercent}% Utilized
                    </BadgeDelta>
                </Flex>
                <Flex className="mt-4">
                    <Text className="truncate">Allocated</Text>
                    <Text>{summary.allocationPercent}%</Text>
                </Flex>
                <ProgressBar value={summary.allocationPercent} color={summary.allocationPercent > 90 ? 'red' : 'indigo'} className="mt-2" />
            </Card>

            <Card decoration="top" decorationColor={summary.idle > 0 ? 'emerald' : 'red'} className="relative group cursor-pointer transition-all hover:shadow-md">
                <Link to="/cluster-dashboard" className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 transition-colors group-hover:text-primary">
                            Idle GPUs
                            <InfoTooltip content="현재 어떤 워크로드에도 할당되지 않은 유휴 GPU 수입니다." />
                            <ChevronRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                        </Text>
                        <Metric>{summary.idle}</Metric>
                    </div>
                </Flex>
                <Text className="mt-4">Standby resources ready for allocation</Text>
            </Card>

            <Card decoration="top" decorationColor={summary.temperature > 85 ? 'red' : 'amber'} className="relative group cursor-pointer transition-all hover:shadow-md">
                <Link to="/cluster-dashboard" className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 transition-colors group-hover:text-primary">
                            Avg Temperature
                            <InfoTooltip content="클러스터 전체 GPU 상태를 기준으로 계산한 평균 온도입니다." />
                            <ChevronRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                        </Text>
                        <Metric>{summary.temperature}°C</Metric>
                    </div>
                    <BadgeDelta deltaType={summary.temperature > 85 ? 'decrease' : 'unchanged'}>
                        {summary.healthStatus}
                    </BadgeDelta>
                </Flex>
                <Flex className="mt-4">
                    <Text className="truncate">Critical Threshold</Text>
                    <Text>95°C</Text>
                </Flex>
                <ProgressBar value={summary.temperature} color={summary.temperature > 85 ? 'red' : 'amber'} className="mt-2" />
            </Card>
        </Grid>
    );
}
