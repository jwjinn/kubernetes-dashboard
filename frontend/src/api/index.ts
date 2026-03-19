import { getAccessToken } from '@/auth/tokenStore';

const getAuthToken = () => getAccessToken() || localStorage.getItem('k8s_dashboard_token');

const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getAuthToken();
    const headers = new Headers(init?.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
        // Optional: Handle unauthorized globally (e.g., clear token, redirect to login)
        // localStorage.removeItem('k8s_dashboard_token');
        // window.location.href = '/login';
    }

    return response;
};

export const fetchClusterSummary = async (clusterId: string) => {
    const response = await apiFetch(`/api/clusters/summary?cluster=${clusterId}`);
    if (!response.ok) throw new Error('Failed to fetch cluster summary');
    return response.json();
};

export const fetchTopologyData = async (clusterId: string, nodeId?: string | null) => {
    let url = `/api/topology?cluster=${clusterId}`;
    if (nodeId) url += `&nodeId=${nodeId}`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch topology data');
    return response.json();
};

export const fetchWorkloadTopology = async (): Promise<{ nodes: any[]; edges: any[] }> => {
    const response = await apiFetch('/api/workload-topology');
    if (!response.ok) throw new Error('Failed to fetch workload topology');
    return response.json();
};

export const terminatePod = async (podId: string) => {
    const response = await apiFetch(`/api/pods/${podId}/terminate`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to terminate pod');
    return response.json();
};

export interface NpuDevice {
    id: string;
    node: string;
    model: string;
    type: 'P' | 'M' | 'C'; // Physical, MIG, Core
    status: 'Active' | 'Idle' | 'Error';
    utilization: number;
    uuid: string;
    namespace: string;
    pod: string;
    vramUsage: string;
    vramTotal: string;
    temperature: number;
    power: number; // Added for Hardware Details
    migMode?: string;
    migId?: string;
    migProfile?: string;
}

export interface NpuProcessContext {
    pid: string;
    processName: string;
    priority: string;
    status: string;
    memalloc: string;
    node: string;
    deviceIdx: string;
}

// New API functions for the NPU dashboard tabs
export const fetchNpuClusterOverview = async () => {
    const response = await apiFetch(`/api/npu/cluster-overview`);
    // Fallback or error handling
    if (!response.ok) throw new Error('Failed to fetch NPU cluster overview');
    return response.json();
};

export const fetchNpuWorkloadMapping = async () => {
    const response = await apiFetch(`/api/npu/workload-mapping`);
    if (!response.ok) throw new Error('Failed to fetch NPU workload mapping');
    return response.json();
};

export const fetchNpuHardwareDetails = async () => {
    const response = await apiFetch(`/api/npu/hardware-details`);
    if (!response.ok) throw new Error('Failed to fetch NPU hardware details');
    return response.json();
};

export const fetchContainerMap = async () => {
    const response = await apiFetch(`/api/k8s/containers`);
    if (!response.ok) throw new Error('Failed to fetch container map');
    return response.json();
};

export interface NodeDashboardNode {
    nodeId: string;
    cpuUtil: number;
    memTotal: number;
    memUsed: number;
    memBuffers: number;
    memCached: number;
    diskReads: number;
    diskWrites: number;
    fsUsedPercent: number;
    netRx: number;
    netTx: number;
    tcpEstablished: number;
    load1m: number;
    load5m: number;
    load15m: number;
    status: 'Ready' | 'NotReady';
}

export interface NodeDashboardSeries {
    nodeId: string;
    values: number[];
}

export interface NodeDashboardResponse {
    nodes: NodeDashboardNode[];
    timeAxis: string[];
    cpuSeries: NodeDashboardSeries[];
    memorySeries: NodeDashboardSeries[];
    diskIoSeries: NodeDashboardSeries[];
    networkIoSeries: NodeDashboardSeries[];
    loadSeries: NodeDashboardSeries[];
    tcpSeries: NodeDashboardSeries[];
}

export const fetchNodeDashboardMetrics = async (clusterId: string): Promise<NodeDashboardResponse> => {
    const response = await apiFetch(`/api/k8s/node-metrics?cluster=${clusterId}`);
    if (!response.ok) throw new Error('Failed to fetch node dashboard metrics');
    return response.json();
};

export const fetchContainerMetrics = async (containerId: string) => {
    const response = await apiFetch(`/api/k8s/metrics/${containerId}`);
    if (!response.ok) throw new Error('Failed to fetch container metrics');
    return response.json();
};

export const fetchGpuDevices = async () => {
    const response = await apiFetch(`/api/gpu/devices`);
    if (!response.ok) throw new Error('Failed to fetch gpu devices');
    return response.json();
};

export const fetchGpuTrends = async () => {
    const response = await apiFetch(`/api/gpu/trends`);
    if (!response.ok) throw new Error('Failed to fetch gpu trends');
    return response.json();
};

export const fetchNpuDevices = async () => {
    const response = await apiFetch(`/api/npu/devices`);
    if (!response.ok) throw new Error('Failed to fetch npu devices');
    return response.json();
};

export const fetchNpuTrends = async () => {
    const response = await apiFetch(`/api/npu/trends`);
    if (!response.ok) throw new Error('Failed to fetch npu trends');
    return response.json();
};

export const fetchAcceleratorDevices = async (type: 'GPU' | 'NPU' = 'GPU') => {
    const endpoint = type === 'NPU' ? '/api/npu/devices' : '/api/gpu/devices';
    const response = await apiFetch(endpoint);
    if (!response.ok) throw new Error(`Failed to fetch ${type.toLowerCase()} devices`);
    return response.json();
};

export const fetchAcceleratorTrends = async (type: 'GPU' | 'NPU' = 'GPU') => {
    const endpoint = type === 'NPU' ? '/api/npu/trends' : '/api/gpu/trends';
    const response = await apiFetch(endpoint);
    if (!response.ok) throw new Error(`Failed to fetch ${type.toLowerCase()} trends`);
    return response.json();
};

export const fetchK8sEvents = async () => {
    const response = await apiFetch('/api/k8s/events');
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
};

export const fetchStartupAnalysis = async () => {
    const response = await apiFetch('/api/k8s/startup-analysis');
    if (!response.ok) throw new Error('Failed to fetch startup analysis');
    return response.json();
};

export const fetchLogs = async (podName?: string, level?: string, search?: string) => {
    let url = `/api/logs?`;
    if (podName) url += `pod=${podName}&`;
    if (level) url += `level=${level}&`;
    if (search) url += `search=${search}&`;

    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
};
