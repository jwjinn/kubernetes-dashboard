import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Cpu, Zap, Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
    image?: string;
    serviceName?: string;
    volume?: { type: string, path: string };
}

interface ContainerBlockProps {
    data: ContainerData;
    onClick: (data: ContainerData) => void;
    isHighlighted?: boolean;
    isDimmed?: boolean;
    onHover?: (name: string | null) => void;
}

export function ContainerBlock({ data, onClick, isHighlighted, isDimmed, onHover }: ContainerBlockProps) {
    // Determine color based on status and resource usage
    const getStatusColor = () => {
        if (data.status === 'failed') return 'bg-red-500 border-red-700 text-white';
        if (data.status === 'warning') return 'bg-yellow-400 border-yellow-600 text-yellow-900';

        if (data.resourceType === 'GPU') {
            if (data.cpuUsagePercent > 70) return 'bg-indigo-600 border-indigo-800 text-white';
            if (data.cpuUsagePercent > 40) return 'bg-indigo-500 border-indigo-700 text-white';
            return 'bg-indigo-400 border-indigo-600 text-indigo-950';
        }

        if (data.cpuUsagePercent > 70) return 'bg-emerald-600 border-emerald-800 text-white';
        if (data.cpuUsagePercent > 40) return 'bg-emerald-500 border-emerald-700 text-white';
        return 'bg-emerald-400 border-emerald-600 text-emerald-950';
    };

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div
                        onClick={() => onClick(data)}
                        onMouseEnter={() => onHover?.(data.id)}
                        onMouseLeave={() => onHover?.(null)}
                        className={cn(
                            "cursor-pointer rounded-md border p-2 flex flex-col justify-between transition-all duration-200 shadow-sm",
                            "w-28 h-28 relative overflow-hidden group mb-1",
                            getStatusColor(),
                            isHighlighted && "ring-4 ring-primary ring-offset-2 scale-105 z-10 shadow-lg",
                            isDimmed && "opacity-40 grayscale-[0.5]"
                        )}
                    >
                        {/* Top Section - Full Name with truncation */}
                        <div className="flex justify-between items-start w-full gap-1">
                            <span className="text-[10px] font-bold leading-tight line-clamp-3 break-all flex-1">
                                {data.name}
                            </span>
                            {data.resourceType === 'GPU' ? (
                                <Zap className="w-3 h-3 text-yellow-300 shrink-0" fill="currentColor" />
                            ) : (
                                <Cpu className="w-3 h-3 opacity-60 shrink-0" />
                            )}
                        </div>

                        {/* WhaTap Trace Icon */}
                        {data.hasTrace && (
                            <div className="absolute top-10 right-2">
                                <Activity className="w-3 h-3 opacity-70 animate-pulse text-white" />
                            </div>
                        )}

                        {/* Bottom Section - Metrics */}
                        <div className="mt-auto pt-1">
                            <div className="flex flex-col gap-1 opacity-95">
                                <div className="flex justify-between items-center text-[9px] font-bold">
                                    <span>CPU</span>
                                    <span>{data.cpuUsagePercent}%</span>
                                </div>
                                <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-white/90 h-full transition-all duration-500" style={{ width: `${data.cpuUsagePercent}%` }} />
                                </div>

                                <div className="flex justify-between items-center text-[9px] mt-0.5 font-bold">
                                    <span>MEM</span>
                                    <span>{data.memUsagePercent}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-3 w-64 space-y-2 border-border shadow-xl">
                    <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-bold text-sm truncate mr-2">{data.name}</span>
                        <div className={cn("w-2 h-2 rounded-full", data.status === 'healthy' ? 'bg-emerald-500' : data.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500')} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Namespace</span>
                            <span className="font-medium truncate">{data.namespace}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Node</span>
                            <span className="font-medium">{data.node}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Type</span>
                            <span className="font-medium">{data.resourceType}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Network TX</span>
                            <span className="font-medium">{data.txCount.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Info className="w-3 h-3" />
                        <span>Click to view detailed metrics</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
