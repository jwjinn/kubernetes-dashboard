import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchClusterSummary, fetchTopologyData } from '@/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { WorkloadTopology } from '@/features/kubernetes/components/WorkloadTopology';
import { Card, Text, Metric, Grid } from '@tremor/react';

export default function WorkloadPage() {
    const { data: summary } = useQuery({ queryKey: ['clusterSummary'], queryFn: () => fetchClusterSummary('all-clusters') });

    return (
        <DashboardLayout>
            <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Workload Topology</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        어플리케이션이 어떻게 배포되어 있는지 (Deployment - ReplicaSet - Pod - Node) 연결 관계를 다이어그램으로 추적합니다.
                    </p>
                </div>

                <Grid numItemsSm={2} numItemsLg={4} className="gap-6 shrink-0">
                    <Card decoration="top" decorationColor="blue"><Text>Deployments</Text><Metric>12</Metric></Card>
                    <Card decoration="top" decorationColor="indigo"><Text>ReplicaSets</Text><Metric>15</Metric></Card>
                    <Card decoration="top" decorationColor="emerald"><Text>Running Pods</Text><Metric>48</Metric></Card>
                    <Card decoration="top" decorationColor="rose"><Text>Failed Pods</Text><Metric>2</Metric></Card>
                </Grid>

                <div className="flex-1 w-full border border-border rounded-lg shadow-sm overflow-hidden min-h-[500px]">
                    <WorkloadTopology />
                </div>
            </div>
        </DashboardLayout>
    );
}
