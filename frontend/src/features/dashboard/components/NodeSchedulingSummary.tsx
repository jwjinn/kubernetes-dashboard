import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { fetchAcceleratorDevices, fetchNpuClusterOverview, fetchNpuHardwareDetails, fetchNpuWorkloadMapping } from '@/api';
import { useFilterStore } from '@/store/filterStore';
import { getEnv } from '@/config/env';

type NodeSummary = {
    node: string;
    allocated: number;
    capacity: number;
    podCount: number;
    statusLabel: string;
    statusClassName: string;
    note: string;
    averageUtilization?: number;
    hottestTemperature?: number;
    errorCount?: number;
};

export function NodeSchedulingSummary() {
    const { selectedCluster } = useFilterStore();
    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU') as 'GPU' | 'NPU';
    const isNpu = acceleratorMode === 'NPU';

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

    const acceleratorDevicesQuery = useQuery({
        queryKey: ['acceleratorDevices', acceleratorMode, selectedCluster],
        queryFn: () => fetchAcceleratorDevices(acceleratorMode),
        enabled: !isNpu
    });

    const isLoading = isNpu
        ? npuOverviewQuery.isLoading || npuHardwareQuery.isLoading || npuWorkloadQuery.isLoading
        : acceleratorDevicesQuery.isLoading;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="h-44 animate-pulse" />
                <Card className="h-44 animate-pulse" />
                <Card className="h-44 animate-pulse" />
            </div>
        );
    }

    const nodeSummaries = isNpu
        ? buildNpuNodeSummaries(npuOverviewQuery.data, npuHardwareQuery.data, npuWorkloadQuery.data)
        : buildGpuNodeSummaries(acceleratorDevicesQuery.data || []);

    if (nodeSummaries.length === 0) {
        return <Card className="p-6 text-sm text-muted-foreground">노드별 스케줄링 요약을 불러올 수 없습니다.</Card>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center">
                <h3 className="text-base font-bold">Node Scheduling Summary</h3>
                <InfoTooltip content="메인 화면에서는 노드별 할당량과 스케줄된 Pod 수만 빠르게 확인합니다. 상세한 Pod-NPU 매핑이나 장치별 상태는 Accelerator 화면에서 이어서 보는 흐름을 기준으로 합니다." />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {nodeSummaries.map((node) => {
                    const ratio = node.capacity > 0 ? Math.round((node.allocated / node.capacity) * 100) : 0;

                    return (
                        <Card key={node.node} className="border-border p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-lg font-bold">{node.node}</h4>
                                    <p className="mt-1 text-xs text-muted-foreground">{node.note}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${node.statusClassName}`}>
                                    {node.statusLabel}
                                </span>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Requested</p>
                                    <p className="mt-1 text-2xl font-black">{node.allocated} / {node.capacity}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{ratio}% allocated</p>
                                </div>

                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Scheduled Pods</p>
                                    <p className="mt-1 text-2xl font-black">{node.podCount}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">현재 노드에 배치된 워크로드 수</p>
                                </div>
                            </div>

                            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className={`h-full rounded-full ${
                                        ratio >= 90
                                            ? 'bg-red-500'
                                            : ratio >= 70
                                                ? 'bg-amber-500'
                                                : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(ratio, 100)}%` }}
                                />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {typeof node.averageUtilization === 'number' && (
                                    <span className="rounded-full border border-border px-2.5 py-1">
                                        Avg Util {node.averageUtilization}%
                                    </span>
                                )}
                                {typeof node.hottestTemperature === 'number' && (
                                    <span className="rounded-full border border-border px-2.5 py-1">
                                        Hottest {node.hottestTemperature}°C
                                    </span>
                                )}
                                {typeof node.errorCount === 'number' && (
                                    <span className="rounded-full border border-border px-2.5 py-1">
                                        Errors {node.errorCount}
                                    </span>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function buildNpuNodeSummaries(overview: any, hardware: any, workloadData: any): NodeSummary[] {
    const nodeAllocation = (overview?.nodeAllocation || []) as Array<{ node: string; allocated: number; capacity: number }>;
    const devices = (hardware?.devices || []) as Array<{ node: string; utilization: number; temperature: number; status: string }>;
    const podMappings = (workloadData?.podMappings || []) as Array<{ node: string; podName: string }>;

    const devicesByNode = new Map<string, Array<{ utilization: number; temperature: number; status: string }>>();
    devices.forEach((device) => {
        const current = devicesByNode.get(device.node) || [];
        current.push(device);
        devicesByNode.set(device.node, current);
    });

    const podCountByNode = new Map<string, number>();
    const seenPodsByNode = new Map<string, Set<string>>();
    podMappings.forEach((mapping) => {
        const seen = seenPodsByNode.get(mapping.node) || new Set<string>();
        seen.add(mapping.podName);
        seenPodsByNode.set(mapping.node, seen);
    });
    seenPodsByNode.forEach((pods, node) => {
        podCountByNode.set(node, pods.size);
    });

    return nodeAllocation
        .map((nodeInfo) => {
            const nodeDevices = devicesByNode.get(nodeInfo.node) || [];
            const ratio = nodeInfo.capacity > 0 ? Math.round((nodeInfo.allocated / nodeInfo.capacity) * 100) : 0;
            const hottestTemperature = nodeDevices.length > 0 ? Math.max(...nodeDevices.map((device) => device.temperature)) : 0;
            const averageUtilization = nodeDevices.length > 0
                ? Math.round(nodeDevices.reduce((sum, device) => sum + device.utilization, 0) / nodeDevices.length)
                : 0;
            const errorCount = nodeDevices.filter((device) => device.status === 'Error').length;

            return {
                node: nodeInfo.node,
                allocated: nodeInfo.allocated,
                capacity: nodeInfo.capacity,
                podCount: podCountByNode.get(nodeInfo.node) || 0,
                statusLabel: errorCount > 0
                    ? '장치 오류'
                    : ratio >= 90
                        ? '혼잡'
                        : ratio >= 70 || hottestTemperature >= 85
                            ? '주의'
                            : nodeInfo.allocated > 0
                                ? '안정'
                                : '유휴',
                statusClassName: errorCount > 0
                    ? 'bg-red-100 text-red-700'
                    : ratio >= 90
                        ? 'bg-red-100 text-red-700'
                        : ratio >= 70 || hottestTemperature >= 85
                            ? 'bg-amber-100 text-amber-700'
                            : nodeInfo.allocated > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600',
                note: errorCount > 0
                    ? `오류 장치 ${errorCount}개가 감지되었습니다.`
                    : ratio >= 90
                        ? '요청량이 높아 추가 배치 여유가 적습니다.'
                        : ratio >= 70
                            ? '신규 워크로드 배치 전 상태 확인이 좋습니다.'
                            : '메인 화면에서 빠르게 확인하기 좋은 안정 상태입니다.',
                averageUtilization,
                hottestTemperature,
                errorCount,
            };
        })
        .sort((a, b) => {
            const severity = (item: NodeSummary) => {
                if (item.errorCount && item.errorCount > 0) return 3;
                const ratio = item.capacity > 0 ? item.allocated / item.capacity : 0;
                if (ratio >= 0.9) return 2;
                if (ratio >= 0.7) return 1;
                return 0;
            };

            return severity(b) - severity(a) || b.podCount - a.podCount;
        });
}

function buildGpuNodeSummaries(devices: Array<{
    node: string;
    status: string;
    utilization: number;
    temperature: number;
    pod?: string;
}>): NodeSummary[] {
    const grouped = devices.reduce((acc, device) => {
        if (!acc[device.node]) {
            acc[device.node] = [];
        }
        acc[device.node].push(device);
        return acc;
    }, {} as Record<string, typeof devices>);

    return Object.entries(grouped)
        .map(([node, nodeDevices]) => {
            const allocated = nodeDevices.filter((device) => device.status === 'Active').length;
            const capacity = nodeDevices.length;
            const ratio = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
            const hottestTemperature = nodeDevices.length > 0 ? Math.max(...nodeDevices.map((device) => device.temperature || 0)) : 0;
            const averageUtilization = nodeDevices.length > 0
                ? Math.round(nodeDevices.reduce((sum, device) => sum + (device.utilization || 0), 0) / nodeDevices.length)
                : 0;
            const errorCount = nodeDevices.filter((device) => device.status === 'Error').length;
            const podCount = new Set(nodeDevices.map((device) => device.pod).filter(Boolean)).size;

            return {
                node,
                allocated,
                capacity,
                podCount,
                statusLabel: errorCount > 0
                    ? '장치 오류'
                    : ratio >= 90
                        ? '혼잡'
                        : ratio >= 70 || hottestTemperature >= 85
                            ? '주의'
                            : allocated > 0
                                ? '안정'
                                : '유휴',
                statusClassName: errorCount > 0
                    ? 'bg-red-100 text-red-700'
                    : ratio >= 90
                        ? 'bg-red-100 text-red-700'
                        : ratio >= 70 || hottestTemperature >= 85
                            ? 'bg-amber-100 text-amber-700'
                            : allocated > 0
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600',
                note: 'GPU 모드에서는 장치 상태와 관측된 Pod 기준으로 요약합니다.',
                averageUtilization,
                hottestTemperature,
                errorCount,
            };
        })
        .sort((a, b) => b.podCount - a.podCount);
}
