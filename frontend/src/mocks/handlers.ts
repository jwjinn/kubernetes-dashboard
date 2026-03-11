import { http, HttpResponse } from 'msw';

// --- CENTRALIZED CLUSTER STATE ---
const CLUSTER_NODES = ['worker-01', 'worker-02'];
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
    migMode: string;
    migId: string;
    migProfile: string;
    namespace: string;
    cronJob: string;
    job: string;
    pod: string;
    ready: string;
    podPhase: string;
    restartCount: number;
    age: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
}

const generateInitialGpuDevices = (): GpuDevice[] => {
    const devices: GpuDevice[] = [];
    const model = 'NVIDIA A100-SXM4-40GB'; // Standardized for demo
    const namespaces = ['-', 'gpu-job', 'default', 'ai-training'];
    const jobs = ['-', 'infer-learn-train', 'deep-learn-train', 'data-prep'];

    // 4 nodes * 2 GPUs (Physical only) = 8 devices total
    for (let i = 0; i < 8; i++) {
        const node = CLUSTER_NODES[Math.floor(i / 2)];
        const isMig = false; // Only Physical GPUs (PP) per user request
        const isActive = Math.random() > 0.3;
        const jobName = isActive ? jobs[Math.floor(Math.random() * (jobs.length - 1)) + 1] : '-';
        const nsName = jobName !== '-' ? namespaces[Math.floor(Math.random() * (namespaces.length - 1)) + 1] : '-';

        devices.push({
            id: `nvidia${i % 2}`, // simulating nvidia0, nvidia1 per node
            node: node,
            model: model,
            type: 'P',
            status: isActive ? 'Active' : 'Idle',
            utilization: isActive ? Math.floor(20 + Math.random() * 80) : 0,
            uuid: `GPU-${Math.random().toString(36).substring(2, 10)}-${i}`,
            migMode: '0',
            migId: '-',
            migProfile: '-',
            namespace: nsName,
            cronJob: jobName,
            job: jobName !== '-' ? `${jobName}-${Math.floor(Math.random() * 10000)}` : '-',
            pod: jobName !== '-' ? `${jobName}-${Math.floor(Math.random() * 10000)}-${Math.random().toString(36).substring(2, 7)}` : '-',
            ready: isActive ? '1/1' : '0/1',
            podPhase: isActive ? 'Running' : (Math.random() > 0.5 ? 'Succeeded' : '-'),
            restartCount: Math.floor(Math.random() * 3),
            age: `${Math.floor(1 + Math.random() * 60)}m`,
            vramUsage: isActive ? `${Math.floor(5 + Math.random() * 30)} GiB` : '0 GiB',
            vramTotal: '40 GiB',
            temperature: Math.floor(30 + Math.random() * 50)
        });
    }
    return devices;
};

export interface NpuDevice {
    id: string;
    node: string;
    model: string;
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    uuid: string;
    namespace: string;
    pod: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
}

const generateInitialNpuDevices = (): NpuDevice[] => {
    const devices: NpuDevice[] = [];
    const model = 'Rebellion ATOM-X';
    const namespaces = ['-', 'npu-infer', 'default', 'ai-vision'];
    const pods = ['-', 'atom-worker-v1', 'rebellion-model-serving', 'npu-stream-proc'];

    // 2 nodes * 8 Dies = 16 devices total
    for (let i = 0; i < 16; i++) {
        const nodeIdx = Math.floor(i / 8);
        const dieIdx = i % 8;
        const node = CLUSTER_NODES[nodeIdx];
        
        let isActive = Math.random() > 0.4;
        let utilization = isActive ? Math.floor(10 + Math.random() * 90) : 0;

        // Specific pattern for worker-02 as requested by user
        // Scenario: 0, 1, 3 are idle (grey), 2, 4, 5, 6, 7 are active (green)
        if (node === 'worker-02') {
            if ([0, 1, 3].includes(dieIdx)) {
                isActive = false;
                utilization = 0;
            } else {
                isActive = true;
                // Assign some specific high utilization for "showing usage"
                utilization = 60 + (dieIdx * 5); 
            }
        }

        const podName = isActive ? pods[Math.floor(Math.random() * (pods.length - 1)) + 1] : '-';
        const nsName = podName !== '-' ? namespaces[Math.floor(Math.random() * (namespaces.length - 1)) + 1] : '-';

        devices.push({
            id: `die${dieIdx}`,
            node: node,
            model: model,
            status: isActive ? 'Active' : 'Idle',
            utilization: utilization,
            uuid: `NPU-DIE-${Math.random().toString(36).substring(2, 10)}-${i}`,
            namespace: nsName,
            pod: podName !== '-' ? `${podName}-${Math.floor(Math.random() * 10000)}` : '-',
            vramUsage: isActive ? `${Math.floor(2 + Math.random() * 14)} GiB` : '0 GiB',
            vramTotal: '16 GiB',
            temperature: Math.floor(35 + Math.random() * 45)
        });
    }
    return devices;
};

