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

    // Diagnosis & Events endpoints
    http.get('/api/k8s/events', () => {
        const events = [
            { id: 1, type: 'Warning', reason: 'FailedScheduling', message: '0/4 nodes are available: 4 Insufficient gpu.', count: 42, lastTimestamp: '10m', component: 'default-scheduler', object: 'Pod/training-job-v2' },
            { id: 2, type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container', count: 12, lastTimestamp: '2m', component: 'kubelet, node-2', object: 'Pod/app-worker-A-2' },
            { id: 3, type: 'Normal', reason: 'Scheduled', message: 'Successfully assigned default/app-worker-B-1 to node-1', count: 1, lastTimestamp: '15m', component: 'default-scheduler', object: 'Pod/app-worker-B-1' },
            { id: 4, type: 'Warning', reason: 'Unhealthy', message: 'Liveness probe failed: HTTP probe failed with statuscode: 500', count: 5, lastTimestamp: '1m', component: 'kubelet, node-0', object: 'Pod/app-worker-A-0' },
            { id: 5, type: 'Warning', reason: 'OOMKilled', message: 'Container used more memory than requested and was killed', count: 1, lastTimestamp: '30s', component: 'kubelet, node-3', object: 'Pod/app-worker-D-3' },
            { id: 6, type: 'Normal', reason: 'Pulled', message: 'Successfully pulled image "nvidia/cuda:11.0-base"', count: 1, lastTimestamp: '12m', component: 'kubelet, node-1', object: 'Pod/app-worker-B-1' },
        ];
        return HttpResponse.json(events);
    }),

    http.get('/api/k8s/startup-analysis', () => {
        const analysis = {
            podName: 'app-worker-A-2',
            status: 'Pending (ImagePullBackOff)',
            phases: [
                { name: 'Scheduled', duration: 1.2, status: 'completed', timestamp: '2026-03-05 16:30:12' },
                { name: 'Initialized', duration: 0.5, status: 'completed', timestamp: '2026-03-05 16:30:13' },
                { name: 'ImagePulling', duration: 45.0, status: 'failed', timestamp: '2026-03-05 16:30:13' },
                { name: 'ContainerStarting', duration: 0, status: 'pending', timestamp: '-' },
            ],
            diagnosis: {
                severity: 'Critical',
                cause: '네트워크 대역폭 제한 및 프라이빗 레지스트리 인증 실패',
                recommendation: '현재 node-2의 아웃바운드 트래픽이 임계치를 초과했습니다. 이미지 캐시 서버(Harbor)의 가용성을 확인하고, ImagePullPolicy를 "IfNotPresent"로 설정하여 중복 다운로드를 방지하세요.'
            }
        };
        return HttpResponse.json(analysis);
    }),

    // Container Map endpoints
    http.get('/api/k8s/containers', () => {
        // Build 16 containers (4 per node) to stay consistent with the 8-GPU scale
        const containers = Array.from({ length: 16 }).map((_, i) => ({
            id: `container-${i}`,
            name: `app-worker-${String.fromCharCode(65 + (i % 4))}-${Math.floor(i / 4)}`,
            namespace: NAMESPACES[i % NAMESPACES.length],
            node: CLUSTER_NODES[Math.floor(i / 4)],
            resourceType: (i % 4 < 2) ? 'GPU' : 'CPU',
            status: (i % 5 === 0) ? 'warning' : (i % 8 === 0) ? 'failed' : 'healthy', // Intentional status distribution
            cpuUsagePercent: Math.floor(20 + Math.random() * 60),
            memUsagePercent: Math.floor(30 + Math.random() * 50),
            txCount: Math.floor(Math.random() * 1000),
            hasTrace: Math.random() > 0.7,
            cpuRequest: 500,
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
];
