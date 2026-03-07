import React from 'react';
import { Handle, Position } from 'reactflow';
import { Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { terminatePod } from '@/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PodNodeProps {
    id: string;
    data: { label: string; status: 'running' | 'pending' | 'failed'; namespace: string };
}

export const PodNode: React.FC<PodNodeProps> = ({ id, data }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const terminateMutation = useMutation({
        mutationFn: () => terminatePod(id),
        onSuccess: (res) => {
            toast({
                title: "Pod Terminated",
                description: res.message,
                duration: 3000,
            });
            // Trigger a refetch of topology data
            queryClient.invalidateQueries({ queryKey: ['topology'] });
        },
    });

    const statusColors = {
        running: 'bg-green-500',
        pending: 'bg-yellow-500',
        failed: 'bg-red-500',
    };

    return (
        <div className="flex flex-col items-center group relative cursor-pointer">
            <Handle type="target" position={Position.Top} className="w-2 h-2" />
            <div className="w-10 h-10 bg-card border border-border rounded-full shadow-md flex items-center justify-center relative z-10 hover:border-primary transition-colors">
                <Box className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-background ${statusColors[data.status]}`}></span>
            </div>
            <div className="mt-2 text-[10px] whitespace-nowrap bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{data.label}</div>

            {/* Hover action to terminate Pod */}
            <div className="absolute top-12 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                <button
                    onClick={(e) => { e.stopPropagation(); terminateMutation.mutate(); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] px-2 py-1 rounded shadow"
                    disabled={terminateMutation.isPending}
                >
                    {terminateMutation.isPending ? 'Terminating...' : 'Force Kill'}
                </button>
            </div>
        </div>
    );
}
