import React, { useMemo } from 'react';

export interface GpuDevice {
    id: string;
    node: string;
    type: 'P' | 'M'; // Physical or MIG
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    model: string;
    uuid: string;
    migMode: string;
    migId: string;
    migProfile: string;
    namespace: string;
    cronJob: string;
    job: string;
    pod: string;
    ready: string;
    podPhase: string;
    restartCount: number;
    age: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
}

// SVG style honeycomb generator
interface GpuHexMapProps {
    data: GpuDevice[];
    selectedNode?: string | null;
    onNodeSelect?: (nodeName: string | null) => void;
    groupBy?: 'None' | 'Node';
    colorBy?: 'Status' | 'GPU Utilization';
}

export function GpuHexMap({ data, selectedNode, onNodeSelect, groupBy = 'Node', colorBy = 'GPU Utilization' }: GpuHexMapProps) {

    // Color logic
    const getColor = (device: GpuDevice) => {
        if (device.status === 'Error') return 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] z-10';

        if (colorBy === 'Status') {
            if (device.status === 'Idle') return 'bg-gray-400 text-white';
            if (device.status === 'Active') return 'bg-blue-500 text-white';
        } else {
            // Utilization
            if (device.status === 'Idle') return 'bg-gray-400 text-white';
            if (device.utilization === 0) return 'bg-gray-100 text-gray-400 border border-border';
            if (device.utilization <= 20) return 'bg-gray-200 text-gray-500';
            if (device.utilization <= 40) return 'bg-blue-300 text-white';
            if (device.utilization <= 60) return 'bg-blue-400 text-white';
            if (device.utilization <= 80) return 'bg-blue-500 text-white';
            return 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.8)] z-10'; // High utilization glow
        }
        return 'bg-gray-300 text-gray-500';
    };

    const groupedData = React.useMemo(() => {
        if (groupBy === 'None') {
            return { 'All Devices': data };
        }
        return data.reduce((acc, device) => {
            if (!acc[device.node]) acc[device.node] = [];
            acc[device.node].push(device);
            return acc;
        }, {} as Record<string, GpuDevice[]>);
    }, [data, groupBy]);

    const renderHexGrid = (devices: GpuDevice[]) => {
        return (
            <div className="flex flex-wrap max-w-full">
                {devices.map((device, index) => {
                    // Calculate "honeycomb" offset
                    // Every second row needs a margin-left shift
                    const isEvenRow = Math.floor(index / 10) % 2 === 0;

                    return (
                        <div
                            key={device.id}
                            className={`
                                relative w-12 h-14 ${getColor(device)} 
                                flex items-center justify-center font-bold text-sm cursor-pointer
                                transition-all duration-300 hover:scale-110 hover:z-20
                                bg-clip-padding
                            `}
                            style={{
                                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                marginLeft: isEvenRow && index % 10 === 0 ? '1.5rem' : '-0.25rem',
                                marginTop: '-0.75rem',
                            }}
                            title={`Node: ${device.node}\nType: ${device.type === 'P' ? 'Physical' : 'MIG'}\nStatus: ${device.status}\nUtil: ${device.utilization}%`}
                        >
                            {device.type}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-8 w-full h-full overflow-y-auto pb-8">
            {Object.entries(groupedData).map(([nodeName, devices]) => (
                <div
                    key={nodeName}
                    onClick={() => onNodeSelect && onNodeSelect(selectedNode === nodeName ? null : nodeName)}
                    className={`rounded-lg p-6 transition-colors ${selectedNode === nodeName ? 'bg-blue-50/50 ring-1 ring-blue-500' : 'bg-transparent'}`}
                >
                    {groupBy !== 'None' && (
                        <h4 className={`text-sm font-bold mb-4 ${selectedNode === nodeName ? 'text-blue-700' : 'text-foreground'}`}>
                            {nodeName}
                        </h4>
                    )}
                    <div className="pt-2">
                        {renderHexGrid(devices)}
                    </div>
                </div>
            ))}
        </div>
    );
}
