import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { fetchTopologyData } from '@/api';
import { useFilterStore } from '@/store/filterStore';
import { ServerNode } from './nodes/ServerNode';
import { GpuNode } from './nodes/GpuNode';
import { PodNode } from './nodes/PodNode';
import { Card } from '@/components/ui/card';

const nodeTypes = {
    serverNode: ServerNode,
    gpuNode: GpuNode,
    podNode: PodNode,
};

export function TopologyMap() {
    const { selectedCluster } = useFilterStore();
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['topology', selectedCluster, selectedNodeId],
        queryFn: () => fetchTopologyData(selectedCluster, selectedNodeId)
    });

    const defaultNodes = useMemo<Node[]>(() => data?.nodes || [], [data]);
    const defaultEdges = useMemo<Edge[]>(() => data?.edges || [], [data]);

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        // Only allow clicking on server nodes to filter
        if (node.type === 'serverNode') {
            setSelectedNodeId(node.id);
        }
    };

    if (isLoading) {
        return <Card className="w-full h-[600px] flex items-center justify-center text-muted-foreground animate-pulse">Loading Topology Map...</Card>;
    }

    return (
        <Card className="w-full h-[600px] border border-border shadow-sm overflow-hidden relative">
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-background/80 backdrop-blur p-2 rounded-md border border-border shadow-sm">
                    <h2 className="font-semibold text-sm">Cluster Topology (Node GPU Pod)</h2>
                    {selectedNodeId && <p className="text-[10px] text-primary font-bold mt-1">Filtering by: {selectedNodeId}</p>}
                </div>
                {selectedNodeId && (
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md shadow-sm hover:bg-primary/90 transition-colors w-fit font-bold"
                    >
                        전체 보기 (Show All)
                    </button>
                )}
            </div>
            <div className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur p-2 rounded-md border border-border shadow-sm text-[10px] text-muted-foreground">
                노드를 클릭하면 해당 서버의 상세 자원만 볼 수 있습니다.
            </div>
            <ReactFlow
                nodes={defaultNodes}
                edges={defaultEdges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                key={selectedNodeId || 'all'} // Force re-render/re-fit on selection change
                className="bg-muted/10 min-h-[600px]"
                nodesDraggable={false}
            >
                <Background color="#ccc" gap={16} />
                <Controls />
            </ReactFlow>
        </Card>
    );
}
