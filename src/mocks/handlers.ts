import { http, HttpResponse } from 'msw';

// --- CENTRALIZED CLUSTER STATE ---
const CLUSTER_NODES = ['node-0', 'node-1', 'node-2', 'node-3'];
const NAMESPACES = ['kube-system', 'prod-backend', 'ai-training'];

// GPU Device Definition
export interface GpuDevice {
    id: string;
    node: string;
    model: string;
    type: 'P' | 'M';
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    uuid: string;
}

const generateInitialGpuDevices = (): GpuDevice[] => {
    const devices: GpuDevice[] = [];
    const model = 'NVIDIA A100'; // Standardized for demo

    // 4 nodes * 2 GPUs = 8 devices total
    for (let i = 0; i < 8; i++) {
        const node = CLUSTER_NODES[Math.floor(i / 2)];

        devices.push({
            id: `dev-${i}`,
            node: node,
            model: model,
            type: Math.random() > 0.5 ? 'P' : 'M', // Mixed for visualization
            status: Math.random() > 0.1 ? 'Active' : 'Idle',
            utilization: Math.floor(Math.random() * 100),
            uuid: `GPU-${Math.random().toString(36).substring(2, 10)}-${i}`
        });
    }
    return devices;
};

const STATIC_GPU_DEVICES = generateInitialGpuDevices();

// --- MOCK CONSTANTS & HELPERS ---
const getClusterSummary = () => {
    const total = STATIC_GPU_DEVICES.length;
    const used = STATIC_GPU_DEVICES.filter(d => d.status === 'Active').length;
    const idle = STATIC_GPU_DEVICES.filter(d => d.status === 'Idle').length;
    return {
        totalGpu: total,
        usedGpu: used,
        idleGpu: idle,
        temperature: 72,
        healthStatus: 'Healthy'
    };
};

const clusterSummaryMap: Record<string, any> = {
    'all-clusters': getClusterSummary(),
    'cluster-seoul': getClusterSummary(),
};

const generateTopologyData = (clusterId: string, focusNodeId?: string | null) => {
    const nodes: any[] = [];
    const edges: any[] = [];

    const nodesToRender = focusNodeId && focusNodeId !== 'all'
        ? CLUSTER_NODES.filter(id => id === focusNodeId)
        : CLUSTER_NODES;

    // Core Servers (Physical Nodes)
    nodesToRender.forEach((nodeId, idx) => {
        const xOffset = idx * 600; // Wide spacing for nodes

        nodes.push({
            id: nodeId,
            type: 'serverNode',
            position: { x: xOffset + 100, y: 50 },
            data: { label: `Server: ${nodeId}`, status: 'healthy' }
        });

        // Add GPU links per node
        const nodeGpus = STATIC_GPU_DEVICES.filter(d => d.node === nodeId);
        nodeGpus.forEach((gpu, gIdx) => {
            // Arrange 2 GPUs side-by-side per node
            nodes.push({
                id: gpu.id,
                type: 'gpuNode',
                position: {
                    x: xOffset + gIdx * 200,
                    y: 200
                },
                data: { label: `${gpu.model}`, status: 'healthy' }
            });
            edges.push({ id: `e-${nodeId}-${gpu.id}`, source: nodeId, target: gpu.id, animated: true });
        });
    });

    return { nodes, edges };
};

const generateResourceMetrics = () => {
    const times = [];
    const cpu = [];
    const memory = [];
    let baseTime = new Date().getTime() - 3600000;
    for (let i = 0; i < 60; i++) {
        times.push(new Date(baseTime).toLocaleTimeString());
        cpu.push(Math.floor(Math.random() * 100));
        memory.push(Math.floor(40 + Math.random() * 40));
        baseTime += 60000;
    }
    return { times, cpu, memory };
};

