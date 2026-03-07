import React, { useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { TerminalPanel } from '@/features/console/components/TerminalPanel';
import { ResourceViewPanel } from '@/features/console/components/ResourceViewPanel';
import { Terminal } from 'lucide-react';

export default function KubeConsolePage() {
    const [selectedCommand, setSelectedCommand] = useState('');

    const handleCommandSelect = (cmd: string) => {
        setSelectedCommand(cmd);
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500 container-wrapper">
                <div className="mb-4 shrink-0">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Terminal className="w-6 h-6" /> Accelerator Console
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        통합 터미널과 K9s 기반의 실시간 리소스 뷰어를 통해 파드, 노드, 서비스 등 K8s 자원을 마우스 조작 없이 직접 진단하고 명령을 내릴 수 있습니다.
                    </p>
                </div>

                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Left Pane: Interactive Terminal & History */}
                    <div className="w-[40%] flex flex-col min-h-0">
                        <TerminalPanel prefilledCommand={selectedCommand} />
                    </div>

                    {/* Right Pane: Live Resource Explorer (k9s style) */}
                    <div className="w-[60%] flex flex-col min-h-0">
                        <ResourceViewPanel onCommandSelect={handleCommandSelect} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
