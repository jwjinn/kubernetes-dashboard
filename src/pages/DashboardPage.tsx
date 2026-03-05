import React from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ClusterSummaryWidget } from '@/features/dashboard/components/ClusterSummaryWidget';
import { TopologyMap } from '@/features/topology/components/TopologyMap';

export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cluster Overview</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        AI 인프라를 위한 실시간 인사이트 및 토폴로지 시각화 요약 화면입니다.
                    </p>
                </div>

                {/* Top Widgets: KPI Cards */}
                <ClusterSummaryWidget />

                {/* Main Widget: Topology Map */}
                <div className="mt-8">
                    <TopologyMap />
                </div>
            </div>
        </DashboardLayout>
    );
}
