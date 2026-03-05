import React from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

export interface ContainerData {
    id: string;
    name: string;
    namespace: string;
    node: string;
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
    // Determine color based on status and resource usage (like WhaTap's request vs return ratio coloring)
    const getStatusColor = () => {
        if (data.status === 'failed') return 'bg-red-500 hover:bg-red-400 border-red-700 text-white';
        if (data.status === 'warning') return 'bg-yellow-400 hover:bg-yellow-300 border-yellow-600 text-yellow-900';
        // Healthy - color depth based on CPU usage simulated WhaTap request vs usage heat
        if (data.cpuUsagePercent > 70) return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-800 text-white';
        if (data.cpuUsagePercent > 40) return 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white';
        return 'bg-emerald-400 hover:bg-emerald-300 border-emerald-600 text-emerald-950'; // Low usage
    };

    return (
        <div
            onClick={() => onClick(data)}
            className={cn(
                "cursor-pointer rounded-sm border p-1.5 flex flex-col justify-between transition-colors shadow-sm",
                "w-24 h-24 relative overflow-hidden group",
                getStatusColor()
            )}
            title={`${data.name} \nCPU: ${data.cpuUsagePercent}% | Mem: ${data.memUsagePercent}%`}
        >
            {/* Top Section - Name and basic info */}
            <div className="flex justify-between items-start w-full">
                <span className="text-[9px] font-bold leading-none truncate w-full block">
                    {data.name.replace('app-worker-', 'W-')}
                </span>
            </div>

            {/* Micro Block for WhaTap Trace detection */}
            {data.hasTrace && (
                <div className="absolute top-1 right-1">
                    <Activity className="w-3 h-3 opacity-60 animate-pulse" />
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
