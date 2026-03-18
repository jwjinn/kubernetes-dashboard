import React from 'react';
import { Card, Text, Metric, Flex, ProgressBar, BadgeDelta, Grid } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { fetchClusterSummary, fetchNpuClusterOverview, fetchNpuHardwareDetails } from '@/api';
import { useFilterStore } from '@/store/filterStore';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getEnv } from '@/config/env';
import { InfoTooltip } from '@/components/ui/info-tooltip';

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

    const isLoading = isNpu
        ? npuOverviewQuery.isLoading || npuHardwareQuery.isLoading
        : clusterSummaryQuery.isLoading;

    if (isLoading) {
        return <div className="animate-pulse flex gap-4"><Card className="h-32 w-full" /><Card className="h-32 w-full" /><Card className="h-32 w-full" /></div>;
    }

    const data = clusterSummaryQuery.data;
    const npuOverview = npuOverviewQuery.data;
    const npuHardware = npuHardwareQuery.data;

    if ((!isNpu && (!data || clusterSummaryQuery.error)) || (isNpu && (!npuOverview || !npuHardware))) {
        return <Card>Error loading cluster data.</Card>;
    }

    const devices = (npuHardware?.devices || []) as Array<{ utilization: number; temperature: number; status: string }>;
    const activeDevices = devices.filter((device) => device.status === 'Active');
    const utilizationSource = activeDevices.length > 0 ? activeDevices : devices;

    const summary = isNpu
        ? {
            used: npuOverview.allocated,
            total: npuOverview.totalCapacity,
            idle: Math.max(npuOverview.totalCapacity - npuOverview.allocated, 0),
            allocationPercent: npuOverview.totalCapacity > 0 ? Math.round((npuOverview.allocated / npuOverview.totalCapacity) * 100) : 0,
            utilizationPercent: utilizationSource.length > 0
                ? Math.round(utilizationSource.reduce((sum, device) => sum + device.utilization, 0) / utilizationSource.length)
                : 0,
            temperature: devices.length > 0
                ? Math.round(devices.reduce((sum, device) => sum + device.temperature, 0) / devices.length)
                : 0,
            healthStatus: devices.some((device) => device.status === 'Error') ? 'Degraded' : 'Healthy',
        }
        : {
            used: data.usedGpu,
            total: data.totalGpu,
            idle: data.idleGpu,
            allocationPercent: data.totalGpu > 0 ? Math.round((data.usedGpu / data.totalGpu) * 100) : 0,
            utilizationPercent: data.totalGpu > 0 ? Math.round((data.usedGpu / data.totalGpu) * 100) : 0,
            temperature: data.temperature,
            healthStatus: data.healthStatus,
        };

    const resourceLabel = isNpu ? 'NPU' : 'GPU';
    const idleLabel = isNpu ? 'Idle NPUs' : 'Idle GPUs';
    const targetPath = isNpu ? '/accelerator' : '/cluster-dashboard';

    return (
        <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
            <Card decoration="top" decorationColor="indigo" className="relative group hover:shadow-md transition-all cursor-pointer">
                <Link to={targetPath} className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 group-hover:text-primary transition-colors">
                            {resourceLabel} Allocation
                            <InfoTooltip content={isNpu
                                ? '클러스터 전체 NPU 칩 수 대비 현재 워크로드에 할당된 NPU 수입니다. 점유율 배지는 실제 장비에서 수집한 평균 NPU utilization을 뜻합니다.'
                                : '클러스터 전체 GPU 수 대비 현재 워크로드에 할당된 GPU 수입니다.'} />
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
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

            <Card decoration="top" decorationColor={summary.idle > 0 ? "emerald" : "red"} className="relative group hover:shadow-md transition-all cursor-pointer">
                <Link to={targetPath} className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 group-hover:text-primary transition-colors">
                            {idleLabel}
                            <InfoTooltip content={isNpu
                                ? '현재 어떤 Pod에도 점유되지 않은 유휴 NPU 수입니다. 바로 새 AI 워크로드에 배정할 수 있는 여유 자원으로 보면 됩니다.'
                                : '현재 어떤 워크로드에도 할당되지 않은 유휴 GPU 수입니다.'} />
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                        </Text>
                        <Metric>{summary.idle}</Metric>
                    </div>
                </Flex>
                <Text className="mt-4">
                    {isNpu ? 'Standby NPU resources ready for allocation' : 'Standby resources ready for allocation'}
                </Text>
            </Card>

            <Card decoration="top" decorationColor={summary.temperature > 85 ? "red" : "amber"} className="relative group hover:shadow-md transition-all cursor-pointer">
                <Link to={targetPath} className="absolute inset-0 z-10" />
                <Flex alignItems="start">
                    <div>
                        <Text className="flex items-center gap-1 group-hover:text-primary transition-colors">
                            {isNpu ? 'Avg NPU Temperature' : 'Avg Temperature'}
                            <InfoTooltip content={isNpu
                                ? '현재 수집된 NPU 장비들의 평균 온도입니다. 특정 장치의 고온 여부는 Accelerator 화면의 Hardware Details에서 더 자세히 볼 수 있습니다.'
                                : '클러스터 전체 GPU 상태를 기준으로 계산한 평균 온도입니다.'} />
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
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
                <ProgressBar value={(summary.temperature / 100) * 100} color={summary.temperature > 85 ? 'red' : 'amber'} className="mt-2" />
            </Card>
        </Grid>
    );
}