// Generate Trend Data (Time-series)
const generateGpuTrends = () => {
    return STATIC_GPU_DEVICES.map(device => {
        const dailyUtils = Array.from({ length: 31 }).map(() => Math.floor(Math.random() * 100));
        return {
            deviceId: device.id,
            label: `${device.node} / ${device.model} / ${device.id}`,
            uuid: device.uuid,
            history: dailyUtils // 31 days of data
        };
    });
};

const STATIC_GPU_TRENDS = generateGpuTrends();

export const handlers = [
    http.get('/api/clusters/summary', ({ request }) => {
        const url = new URL(request.url);
        const clusterId = url.searchParams.get('cluster') || 'all-clusters';
        const summary = clusterSummaryMap[clusterId] || clusterSummaryMap['all-clusters'];
        return HttpResponse.json(summary);
    }),

    http.get('/api/topology', ({ request }) => {
        const url = new URL(request.url);
        const clusterId = url.searchParams.get('cluster') || 'all-clusters';
        const nodeId = url.searchParams.get('nodeId');
        return HttpResponse.json(generateTopologyData(clusterId, nodeId));
    }),

    http.post('/api/pods/:podId/terminate', ({ params }) => {
        return HttpResponse.json({ success: true, message: `Pod ${params.podId} successfully terminated.` }, { status: 200 });
    }),

    // Container Map endpoints
    http.get('/api/k8s/containers', () => {
        // Build containers based on the central nodes - rich environment
        const containers = Array.from({ length: 40 }).map((_, i) => ({
            id: `container-${i}`,
            name: `app-worker-${i}`,
            namespace: NAMESPACES[Math.floor(Math.random() * NAMESPACES.length)],
            node: CLUSTER_NODES[Math.floor(Math.random() * CLUSTER_NODES.length)],
            status: Math.random() > 0.1 ? 'healthy' : 'warning',
            cpuUsagePercent: Math.floor(Math.random() * 100),
            memUsagePercent: Math.floor(Math.random() * 100),
        }));
        return HttpResponse.json(containers);
    }),

    // Resource Details View
    http.get('/api/k8s/metrics/:containerId', () => {
        return HttpResponse.json(generateResourceMetrics());
    }),

    // GPU Mock Endpoints
    http.get('/api/gpu/devices', () => {
        return HttpResponse.json(STATIC_GPU_DEVICES);
    }),

    http.get('/api/gpu/trends', () => {
        return HttpResponse.json(STATIC_GPU_TRENDS);
    }),

    // Workload Topology (Deployment -> Node link)
    http.get('/api/workloads/topology', () => {
        const nodes = [
            { id: 'dep-1', type: 'default', position: { x: 250, y: 5 }, data: { label: 'Deployment: ai-inference-service' }, style: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' } },
            { id: 'pod-1', type: 'default', position: { x: 100, y: 150 }, data: { label: 'Pod: worker-a' }, style: { background: '#dcfce7', borderColor: '#22c55e', borderRadius: '8px' } },
            { id: 'pod-2', type: 'default', position: { x: 400, y: 150 }, data: { label: 'Pod: worker-b' }, style: { background: '#dcfce7', borderColor: '#22c55e', borderRadius: '8px' } },
            // Maps to node-0 and node-1
            { id: 'n-0', type: 'default', position: { x: 100, y: 300 }, data: { label: `Node: ${CLUSTER_NODES[0]}` }, style: { border: '2px dashed #94a3b8' } },
            { id: 'n-1', type: 'default', position: { x: 400, y: 300 }, data: { label: `Node: ${CLUSTER_NODES[1]}` }, style: { border: '2px dashed #94a3b8' } },
        ];
        const edges = [
            { id: 'e1', source: 'dep-1', target: 'pod-1', animated: true },
            { id: 'e2', source: 'dep-1', target: 'pod-2', animated: true },
            { id: 'e3', source: 'pod-1', target: 'n-0', label: 'scheduled' },
            { id: 'e4', source: 'pod-2', target: 'n-1', label: 'scheduled' },
        ];
        return HttpResponse.json({ nodes, edges });
    })
];
