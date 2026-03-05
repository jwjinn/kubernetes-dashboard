import React from 'react';
import { Handle, Position } from 'reactflow';
import { Server } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ServerNodeProps {
    data: { label: string; status: 'healthy' | 'warning' | 'critical' };
}

export const ServerNode: React.FC<ServerNodeProps> = ({ data }) => {
    const statusColors = {
        healthy: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
        warning: 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
        critical: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
    };

    return (
        <Card className={cn("w-64 p-4 border-2 shadow-lg", statusColors[data.status])}>
            <Handle type="target" position={Position.Top} className="w-2 h-2" />
            <div className="flex items-center gap-3">
                <Server className="w-6 h-6" />
                <div>
                    <h3 className="font-bold text-sm">{data.label}</h3>
                    <p className="text-xs opacity-80 capitalize">{data.status} Server</p>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
        </Card>
    );
}
