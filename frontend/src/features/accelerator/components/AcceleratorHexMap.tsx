import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AcceleratorDevice {
    id: string;
    node: string;
    type?: 'P' | 'M' | 'C'; // Physical or MIG (GPU specific) or Core (NPU specific)
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    model: string;
    uuid: string;
    migMode?: string;
    migId?: string;
    migProfile?: string;
    namespace: string;
    cronJob?: string;
    job?: string;
    pod: string;
    ready?: string;
    podPhase?: string;
    restartCount?: number;
    age?: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
}

interface AcceleratorHexMapProps {
    data: AcceleratorDevice[];
    acceleratorType: 'GPU' | 'NPU';
    selectedNode?: string | null;
    onNodeSelect?: (nodeName: string | null) => void;
    groupBy?: 'None' | 'Node';
    colorBy?: 'Status' | 'Utilization';
    nodeAllocation?: Record<string, { allocated: number; capacity: number }>;
}

export function AcceleratorHexMap({
    data,
    acceleratorType,
    selectedNode,
    onNodeSelect,
    groupBy = 'Node',
    colorBy = 'Utilization',
    nodeAllocation = {}
}: AcceleratorHexMapProps) {

    const isNpu = acceleratorType === 'NPU';

    const getColor = (device: AcceleratorDevice) => {
        if (device.status === 'Error') return 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] z-10';

        if (colorBy === 'Status') {
            if (device.status === 'Idle') return 'bg-gray-400 hover:bg-gray-500 text-white';
            if (device.status === 'Active') {
                return isNpu ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.6)]'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.6)]';
            }
        } else {
            // Utilization
            const util = device.utilization;
            if (device.status === 'Idle' || util === 0) return 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-border';

            if (isNpu) {
                if (util >= 80) return 'bg-green-700 hover:bg-green-800 text-white shadow-[0_0_12px_rgba(21,128,61,0.8)] z-10';
                if (util >= 60) return 'bg-green-600 hover:bg-green-700 text-white';
                if (util >= 40) return 'bg-green-500 hover:bg-green-600 text-white';
                if (util >= 20) return 'bg-green-400 hover:bg-green-500 text-white';
                return 'bg-green-300 hover:bg-green-400 text-white';
            } else {
                if (util >= 80) return 'bg-blue-700 hover:bg-blue-800 text-white shadow-[0_0_12px_rgba(29,78,216,0.8)] z-10';
                if (util >= 60) return 'bg-blue-600 hover:bg-blue-700 text-white';
                if (util >= 40) return 'bg-blue-500 hover:bg-blue-600 text-white';
                if (util >= 20) return 'bg-blue-400 hover:bg-blue-500 text-white';
                return 'bg-blue-300 hover:bg-blue-400 text-white';
            }
        }
        return 'bg-gray-300 text-gray-500';
    };

    const groupedData = useMemo(() => {
        if (groupBy === 'None') {
            const label = isNpu ? 'All NPUs' : 'All GPUs';
            return { [label]: data };
        }
        return data.reduce((acc, device) => {
            if (!acc[device.node]) acc[device.node] = [];
            acc[device.node].push(device);
            return acc;
        }, {} as Record<string, AcceleratorDevice[]>);
    }, [data, groupBy, isNpu]);

    const renderHexGrid = (devices: AcceleratorDevice[]) => {
        return (
            <div className="flex flex-wrap gap-x-3 gap-y-2 pt-1 max-w-full">
                {devices.map((device, index) => {
                    // For GPU, we had a specific offset honeycomb logic, we can keep using simple wrap for both to unify
                    // But if we want to retain exact shape:
                    const isEvenRow = !isNpu && (Math.floor(index / 10) % 2 === 0);
                    const clipPath = isNpu
                        ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
                        : 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

                    // Using NPU's tooltip approach for both for better UX
                    return (
                        <TooltipProvider key={device.id} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className={`
                                            relative flex items-center justify-center font-bold transition-all duration-300 hover:scale-110 hover:z-20 cursor-pointer text-sm
                                            ${getColor(device)}
                                            ${isNpu ? 'h-10 min-w-[3.4rem] px-2 text-[12px] leading-none' : 'w-12 h-14 bg-clip-padding'}
                                        `}
                                        style={Object.assign({ clipPath }, !isNpu ? {
                                            marginLeft: isEvenRow && index % 10 === 0 ? '1.5rem' : '-0.25rem',
                                            marginTop: '-0.75rem',
                                        } : {})}
                                    >
                                        {isNpu ? device.id.replace('die', '') : (device.type || 'P')}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="p-3 bg-background/95 backdrop-blur border border-border shadow-xl z-50">
                                    <div className="text-xs min-w-[90px]">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Util</span>
                                            <span className={`font-bold ${isNpu ? 'text-green-600' : 'text-blue-600'}`}>{device.utilization}%</span>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pb-8 pr-2">
            {Object.entries(groupedData).map(([nodeName, devices]) => (
                <div
                    key={nodeName}
                    onClick={() => onNodeSelect && onNodeSelect(selectedNode === nodeName ? null : nodeName)}
                    className={`rounded-lg p-4 transition-colors border shadow-sm cursor-pointer 
                        ${selectedNode === nodeName
                            ? (isNpu ? 'bg-green-50 dark:bg-green-950/20 border-green-500 ring-1 ring-green-500' : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500')
                            : (nodeAllocation[nodeName]?.allocated ?? 0) > 0
                                ? 'bg-background border-green-300 hover:border-green-400'
                                : 'bg-background border-border hover:border-gray-400'
                        }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        {groupBy !== 'None' ? (
                            <div className="flex flex-col gap-1">
                                <h4 className={`text-sm font-bold ${selectedNode === nodeName
                                    ? (isNpu ? 'text-green-700 dark:text-green-400' : 'text-blue-700')
                                    : 'text-foreground'}`}>
                                    {nodeName}
                                </h4>
                                {isNpu && nodeAllocation[nodeName] && (
                                    <span className="text-[11px] text-muted-foreground">
                                        Kubernetes Requested {nodeAllocation[nodeName].allocated} / {nodeAllocation[nodeName].capacity}
                                    </span>
                                )}
                            </div>
                        ) : <div />}
                        <div className="flex items-center gap-2">
                            {isNpu && nodeAllocation[nodeName] && (
                                <Badge variant="outline" className="text-[10px] py-0 uppercase">
                                    {nodeAllocation[nodeName].allocated} Requested
                                </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] py-0 uppercase">
                                {devices.length} {isNpu ? 'Dies' : 'Units'}
                            </Badge>
                        </div>
                    </div>
                    {renderHexGrid(devices)}
                </div>
            ))}
        </div>
    );
}
