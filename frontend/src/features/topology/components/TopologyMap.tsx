import React from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { fetchTopologyData } from '@/api';
import { useFilterStore } from '@/store/filterStore';
import { ServerNode } from './nodes/ServerNode';
import { GpuNode } from './nodes/GpuNode';
import { PodNode } from './nodes/PodNode';
import { Card } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { getEnv } from '@/config/env';

const nodeTypes = {
    serverNode: ServerNode,
    gpuNode: GpuNode,
    podNode: PodNode,
};

export function TopologyMap() {
    const { selectedCluster } = useFilterStore();
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const [hasAutoFocused, setHasAutoFocused] = React.useState(false);
    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU');
    const acceleratorLabel = acceleratorMode === 'NPU' ? 'NPU' : 'GPU';

    const { data, isLoading } = useQuery({
        queryKey: ['topology', selectedCluster, selectedNodeId],
        queryFn: () => fetchTopologyData(selectedCluster, selectedNodeId)
    });

    React.useEffect(() => {
        if (hasAutoFocused || selectedNodeId || !data?.nodes?.length) {
            return;
        }

        const serverNodes = data.nodes.filter((node: Node) => node.type === 'serverNode');
        if (serverNodes.length === 0) {
            return;
        }

        const preferredNode =
            serverNodes.find((node: Node) => String(node.data?.label || '').toLowerCase().includes('worker')) ||
            serverNodes[0];

        setSelectedNodeId(preferredNode.id);
        setHasAutoFocused(true);
    }, [data, hasAutoFocused, selectedNodeId]);

    React.useEffect(() => {
        setSelectedNodeId(null);
        setHasAutoFocused(false);
    }, [selectedCluster]);

    const defaultNodes: Node[] = data?.nodes || [];
    const defaultEdges: Edge[] = data?.edges || [];

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
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
                    <div className="flex items-center">
                        <h2 className="font-semibold text-sm">Cluster Topology (Node {acceleratorLabel} Pod)</h2>
                        <InfoTooltip content={`노드 중심으로 ${acceleratorLabel} 자원과 Pod 배치를 따라가며 볼 수 있는 토폴로지입니다. 기본적으로 한 번에 한 노드에 집중해서 보여주며, 상단의 전체 보기로 전체 배치도 다시 볼 수 있습니다.`} />
                    </div>
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
                기본적으로 노드 단위로 집중해서 보며, 다른 노드를 클릭하면 해당 노드 기준으로 다시 볼 수 있습니다.
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
