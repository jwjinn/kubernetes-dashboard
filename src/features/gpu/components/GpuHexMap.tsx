import React, { useMemo } from 'react';

export interface GpuDevice {
    id: string;
    node: string;
    type: 'P' | 'M'; // Physical or MIG
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
}

// SVG style honeycomb generator
interface GpuHexMapProps {
    data: GpuDevice[];
    selectedNode?: string | null;
    onNodeSelect?: (nodeName: string | null) => void;
}

export function GpuHexMap({ data, selectedNode, onNodeSelect }: GpuHexMapProps) {

    // Color logic
    const getColor = (device: GpuDevice) => {
        if (device.status === 'Error') return 'bg-red-500 text-white';
        if (device.status === 'Idle') return 'bg-gray-300 text-gray-500';

        // Active - color based on util
        if (device.utilization > 80) return 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.8)]'; // High utilization glow
        if (device.utilization > 40) return 'bg-blue-500 text-white';
        return 'bg-blue-400 text-white';
    };

    // Group devices by node
    const groupedData = data.reduce((acc, device) => {
        if (!acc[device.node]) acc[device.node] = [];
        acc[device.node].push(device);
        return acc;
    }, {} as Record<string, GpuDevice[]>);

    return (
        <div className="flex flex-col gap-6 p-4 w-full h-full overflow-y-auto">
            {Object.entries(groupedData).map(([nodeName, devices]) => (
                <div
                    key={nodeName}
                    onClick={() => onNodeSelect && onNodeSelect(selectedNode === nodeName ? null : nodeName)}
                    className={`border rounded-lg p-4 shadow-sm cursor-pointer transition-colors ${selectedNode === nodeName ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500' : 'border-border bg-background hover:bg-muted/50'
                        }`}
                >
                    <h4 className={`text-sm font-semibold mb-3 border-b pb-2 ${selectedNode === nodeName ? 'border-blue-500/30 text-blue-700' : 'border-border text-muted-foreground'}`}>
                        Physical Node: {nodeName}
                    </h4>
                    {/* Hexagon grid approximation using staggered flex wrap */}
                    <div className="flex flex-wrap gap-1">
                        {devices.map((device) => (
                            <div
                                key={device.id}
                                className={`
                                    relative w-12 h-14 ${getColor(device)} 
                                    flex items-center justify-center font-bold text-sm cursor-pointer
                                    transition-transform hover:scale-110
                                    clip-hexagon
                                `}
                                // A rough CSS clip path for hexagon
                                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                                title={`Node: ${device.node}\nType: ${device.type === 'P' ? 'Physical' : 'MIG'}\nStatus: ${device.status}\nUtil: ${device.utilization}%`}
                            >
                                {device.type}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
