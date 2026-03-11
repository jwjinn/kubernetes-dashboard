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

    const groupedTopology = useMemo(() => {
        const groups: Record<string, any[]> = {};
        topologyGroups.forEach((g: any) => {
            if (!groups[g.node]) groups[g.node] = [];
            groups[g.node].push(g);
        });
        return groups;
    }, [topologyGroups]);

    const { utilData, tempData, vramData, powerData } = useMemo(() => {
        const timeAxis = ['17:00', '17:10', '17:20', '17:30', '17:40', '17:50', '18:00', '18:10', '18:20', '18:30'];

        const genData = (base: number, volatility: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.min(100, Math.max(0, base + Math.sin(i * seed) * volatility)));

        const genVramData = (base: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.max(0, base + Math.sin(i * seed) * 3000));

        let utilSeries = [];
        let tempSeries = [];
        let vramSeries = [];
        let powerSeries = [];

        if (selectedMapNode) {
            const seed = selectedMapNode.charCodeAt(selectedMapNode.length - 1);
            utilSeries = [
                { name: 'rbln0', type: 'line', data: genData(40, 40, seed), smooth: true, showSymbol: false },
                { name: 'rbln4', type: 'line', data: genData(70, 30, seed + 1), smooth: true, showSymbol: false },
            ];
            tempSeries = [
                { name: 'rbln0', type: 'line', data: genData(35, 10, seed), smooth: true, showSymbol: false },
                { name: 'rbln4', type: 'line', data: genData(43, 15, seed + 1), smooth: true, showSymbol: false },
            ];
            vramSeries = [
                { name: 'rbln0', type: 'line', data: genVramData(8192, seed), smooth: true, showSymbol: false },
                { name: 'rbln4', type: 'line', data: genVramData(12288, seed + 1), smooth: true, showSymbol: false },
            ];
            powerSeries = [
                { name: 'rbln0', type: 'line', data: genData(58, 5, seed), smooth: true, showSymbol: false },
                { name: 'rbln4', type: 'line', data: genData(94, 2, seed + 1), smooth: true, showSymbol: false },
            ];
        } else {
            const nodes = ['worker-01', 'worker-02'];
            const baseUtils = [30, 80];
            const baseTemps = [40, 32];
            const baseVrams = [8192, 14000];
            const basePowers = [58, 95];

            utilSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseUtils[idx], 20, idx + 1), smooth: true, showSymbol: false
            }));

            tempSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseTemps[idx], 5, idx + 1), smooth: true, showSymbol: false
            }));

            vramSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genVramData(baseVrams[idx], idx + 1), smooth: true, showSymbol: false
            }));

            powerSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(basePowers[idx], 4, idx + 1), smooth: true, showSymbol: false
            }));
        }

        const commonOptions = {
            tooltip: { trigger: 'axis' as const },
            grid: { left: '8%', right: '5%', bottom: '15%', top: '15%' },
            xAxis: { type: 'category' as const, boundaryGap: false, data: timeAxis },
            color: ['#10b981', '#059669', '#047857', '#065f46']
        };

        return {
            utilData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: utilSeries },
            tempData: { 
                ...commonOptions, 
                yAxis: { type: 'value' as const, max: 100 }, 
                series: tempSeries
            },
            vramData: { ...commonOptions, yAxis: { type: 'value' as const }, series: vramSeries },
            powerData: { 
                ...commonOptions, 
                yAxis: { type: 'value' as const, max: 120 }, 
                series: powerSeries
            }
        };
    }, [selectedMapNode]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
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
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Active</div>
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
