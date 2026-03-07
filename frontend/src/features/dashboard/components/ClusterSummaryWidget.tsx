import React from 'react';
import { Card, Text, Metric, Flex, ProgressBar, BadgeDelta, Grid } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { fetchClusterSummary } from '@/api';
import { useFilterStore } from '@/store/filterStore';

export function ClusterSummaryWidget() {
    const { selectedCluster } = useFilterStore();

    const { data, isLoading, error } = useQuery({
        queryKey: ['clusterSummary', selectedCluster],
        queryFn: () => fetchClusterSummary(selectedCluster)
    });

    if (isLoading) {
        return <div className="animate-pulse flex gap-4"><Card className="h-32 w-full" /><Card className="h-32 w-full" /><Card className="h-32 w-full" /></div>;
    }

    if (error || !data) {
        return <Card>Error loading cluster data.</Card>;
    }

    const gpuUsagePercent = Math.round((data.usedGpu / data.totalGpu) * 100);

    return (
        <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
            {/* GPU Allocation Card */}
            <Card decoration="top" decorationColor="indigo">
                <Flex alignItems="start">
                    <div>
                        <Text>GPU Allocation</Text>
                        <Metric>{data.usedGpu} / {data.totalGpu}</Metric>
                    </div>
                    <BadgeDelta deltaType={gpuUsagePercent > 90 ? 'moderateDecrease' : 'moderateIncrease'}>
                        {gpuUsagePercent}% Utilized
                    </BadgeDelta>
                </Flex>
                <Flex className="mt-4">
                    <Text className="truncate">Allocated</Text>
                    <Text>{gpuUsagePercent}%</Text>
                </Flex>
                <ProgressBar value={gpuUsagePercent} color={gpuUsagePercent > 90 ? 'red' : 'indigo'} className="mt-2" />
            </Card>

            {/* Idle GPUs Card */}
            <Card decoration="top" decorationColor={data.idleGpu > 0 ? "emerald" : "red"}>
                <Flex alignItems="start">
                    <div>
                        <Text>Idle GPUs</Text>
                        <Metric>{data.idleGpu}</Metric>
                    </div>
                </Flex>
                <Text className="mt-4">Standby resources ready for allocation</Text>
            </Card>

            {/* Cluster Temperature Card */}
            <Card decoration="top" decorationColor={data.temperature > 85 ? "red" : "amber"}>
                <Flex alignItems="start">
                    <div>
                        <Text>Avg Temperature</Text>
                        <Metric>{data.temperature}°C</Metric>
                    </div>
                    <BadgeDelta deltaType={data.temperature > 85 ? 'decrease' : 'unchanged'}>
                        {data.healthStatus}
                    </BadgeDelta>
                </Flex>
                <Flex className="mt-4">
                    <Text className="truncate">Critical Threshold</Text>
                    <Text>95°C</Text>
                </Flex>
                <ProgressBar value={(data.temperature / 100) * 100} color={data.temperature > 85 ? 'red' : 'amber'} className="mt-2" />
            </Card>
        </Grid>
    );
}
