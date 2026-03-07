import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Layers, Server, Container, Workflow } from 'lucide-react';

interface ResourceRelationshipTabProps {
    podId: string | null;
}

// Custom Node Component to match dashboard styling
const CustomNode = ({ data }: any) => {
    const Icon = data.icon;
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-indigo-100 flex flex-col items-center justify-center min-w-[150px]">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
                <Icon className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xs font-bold text-gray-800">{data.label}</div>
            <div className="text-[10px] text-gray-500">{data.subLabel}</div>
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

export function ResourceRelationshipTab({ podId }: ResourceRelationshipTabProps) {
    if (!podId) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground italic">
                Select a pod to view its resource relationships.
            </div>
        );
    }

    // Generate mock graph data based on the podId
    const { nodes, edges } = useMemo(() => {
        const podNameStr = podId.split('-')[1] || 'demo'; // Quick mock generation

        const initialNodes: Node[] = [
            {
                id: 'ns-1',
                type: 'custom',
                position: { x: 250, y: 50 },
                data: { label: 'Namespace', subLabel: 'default', icon: Layers },
            },
            {
                id: 'deploy-1',
                type: 'custom',
                position: { x: 250, y: 150 },
                data: { label: 'Deployment', subLabel: `deploy-${podNameStr}`, icon: Workflow },
            },
            {
                id: 'rs-1',
                type: 'custom',
                position: { x: 250, y: 250 },
                data: { label: 'ReplicaSet', subLabel: `rs-${podNameStr}-1a2b`, icon: Server },
            },
            {
                id: 'pod-1',
                type: 'custom',
                position: { x: 250, y: 350 },
                data: { label: 'Pod', subLabel: `pod-${podNameStr}-xyz`, icon: Box },
            },
            {
                id: 'container-1',
                type: 'custom',
                position: { x: 250, y: 450 },
                data: { label: 'Container', subLabel: `container-${podNameStr}`, icon: Container },
            },
        ];

        const initialEdges: Edge[] = [
            { id: 'e1', source: 'ns-1', target: 'deploy-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' }, style: { stroke: '#4f46e5' } },
            { id: 'e2', source: 'deploy-1', target: 'rs-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' }, style: { stroke: '#4f46e5' } },
            { id: 'e3', source: 'rs-1', target: 'pod-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' }, style: { stroke: '#4f46e5' } },
            { id: 'e4', source: 'pod-1', target: 'container-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' }, style: { stroke: '#4f46e5' } },
        ];

        return { nodes: initialNodes, edges: initialEdges };
    }, [podId]);

    return (
        <div className="h-full w-full bg-slate-50/50 rounded-xl overflow-hidden border border-border">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.5}
                maxZoom={1.5}
                attributionPosition="bottom-right"
            >
                <Background color="#ccc" gap={16} size={1} />
                <Controls className="bg-white border-border shadow-sm" />
            </ReactFlow>
        </div>
    );
}