// Generate Mock Data for New Endpoints
const STATIC_NPU_CLUSTER_OVERVIEW = {
    totalCapacity: 16,
    allocated: 13,
    hardwareVersions: [
        { node: 'worker-01', driverVersion: '3.0.0', family: 'ATOM', product: 'RBLN-CA25' },
        { node: 'worker-02', driverVersion: '3.0.0', family: 'ATOM', product: 'RBLN-CA25' },
    ],
    nodeAllocation: [
        { node: 'worker-01', allocated: 5, capacity: 8 },
        { node: 'worker-02', allocated: 5, capacity: 8 },
    ]
};

const STATIC_NPU_HARDWARE_DETAILS = {
    devices: generateInitialNpuDevices(),
    topology: [
        {
            groupId: 'rbln-group-1', node: 'worker-01', parent: 'rbln0',
            children: ['rbln1', 'rbln2', 'rbln3']
        },
        {
            groupId: 'rbln-group-2', node: 'worker-01', parent: 'rbln4',
            children: ['rbln5', 'rbln6', 'rbln7']
        },
        {
            groupId: 'rbln-group-3', node: 'worker-02', parent: 'rbln0',
            children: ['rbln1']
        },
        {
            groupId: 'rbln-group-4', node: 'worker-02', parent: 'rbln2',
            children: ['rbln3']
        },
        {
            groupId: 'rbln-group-5', node: 'worker-02', parent: 'rbln4',
            children: ['rbln5', 'rbln7']
        },
        {
            groupId: 'rbln-group-6', node: 'worker-02', parent: 'rbln6',
            children: []
        }
    ]
};

const STATIC_NPU_WORKLOAD_MAPPING = {
    podMappings: [
        { podName: 'rbln-pytorch-pod-1request', node: 'worker-02', requested: 1, devices: ['rbln6'] },
        { podName: 'rbln-pytorch-pod-2request', node: 'worker-02', requested: 2, devices: ['rbln0', 'rbln1'] },
        { podName: 'rbln-pytorch-pod-3request', node: 'worker-02', requested: 3, devices: ['rbln4', 'rbln5', 'rbln7'] },
        { podName: 'rbln-pytorch-pod-5request', node: 'worker-01', requested: 5, devices: ['rbln0', 'rbln4', 'rbln5', 'rbln6', 'rbln7'] },
    ],
    contexts: [
        { pid: '10432', processName: 'python', priority: 'High', status: 'Running', memalloc: '12.4 GiB', node: 'worker-01', deviceIdx: 'rbln0' },
        { pid: '10433', processName: 'python', priority: 'High', status: 'Running', memalloc: '14.1 GiB', node: 'worker-01', deviceIdx: 'rbln4' },
        { pid: '11021', processName: 'python', priority: 'Normal', status: 'Running', memalloc: '8.2 GiB', node: 'worker-02', deviceIdx: 'rbln0' },
        { pid: '11022', processName: 'python', priority: 'Normal', status: 'Running', memalloc: '8.2 GiB', node: 'worker-02', deviceIdx: 'rbln1' },
    ]
};

const STATIC_GPU_DEVICES = generateInitialGpuDevices();

const STATIC_NPU_DEVICES = generateInitialNpuDevices();

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
            const uniqueGpuId = `${nodeId}-${gpu.id}`;
            nodes.push({
                id: uniqueGpuId,
                type: 'gpuNode',
                position: {
                    x: xOffset + gIdx * 200,
                    y: 200
                },
                data: { label: `${gpu.model}`, status: 'healthy' }
            });
            edges.push({ id: `e-${nodeId}-${uniqueGpuId}`, source: nodeId, target: uniqueGpuId, animated: true });
        });
    });

    return { nodes, edges };
};

