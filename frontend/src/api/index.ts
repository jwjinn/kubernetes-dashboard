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

const readErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
        const data = await response.json() as { error?: string };
        if (data?.error) {
            return data.error;
        }
    } catch {
        // Ignore parse failures and use fallback below.
    }
    return fallbackMessage;
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
    status: string;
    memalloc: string;
    node: string;
    deviceIdx: string;
    utilization: number;
    temperature: number;
    power: number;
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

export const fetchPodDescribe = async (namespace: string, podName: string): Promise<string> => {
    const search = new URLSearchParams({ namespace, podName });
    const response = await apiFetch(`/api/k8s/pod-describe?${search.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch pod describe');
    return response.text();
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

export interface K8sEvent {
    id: string;
    type: string;
    reason: string;
    message: string;
    count: number;
    lastTimestamp: string;
    component: string;
    object: string;
    namespace: string;
    podName?: string;
    node?: string;
}

export const fetchK8sEvents = async (params?: { namespace?: string; podName?: string }): Promise<K8sEvent[]> => {
    const search = new URLSearchParams();
    if (params?.namespace) search.set('namespace', params.namespace);
    if (params?.podName) search.set('podName', params.podName);
    const query = search.toString();
    const response = await apiFetch(`/api/k8s/events${query ? `?${query}` : ''}`);
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

export const fetchPodLogs = async (namespace: string, podName: string, level?: string, search?: string) => {
    const params = new URLSearchParams({ namespace, podName });
    if (level) params.set('level', level);
    if (search) params.set('search', search);

    const response = await apiFetch(`/api/k8s/pod-logs?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch pod logs');
    return response.json();
};

export interface DiagnosisChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export type DiagnosisNodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface DiagnosisNodeEvent {
    nodeId: string;
    nodeType?: string;
    status: DiagnosisNodeStatus | string;
    error?: string;
}

export const sendDiagnosisChat = async (message: string, history: DiagnosisChatMessage[] = []) => {
    const response = await apiFetch('/api/diagnosis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
    });
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to send diagnosis request'));
    return response.json() as Promise<{ reply: string }>;
};

type StreamHandlers = {
    onNodeStatus?: (event: DiagnosisNodeEvent) => void;
    onToken?: (token: string) => void;
    onDone?: () => void;
};

const normalizeNodeStatus = (value: string): DiagnosisNodeStatus | string => {
    const lower = value.toLowerCase();
    if (lower === 'running' || lower === 'success' || lower === 'error' || lower === 'idle') {
        return lower;
    }
    return value;
};

const processStreamLine = (rawLine: string, handlers: StreamHandlers) => {
    const line = rawLine.trim();
    if (!line || line === '[DONE]') {
        return;
    }

    if (line === '" "' || line === '"\\n"' || line === '"\n"') {
        return;
    }

    if (line.startsWith('0:')) {
        try {
            const text = JSON.parse(line.slice(2));
            if (typeof text === 'string' && text && !text.trimStart().startsWith('[과정]')) {
                handlers.onToken?.(text);
            }
        } catch {
            const token = line.slice(2);
            if (!token.trimStart().startsWith('[과정]')) {
                handlers.onToken?.(token);
            }
        }
        return;
    }

    if (line.startsWith('8:')) {
        try {
            const events = JSON.parse(line.slice(2));
            if (Array.isArray(events)) {
                for (const entry of events) {
                    const data = entry?.data;
                    const nodeId = typeof data?.nodeId === 'string' ? data.nodeId : '';
                    const status = typeof data?.status === 'string' ? normalizeNodeStatus(data.status) : 'idle';
                    if (!nodeId) continue;
                    const nodeEvent: DiagnosisNodeEvent = {
                        nodeId,
                        nodeType: typeof data?.nodeType === 'string' ? data.nodeType : undefined,
                        status,
                        error: typeof data?.error === 'string' ? data.error : undefined,
                    };
                    handlers.onNodeStatus?.(nodeEvent);
                }
            }
        } catch {
            // Ignore malformed node status events.
        }
        return;
    }

    if (line.startsWith('d:')) {
        try {
            const meta = JSON.parse(line.slice(2));
            if (meta?.finishReason === 'stop') {
                handlers.onDone?.();
            }
        } catch {
            handlers.onDone?.();
        }
        return;
    }
};

export const streamDiagnosisChat = async (
    message: string,
    handlers: StreamHandlers,
    signal?: AbortSignal,
) => {
    const response = await apiFetch('/api/diagnosis/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal,
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to stream diagnosis request'));
    }
    if (!response.body) {
        throw new Error('Diagnosis stream is unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replace(/\r\n/g, '\n');
        const segments = normalized.split('\n');
        buffer = segments.pop() ?? '';

        for (const segment of segments) {
            processStreamLine(segment, handlers);
        }
    }

    const tail = buffer.trim();
    if (tail) {
        processStreamLine(tail, handlers);
    }
};
