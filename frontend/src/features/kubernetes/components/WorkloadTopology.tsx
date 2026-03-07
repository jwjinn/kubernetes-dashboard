import React from 'react';
import ReactFlow, { Background, Controls, type Node, type Edge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';

import { useQuery } from '@tanstack/react-query';
import { fetchWorkloadTopology } from '@/api';

export function WorkloadTopology() {
    const { data, isLoading } = useQuery({
        queryKey: ['workloadTopology'],
        queryFn: fetchWorkloadTopology
    });

    if (isLoading) {
        return <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground transition-all duration-300">Building workload graph...</div>;
    }

    const initialNodes = data?.nodes || [];
    const initialEdges = data?.edges || [];

    return (
        <Card className="w-full h-full min-h-[500px] border border-border shadow-sm overflow-hidden relative p-0 bg-muted/10">
            <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur p-2 rounded-md border border-border shadow-sm">
                <h3 className="font-semibold text-sm">Deployment Architecture</h3>
            </div>
            <ReactFlow
                nodes={initialNodes}
                edges={initialEdges}
                fitView
            >
                <Background color="#ccc" gap={16} />
                <Controls />
            </ReactFlow>
        </Card>
    );
}