const generateResourceMetrics = () => {
    const times = [];
    const cpu = [];
    const memory = [];
    const networkRx = [];
    const networkTx = [];
    const diskRead = [];
    const diskWrite = [];
    let baseTime = new Date().getTime() - 3600000;
    for (let i = 0; i < 60; i++) {
        times.push(new Date(baseTime).toLocaleTimeString());
        cpu.push(Math.floor(Math.random() * 100));
        memory.push(Math.floor(40 + Math.random() * 40));
        networkRx.push(parseFloat((Math.random() * 10).toFixed(2))); // MB/s
        networkTx.push(parseFloat((Math.random() * 5).toFixed(2)));  // MB/s
        diskRead.push(parseFloat((Math.random() * 50).toFixed(2)));  // MB/s
        diskWrite.push(parseFloat((Math.random() * 20).toFixed(2))); // MB/s
        baseTime += 60000;
    }
    return { times, cpu, memory, networkRx, networkTx, diskRead, diskWrite };
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

const generateNpuTrends = () => {
    return STATIC_NPU_DEVICES.map(device => {
        const dailyUtils = Array.from({ length: 31 }).map(() => Math.floor(Math.random() * 100));
        return {
            deviceId: device.id,
            label: `${device.node} / ${device.model} / ${device.id}`,
            uuid: device.uuid,
            history: dailyUtils
        };
    });
};

const STATIC_GPU_TRENDS = generateGpuTrends();
const STATIC_NPU_TRENDS = generateNpuTrends();

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
            { id: 7, type: 'Normal', reason: 'Pulled', message: 'Successfully pulled image "alpine:latest"', count: 1, lastTimestamp: '8m', component: 'kubelet, node-0', object: 'Pod/app-worker-B-0' },
            { id: 8, type: 'Normal', reason: 'Started', message: 'Started container app', count: 1, lastTimestamp: '7m', component: 'kubelet, node-0', object: 'Pod/app-worker-B-0' },
            { id: 9, type: 'Warning', reason: 'FailedMount', message: 'MountVolume.SetUp failed for volume "data" : secret "app-secret" not found', count: 3, lastTimestamp: '4m', component: 'kubelet, node-1', object: 'Pod/app-worker-C-1' },
            { id: 10, type: 'Normal', reason: 'Killing', message: 'Stopping container app', count: 1, lastTimestamp: '1m', component: 'kubelet, node-0', object: 'Pod/app-worker-A-0' },
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
            image: i % 2 === 0 ? 'nginx:1.21-alpine' : 'java:11-jre',
            serviceName: `service-${String.fromCharCode(65 + (i % 4))}`,
            volume: { type: i % 2 === 0 ? 'HostPath' : 'ConfigMap', path: i % 2 === 0 ? '/run/containerd/containerd.sock' : '/etc/config' }
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

    // NPU Mock Endpoints
    http.get('/api/npu/devices', () => {
        return HttpResponse.json(STATIC_NPU_DEVICES);
    }),

    http.get('/api/npu/trends', () => {
        return HttpResponse.json(STATIC_NPU_TRENDS);
    }),

    http.get('/api/npu/cluster-overview', () => {
        return HttpResponse.json(STATIC_NPU_CLUSTER_OVERVIEW);
    }),

    http.get('/api/npu/hardware-details', () => {
        return HttpResponse.json(STATIC_NPU_HARDWARE_DETAILS);
    }),

    http.get('/api/npu/workload-mapping', () => {
        return HttpResponse.json(STATIC_NPU_WORKLOAD_MAPPING);
    }),

    // Logs API
    http.get('/api/logs', ({ request }) => {
        const url = new URL(request.url);
        const podName = url.searchParams.get('pod');
        const level = url.searchParams.get('level');
        const search = url.searchParams.get('search')?.toLowerCase() || '';

        const logs = [];
        let baseTime = new Date().getTime() - 60000; // start 1 min ago
        const levels = ['INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
        const messages = [
            'Connection established successfully.',
            'Processed batch of 500 records.',
            'Healthcheck passed.',
            'Awaiting new tasks in queue.',
            'High memory usage detected.',
            'Transaction timeout after 30s.',
            'Failed to connect to database.',
            'ConfigMap reloaded.',
            'Caching index refreshed.',
            'OOMKilled warning imminent.'
        ];

        // Generate 50 random logs
        for (let i = 0; i < 50; i++) {
            const rawLevel = levels[Math.floor(Math.random() * levels.length)];
            const rawMessage = messages[Math.floor(Math.random() * messages.length)];
            const sourcePod = podName || `app-worker-${String.fromCharCode(65 + (i % 4))}-${Math.floor(i % 3)}`;

            logs.push({
                id: `log-${i}-${baseTime}`,
                timestamp: new Date(baseTime).toISOString().replace('T', ' ').substring(0, 23),
                level: rawLevel,
                message: rawMessage,
                source: sourcePod
            });
            baseTime += Math.floor(Math.random() * 2000); // advance time by 0-2s
        }

        // Apply filters
        let filteredLogs = logs;
        if (level && level !== 'ALL') {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }
        if (search) {
            filteredLogs = filteredLogs.filter(log => log.message.toLowerCase().includes(search));
        }

        // Reverse to show newest at bottom like a real tail (or keep chrono)
        return HttpResponse.json(filteredLogs);
    }),
];
