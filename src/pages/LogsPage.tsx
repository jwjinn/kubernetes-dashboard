import React from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LogViewer } from '@/features/logs/components/LogViewer';
import { Terminal, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/store/filterStore';

export default function LogsPage() {
    const { selectedCluster } = useFilterStore();

    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-140px)] flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                            <Terminal className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">통합 컨트롤 플레인 로그 (Log Explorer)</h2>
                            <p className="text-muted-foreground text-xs font-medium">클러스터 내 모든 파드의 실시간 로그를 검색하고 모니터링합니다.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="px-3 py-1 text-xs">Cluster: {selectedCluster}</Badge>
                        <button className="p-2 border border-border rounded-md hover:bg-muted transition-colors" title="Settings">
                            <Settings className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {/* Main Log Viewer */}
                <div className="flex-1 overflow-hidden shadow-sm">
                    <LogViewer height="h-full" />
                </div>
            </div>
        </DashboardLayout>
    );
}
