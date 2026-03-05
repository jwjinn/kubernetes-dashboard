import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Cpu, Zap } from 'lucide-react';

export interface ContainerData {
    id: string;
    name: string;
    namespace: string;
    node: string;
    resourceType?: 'GPU' | 'CPU';
    status: 'healthy' | 'warning' | 'failed';
    cpuRequest: number;
    cpuUsagePercent: number;
    memUsagePercent: number;
    txCount: number;
    hasTrace: boolean;
}

interface ContainerBlockProps {
    data: ContainerData;
    onClick: (data: ContainerData) => void;
}

export function ContainerBlock({ data, onClick }: ContainerBlockProps) {
    // Determine color based on status and resource usage
    const getStatusColor = () => {
        if (data.status === 'failed') return 'bg-red-500 hover:bg-red-400 border-red-700 text-white';
        if (data.status === 'warning') return 'bg-yellow-400 hover:bg-yellow-300 border-yellow-600 text-yellow-900';

        // GPU units get a slightly different indigo-based palette if healthy
        if (data.resourceType === 'GPU') {
            if (data.cpuUsagePercent > 70) return 'bg-indigo-600 hover:bg-indigo-500 border-indigo-800 text-white';
            if (data.cpuUsagePercent > 40) return 'bg-indigo-500 hover:bg-indigo-400 border-indigo-700 text-white';
            return 'bg-indigo-400 hover:bg-indigo-300 border-indigo-600 text-indigo-950'; // Low usage GPU
        }

        // Healthy CPU - emerald
        if (data.cpuUsagePercent > 70) return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-800 text-white';
        if (data.cpuUsagePercent > 40) return 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white';
        return 'bg-emerald-400 hover:bg-emerald-300 border-emerald-600 text-emerald-950';
    };

    return (
        <div
            onClick={() => onClick(data)}
            className={cn(
                "cursor-pointer rounded-sm border p-1.5 flex flex-col justify-between transition-colors shadow-sm",
                "w-24 h-24 relative overflow-hidden group",
                getStatusColor()
            )}
            title={`${data.name} [${data.resourceType}] \nCPU: ${data.cpuUsagePercent}% | Mem: ${data.memUsagePercent}%`}
        >
            {/* Top Section - Name and Resource Icon */}
            <div className="flex justify-between items-start w-full gap-1">
                <span className="text-[9px] font-bold leading-none truncate flex-1">
                    {data.name.replace('app-worker-', 'W-')}
                </span>
                {data.resourceType === 'GPU' ? (
                    <Zap className="w-2.5 h-2.5 text-yellow-300 shrink-0" fill="currentColor" />
                ) : (
                    <Cpu className="w-2.5 h-2.5 opacity-60 shrink-0" />
                )}
            </div>

            {/* Micro Block for WhaTap Trace detection */}
            {data.hasTrace && (
                <div className="absolute top-5 right-1">
                    <Activity className="w-2.5 h-2.5 opacity-60 animate-pulse" />
                </div>
            )}

            {/* Bottom Section - Metrics */}
            <div className="mt-auto">
                <div className="flex flex-col gap-0.5 opacity-90">
                    <div className="flex justify-between items-center text-[8px] font-medium">
                        <span>CPU</span>
                        <span>{data.cpuUsagePercent}%</span>
                    </div>
                    {/* Progress bar miniature */}
                    <div className="w-full bg-black/20 h-1 rounded-full overflow-hidden">
                        <div className="bg-white/80 h-full" style={{ width: `${data.cpuUsagePercent}%` }} />
                    </div>

                    <div className="flex justify-between items-center text-[8px] mt-0.5 font-medium">
                        <span>TX</span>
                        <span>{data.txCount}</span>
                    </div>
                </div>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </div>
    );
}
