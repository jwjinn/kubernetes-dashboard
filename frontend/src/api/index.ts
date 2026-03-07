export const fetchClusterSummary = async (clusterId: string) => {
    const response = await fetch(`/api/clusters/summary?cluster=${clusterId}`);
    if (!response.ok) throw new Error('Failed to fetch cluster summary');
    return response.json();
};

export const fetchTopologyData = async (clusterId: string, nodeId?: string | null) => {
    let url = `/api/topology?cluster=${clusterId}`;
    if (nodeId) url += `&nodeId=${nodeId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch topology data');
    return response.json();
};

export const terminatePod = async (podId: string) => {
    const response = await fetch(`/api/pods/${podId}/terminate`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to terminate pod');
    return response.json();
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

export const fetchContainerMap = async () => {
    const response = await fetch(`/api/k8s/containers`);
    if (!response.ok) throw new Error('Failed to fetch container map');
    return response.json();
};

export const fetchContainerMetrics = async (containerId: string) => {
    const response = await fetch(`/api/k8s/metrics/${containerId}`);
    if (!response.ok) throw new Error('Failed to fetch container metrics');
    return response.json();
};

export const fetchGpuDevices = async () => {
    const response = await fetch(`/api/gpu/devices`);
    if (!response.ok) throw new Error('Failed to fetch gpu devices');
    return response.json();
};

export const fetchGpuTrends = async () => {
    const response = await fetch(`/api/gpu/trends`);
    if (!response.ok) throw new Error('Failed to fetch gpu trends');
    return response.json();
};

export const fetchNpuDevices = async () => {
    const response = await fetch(`/api/npu/devices`);
    if (!response.ok) throw new Error('Failed to fetch npu devices');
    return response.json();
};

export const fetchNpuTrends = async () => {
    const response = await fetch(`/api/npu/trends`);
    if (!response.ok) throw new Error('Failed to fetch npu trends');
    return response.json();
};

export const fetchAcceleratorDevices = async (type: 'GPU' | 'NPU' = 'GPU') => {
    const endpoint = type === 'NPU' ? '/api/npu/devices' : '/api/gpu/devices';
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Failed to fetch ${type.toLowerCase()} devices`);
    return response.json();
};

export const fetchAcceleratorTrends = async (type: 'GPU' | 'NPU' = 'GPU') => {
    const endpoint = type === 'NPU' ? '/api/npu/trends' : '/api/gpu/trends';
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Failed to fetch ${type.toLowerCase()} trends`);
    return response.json();
};

export const fetchK8sEvents = async () => {
    const response = await fetch('/api/k8s/events');
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
};

export const fetchStartupAnalysis = async () => {
    const response = await fetch('/api/k8s/startup-analysis');
    if (!response.ok) throw new Error('Failed to fetch startup analysis');
    return response.json();
};

export const fetchLogs = async (podName?: string, level?: string, search?: string) => {
    let url = `/api/logs?`;
    if (podName) url += `pod=${podName}&`;
    if (level) url += `level=${level}&`;
    if (search) url += `search=${search}&`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
};
