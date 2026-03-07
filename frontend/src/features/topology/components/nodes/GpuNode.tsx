import React from 'react';
import { Handle, Position } from 'reactflow';
import { Cpu } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GpuNodeProps {
    data: { label: string; status: 'healthy' | 'warning' | 'critical' };
}

export const GpuNode: React.FC<GpuNodeProps> = ({ data }) => {
    const statusColors = {
        healthy: 'border-green-500/50',
        warning: 'border-yellow-500/50',
        critical: 'border-red-500/50',
    };

    return (
        <Card className={cn("px-4 py-2 border-2 bg-card/80 backdrop-blur min-w-[150px] flex flex-col items-center justify-center gap-2", statusColors[data.status])}>
            <Handle type="target" position={Position.Top} className="w-2 h-2" />
            <Cpu className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-semibold text-center">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
        </Card>
    );
}
