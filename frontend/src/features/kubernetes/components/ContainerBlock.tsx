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
    resourceType?: 'NPU' | 'CPU';
    status: 'healthy' | 'warning' | 'failed';
    statusReason?: string;
    cpuRequest: number;
    hasCpuRequest?: boolean;
    cpuUsagePercent: number;
    memRequestBytes?: number;
    hasMemRequest?: boolean;
    memUsagePercent: number;
    npuRequest?: number;
    podNpuObservedPercent?: number;
    podNpuObservedDevices?: number;
    nodeNpuCapacity?: number;
    nodeNpuActive?: number;
    nodeNpuObservedPercent?: number;
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
    const isNpu = data.resourceType === 'NPU';
    const isWarning = data.status === 'warning';
    const isFailed = data.status === 'failed';

    const getCardColor = () => {
        if (isFailed) return 'bg-red-50 border-red-500 text-red-950';
        if (isWarning) return 'bg-amber-100 border-amber-500 text-amber-950';
        if (isNpu) return 'bg-indigo-100 border-indigo-400 text-indigo-950';
        return 'bg-emerald-100 border-emerald-400 text-emerald-950';
    };

    const getStatusBadge = () => {
        if (isFailed) return { label: 'Failed', className: 'bg-red-500 text-white' };
        if (isWarning) return { label: 'Warning', className: 'bg-amber-400 text-amber-950' };
        return { label: isNpu ? 'NPU' : 'CPU', className: isNpu ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white' };
    };

    const formatPercent = (value: number, hasRequest?: boolean) => {
        if (value < 0 || hasRequest === false) return 'N/A';
        return `${value}%`;
    };

    const meterWidth = (value: number, hasRequest?: boolean) => {
        if (value < 0 || hasRequest === false) return 0;
        return Math.max(0, Math.min(100, value));
    };

    const statusBadge = getStatusBadge();

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
                            "w-36 h-36 relative overflow-hidden group mb-1",
                            getCardColor(),
                            isHighlighted && "ring-4 ring-primary ring-offset-2 scale-105 z-10 shadow-lg",
                            isDimmed && "opacity-40 grayscale-[0.5]"
                        )}
                    >
                        <div className="flex justify-between items-start w-full gap-1">
                            <span className="text-[10px] font-bold leading-tight line-clamp-3 break-all flex-1">
                                {data.name}
                            </span>
                            {isNpu ? (
                                <Zap className="w-3 h-3 text-indigo-600 shrink-0" fill="currentColor" />
                            ) : (
                                <Cpu className="w-3 h-3 text-emerald-700 shrink-0" />
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", statusBadge.className)}>
                                {statusBadge.label}
                            </span>
                            {isWarning && <Info className="w-3 h-3 text-amber-700" />}
                        </div>

                        {data.hasTrace && (
                            <div className="absolute top-10 right-2">
                                <Activity className="w-3 h-3 opacity-70 animate-pulse text-foreground" />
                            </div>
                        )}

                        <div className="mt-auto pt-1">
                            <div className="flex flex-col gap-1 opacity-95">
                                <div className="flex justify-between items-center text-[9px] font-bold">
                                    <span>CPU</span>
                                    <span>{formatPercent(data.cpuUsagePercent, data.hasCpuRequest)}</span>
                                </div>
                                <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                                    <div className={cn("h-full transition-all duration-500", isNpu ? 'bg-indigo-700/80' : 'bg-emerald-700/80')} style={{ width: `${meterWidth(data.cpuUsagePercent, data.hasCpuRequest)}%` }} />
                                </div>

                                <div className="flex justify-between items-center text-[9px] mt-0.5 font-bold">
                                    <span>MEM</span>
                                    <span>{formatPercent(data.memUsagePercent, data.hasMemRequest)}</span>
                                </div>
                                <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                                    <div className={cn("h-full transition-all duration-500", isNpu ? 'bg-indigo-500/80' : 'bg-emerald-500/80')} style={{ width: `${meterWidth(data.memUsagePercent, data.hasMemRequest)}%` }} />
                                </div>

                                {isNpu ? (
                                    <>
                                        <div className="flex justify-between items-center text-[9px] mt-0.5 font-bold">
                                            <span>NPU</span>
                                            <span>{data.podNpuObservedPercent ?? 0}%</span>
                                        </div>
                                        <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-violet-600/85 h-full transition-all duration-500" style={{ width: `${meterWidth(data.podNpuObservedPercent ?? 0, true)}%` }} />
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>

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
                            <span className="text-muted-foreground">Status Reason</span>
                            <span className="font-medium">{data.statusReason || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Network TX</span>
                            <span className="font-medium">{data.txCount.toLocaleString()}</span>
                        </div>
                        {isNpu && (
                            <>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Observed NPU Util</span>
                                    <span className="font-medium">{data.podNpuObservedPercent ?? 0}%</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Observed NPU Devices</span>
                                    <span className="font-medium">{data.podNpuObservedDevices ?? 0}</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Info className="w-3 h-3" />
                        <span>{isNpu ? 'NPU workload shows pod-level observed NPU utilization.' : 'Click to view detailed metrics'}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
