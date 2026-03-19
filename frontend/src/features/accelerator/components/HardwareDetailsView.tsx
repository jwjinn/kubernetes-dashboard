import { Card, Text } from '@tremor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactECharts from 'echarts-for-react';
import { AcceleratorHexMap } from '@/features/accelerator/components/AcceleratorHexMap';
import { AcceleratorDetailsSheet } from '@/features/accelerator/components/AcceleratorDetailsSheet';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuHardwareDetails } from '@/api';
import type { NpuDevice } from '@/api';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ChevronDown, ChevronRight } from 'lucide-react';

function TopologyNodeGroup({ nodeName, groups }: { nodeName: string, groups: any[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-border rounded-xl flex flex-col bg-background shadow-xs overflow-hidden shrink-0">
            <div 
                className="bg-muted/30 px-5 py-3 border-b border-border flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-bold text-base text-foreground">{nodeName}</span>
                </div>
                <span className="text-xs bg-background border border-border px-2 py-1 rounded text-muted-foreground font-medium">
                    {groups.length} Primary Contexts
                </span>
            </div>
            {isExpanded && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {groups.map((group: any) => (
                        <div key={group.groupId} className="p-4 rounded-lg border border-border bg-muted/5 hover:bg-muted/10 transition-colors">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-mono text-muted-foreground">ID: {group.groupId}</span>
                                <span className="text-xs font-semibold bg-background border border-border px-1.5 py-0.5 rounded shadow-sm text-foreground">
                                    {group.children.length + 1} Dies
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="px-3 py-2.5 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm font-medium rounded-md text-center shadow-sm">
                                    Primary: <span className="font-bold text-base ml-1">{group.parent}</span>
                                </div>
                                {group.children.length > 0 && (
                                    <div className="flex justify-center border-l-2 border-border/60 ml-[50%] h-4"></div>
                                )}
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    {group.children.map((child: string) => (
                                        <div key={child} className="px-2 py-2 bg-background border border-border text-sm font-medium text-center rounded shadow-sm text-muted-foreground truncate">
                                            {child}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function HardwareDetailsView() {
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'None' | 'Node'>('Node');
    const [colorBy, setColorBy] = useState<'Status' | 'Utilization'>('Utilization');

    const { data: hardwareDetails, isLoading } = useQuery({
        queryKey: ['npuHardwareDetails'],
        queryFn: fetchNpuHardwareDetails,
        refetchInterval: 5000
    });

    const devices: NpuDevice[] = hardwareDetails?.devices || [];
    const topologyGroups = hardwareDetails?.topology || [];
    const nodeAllocation = hardwareDetails?.nodeAllocation || [];

    const nodeAllocationMap = useMemo(() => {
        const summary: Record<string, { allocated: number; capacity: number }> = {};
        nodeAllocation.forEach((row: any) => {
            summary[row.node] = { allocated: row.allocated, capacity: row.capacity };
        });
        return summary;
    }, [nodeAllocation]);

    const groupedTopology = useMemo(() => {
        const groups: Record<string, any[]> = {};
        topologyGroups.forEach((g: any) => {
            if (!groups[g.node]) groups[g.node] = [];
            groups[g.node].push(g);
        });
        return groups;
    }, [topologyGroups]);

    const nodeTelemetrySummary = useMemo(() => {
        const summary: Record<string, { active: number; total: number; memoryResident: number; computeActive: number }> = {};
        devices.forEach((device) => {
            if (!summary[device.node]) {
                summary[device.node] = { active: 0, total: 0, memoryResident: 0, computeActive: 0 };
            }
            summary[device.node].total += 1;

            const memoryUsed = Number.parseFloat((device.vramUsage || '0').replace(/[^\d.]/g, ''));
            const hasMemory = Number.isFinite(memoryUsed) && memoryUsed > 0;
            const hasCompute = (device.utilization ?? 0) > 0;

            if (hasMemory || hasCompute) summary[device.node].active += 1;
            if (hasMemory) summary[device.node].memoryResident += 1;
            if (hasCompute) summary[device.node].computeActive += 1;
        });
        return summary;
    }, [devices]);

    const { utilData, tempData, vramData, powerData } = useMemo(() => {
        const visibleDevices = selectedMapNode
            ? devices.filter((device) => device.node === selectedMapNode)
            : devices;

        const labels = visibleDevices.map((device) => device.id);
        const parseGiB = (value: string) => {
            const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ''));
            return Number.isFinite(numeric) ? numeric : 0;
        };

        const buildBarOption = (seriesName: string, values: number[], max?: number) => ({
            tooltip: { trigger: 'axis' as const },
            grid: { left: '8%', right: '5%', bottom: '20%', top: '12%' },
            xAxis: {
                type: 'category' as const,
                data: labels,
                axisLabel: { rotate: labels.length > 8 ? 35 : 0 },
            },
            yAxis: {
                type: 'value' as const,
                max,
            },
            color: ['#10b981'],
            series: [
                {
                    name: seriesName,
                    type: 'bar' as const,
                    data: values,
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: '#10b981',
                    },
                },
            ],
        });

        return {
            utilData: buildBarOption('Utilization (%)', visibleDevices.map((device) => device.utilization), 100),
            tempData: buildBarOption('Temperature (°C)', visibleDevices.map((device) => device.temperature), 100),
            vramData: buildBarOption('Memory Usage (GiB)', visibleDevices.map((device) => parseGiB(device.vramUsage))),
            powerData: buildBarOption('Power (W)', visibleDevices.map((device) => device.power ?? 0), 150),
        };
    }, [devices, selectedMapNode]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(nodeAllocationMap).map(([nodeName, allocation]) => {
                    const telemetry = nodeTelemetrySummary[nodeName] ?? { active: 0, total: 0, memoryResident: 0, computeActive: 0 };
                    const requestRatio = allocation.capacity > 0 ? Math.round((allocation.allocated / allocation.capacity) * 100) : 0;

                    return (
                        <Card key={nodeName} className="p-4 border-border shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center">
                                        <h3 className="font-bold text-base">{nodeName}</h3>
                                        <InfoTooltip content={
                                            <div className="space-y-2">
                                                <p><strong>Requested</strong>: Kubernetes API 기준입니다. 이 노드에 스케줄된 Pod들의 `resources.requests` 합계를 사용합니다.</p>
                                                <p><strong>Telemetry</strong>: Prometheus / VictoriaMetrics 기준입니다. 장치별 `Utilization &gt; 0` 또는 `Memory Usage &gt; 0` 이면 활성로 봅니다.</p>
                                                <p><strong>왜 다를 수 있나</strong>: 모델만 메모리에 올라가 있고 실제 연산은 없는 경우, Requested는 존재하지만 Compute Active는 0일 수 있습니다.</p>
                                            </div>
                                        } />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        이 노드의 공식 요청량과 실제 장치 관측 상태를 함께 보여줍니다.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] uppercase text-muted-foreground">Capacity</p>
                                    <p className="text-lg font-black">{allocation.capacity}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 col-span-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-green-800">Requested Allocation</span>
                                        <span className="text-xs text-green-700">{requestRatio}%</span>
                                    </div>
                                    <div className="mt-2 text-2xl font-black text-green-700">
                                        {allocation.allocated} / {allocation.capacity}
                                    </div>
                                    <p className="mt-1 text-xs text-green-700">
                                        Source: Kubernetes Pod requests
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                                <div className="rounded-md bg-muted/40 px-3 py-2">
                                    Telemetry Active: <span className="font-semibold text-foreground">{telemetry.active}</span>
                                </div>
                                <div className="rounded-md bg-muted/40 px-3 py-2">
                                    Compute Active: <span className="font-semibold text-foreground">{telemetry.computeActive}</span>
                                </div>
                                <div className="rounded-md bg-muted/40 px-3 py-2">
                                    Memory Resident: <span className="font-semibold text-foreground">{telemetry.memoryResident}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* HexMap and Topology */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="col-span-1 border border-border flex flex-col p-0 overflow-hidden min-h-[500px]">
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center mb-4">
                            <h3 className="text-lg font-bold">NPU 상태 맵 (HexMap)</h3>
                            <InfoTooltip content="전체 클러스터 내 물리적인 NPU 카드들의 가동 상태(Status)나 자원 사용률(Utilization)을 육각형 타일 형태로 직관적으로 시각화합니다. 노드별로 정렬하여 볼 수 있습니다." />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-muted-foreground font-bold">Group by</label>
                                {/* Implement custom selects or standard selects here. For simplicity, we keep plain selects or Tremor selects */}
                                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                                    <SelectTrigger className="w-full h-8 text-xs bg-muted/50 border-border rounded-md px-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="None">None</SelectItem>
                                        <SelectItem value="Node">Node</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-muted-foreground font-bold">Color by</label>
                                <Select value={colorBy} onValueChange={(v: any) => setColorBy(v)}>
                                    <SelectTrigger className="w-full h-8 text-xs bg-muted/50 border-border rounded-md px-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Utilization">Utilization</SelectItem>
                                        <SelectItem value="Status">Status</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full bg-background relative pt-8 pl-16 overflow-auto">
                        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-[10px] text-muted-foreground font-medium">
                            {colorBy === 'Utilization' ? (
                                <>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-600"></div> ~100%</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500"></div> ~80%</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400"></div> ~60%</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-300"></div> ~40%</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 border border-border"></div> ~0%</div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Telemetry Active</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Idle</div>
                                </>
                            )}
                        </div>

                        {isLoading ? (
                            <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading Map...</div>
                        ) : (
                            <AcceleratorHexMap 
                                data={devices} 
                                acceleratorType="NPU" 
                                selectedNode={selectedMapNode} 
                                onNodeSelect={setSelectedMapNode} 
                                groupBy={groupBy as any} 
                                colorBy={colorBy as any}
                                nodeAllocation={nodeAllocationMap}
                            />
                        )}
                    </div>
                </Card>

                {/* Metrics Charts */}
                <div className="col-span-2 flex flex-col space-y-6">
                    <Card className="p-0 flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center">
                            <h3 className="font-bold text-sm">
                                {selectedMapNode ? `Device Performance: ${selectedMapNode}` : `실시간 NPU 성능 지표 (Performance)`}
                            </h3>
                            <InfoTooltip content="단일 디바이스 또는 클러스터 전체 NPU의 최근 1시간 사용률, VRAM, 온도, 전원 사용량 추세(Trend)를 VictoriaMetrics에서 수집하여 실시간으로 반영합니다." />
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">Usage Utilization (%)</Text>
                                <ReactECharts option={utilData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">Memory Usage (MiB)</Text>
                                <ReactECharts option={vramData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">Temperature (°C)</Text>
                                <ReactECharts option={tempData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">Power Limit (W)</Text>
                                <ReactECharts option={powerData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Topology Hierarchy */}
            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <div className="flex items-center">
                        <h3 className="font-bold text-sm">디바이스 토폴로지 (Topology) 구조</h3>
                        <InfoTooltip content="K8s 워커 노드 내부의 PCI 버스 및 링크 구조를 나타냅니다. rbln-smi 로그 상에서 하나의 Primary Device(ex. rbln0)에 묶여 있는 Sub-Devices 들을 시각화합니다. 이 구조를 알아야 파드의 Multi-NPU 할당 최적화가 가능합니다." />
                    </div>
                </div>
                <div className="p-6 flex flex-col gap-6 max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                        <div className="text-muted-foreground animate-pulse p-4">Loading topology...</div>
                    ) : Object.keys(groupedTopology).length === 0 ? (
                        <div className="text-muted-foreground p-4">No topology data available.</div>
                    ) : (
                        Object.entries(groupedTopology).map(([nodeName, groups]) => (
                            <TopologyNodeGroup key={nodeName} nodeName={nodeName} groups={groups as any[]} />
                        ))
                    )}
                </div>
            </Card>

            <AcceleratorDetailsSheet
                isOpen={!!selectedDevice}
                deviceId={selectedDevice}
                acceleratorType="NPU"
                onClose={() => setSelectedDevice(null)}
            />
        </div>
    );
}
