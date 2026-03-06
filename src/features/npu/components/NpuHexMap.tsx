import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface NpuDevice {
    id: string;
    node: string;
    model: string;
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    uuid: string;
    namespace: string;
    pod: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
}

interface NpuHexMapProps {
    data: NpuDevice[];
    selectedNode: string | null;
    onNodeSelect: (nodeId: string | null) => void;
    groupBy: 'None' | 'Node';
    colorBy: 'Status' | 'NPU Utilization';
}

export function NpuHexMap({ data, selectedNode, onNodeSelect, groupBy, colorBy }: NpuHexMapProps) {
    const getColor = (device: NpuDevice) => {
        if (colorBy === 'Status') {
            switch (device.status) {
                case 'Active': return 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.6)]';
                case 'Idle': return 'bg-gray-400 hover:bg-gray-500 text-white';
                case 'Error': return 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]';
                default: return 'bg-gray-200';
            }
        } else {
            const util = device.utilization;
            if (util === 0) return 'bg-gray-100 dark:bg-gray-800 border border-border';
            if (util >= 80) return 'bg-green-700 hover:bg-green-800 text-white shadow-[0_0_12px_rgba(21,128,61,0.8)] z-10';
            if (util >= 60) return 'bg-green-600 hover:bg-green-700 text-white';
            if (util >= 40) return 'bg-green-500 hover:bg-green-600 text-white';
            if (util >= 20) return 'bg-green-400 hover:bg-green-500 text-white';
            return 'bg-green-300 hover:bg-green-400 text-white';
        }
    };

    const groupedData = useMemo(() => {
        if (groupBy === 'None') return { 'All NPUs': data };
        const groups: Record<string, NpuDevice[]> = {};
        data.forEach(d => {
            if (!groups[d.node]) groups[d.node] = [];
            groups[d.node].push(d);
        });
        return groups;
    }, [data, groupBy]);

    return (
        <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pb-8 pr-2">
            {Object.entries(groupedData).map(([node, devices]) => (
                <div
                    key={node}
                    className={`rounded-lg p-4 transition-colors border shadow-sm cursor-pointer ${selectedNode === node ? 'bg-green-50 dark:bg-green-950/20 border-green-500 ring-1 ring-green-500' : 'bg-background border-border hover:border-gray-400'
                        }`}
                    onClick={() => onNodeSelect(selectedNode === node ? null : node)}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-bold ${selectedNode === node ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                            {node}
                        </h4>
                        <Badge variant="outline" className="text-[10px] py-0">{devices.length} UNITS</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 pt-1">
                        {devices.map((device) => (
                            <TooltipProvider key={device.uuid} delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`relative w-8 h-9 flex items-center justify-center font-bold text-[10px] transition-all duration-300 hover:scale-110 hover:z-20 ${getColor(device)}`}
                                            style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
                                        >
                                            {device.id.split('-').pop()}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="p-3 bg-background/95 backdrop-blur border border-border shadow-xl z-50">
                                        <div className="space-y-1.5 text-xs min-w-[150px]">
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-muted-foreground">ID</span>
                                                <span className="font-mono font-bold">{device.id}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-muted-foreground">Model</span>
                                                <span>{device.model}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-muted-foreground">Util</span>
                                                <span className="font-bold text-green-600">{device.utilization}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Pod</span>
                                                <span className="truncate max-w-[80px]">{device.pod || '-'}</span>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
