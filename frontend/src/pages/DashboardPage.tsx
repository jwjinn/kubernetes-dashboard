import React from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ClusterSummaryWidget } from '@/features/dashboard/components/ClusterSummaryWidget';
import { Link } from 'react-router-dom';
import { Server } from 'lucide-react';

export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Cluster Overview</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            AI 인프라를 위한 실시간 인사이트 요약 화면입니다.
                        </p>
                    </div>
                    <Link
                        to="/cluster-dashboard"
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all font-semibold text-sm border border-primary/20"
                    >
                        <Server className="w-4 h-4" />
                        시스템 상세 지표 (Node Metrics)
                    </Link>
                </div>

                {/* Top Widgets: KPI Cards */}
                <ClusterSummaryWidget />
            </div>
        </DashboardLayout>
    );
}
