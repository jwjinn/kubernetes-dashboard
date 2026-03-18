import React from 'react';
import { Handle, Position } from 'reactflow';
import { Cpu } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getEnv } from '@/config/env';

interface GpuNodeProps {
    data: { label: string; status: 'healthy' | 'warning' | 'critical' };
}

export const GpuNode: React.FC<GpuNodeProps> = ({ data }) => {
    const isNpu = getEnv('VITE_ACCELERATOR_TYPE', 'GPU') === 'NPU';
    const statusColors = {
        healthy: 'border-green-500/50',
        warning: 'border-yellow-500/50',
        critical: 'border-red-500/50',
    };

    return (
        <Card className={cn("px-4 py-2 border-2 bg-card/80 backdrop-blur min-w-[150px] flex flex-col items-center justify-center gap-2", statusColors[data.status])}>
            <Handle type="target" position={Position.Top} className="w-2 h-2" />
            <Cpu className={cn("w-5 h-5", isNpu ? "text-emerald-500" : "text-indigo-500")} />
            <span className="text-xs font-semibold text-center">
                {isNpu ? data.label.replace(/GPU/g, 'NPU') : data.label}
            </span>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
        </Card>
    );
}
