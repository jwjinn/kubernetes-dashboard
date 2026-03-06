import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { GpuHexMap } from '@/features/gpu/components/GpuHexMap';
import { GpuDetailsSheet } from '@/features/gpu/components/GpuDetailsSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGpuDevices } from '@/api';
import type { GpuDevice } from '@/features/gpu/components/GpuHexMap';
import { Search } from 'lucide-react';

export default function GpuDashboardPage() {
    const [selectedGpu, setSelectedGpu] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'None' | 'Node'>('Node');
    const [colorBy, setColorBy] = useState<'Status' | 'GPU Utilization'>('GPU Utilization');

    // Fetch unified mock data for Map and Table
    const { data: gpuDevices = [], isLoading } = useQuery<GpuDevice[]>({
        queryKey: ['gpuDevices'],
        queryFn: fetchGpuDevices,
        refetchInterval: 5000
    });

    const { utilData, tempData, vramData, smData } = useMemo(() => {
        const timeAxis = ['17:00', '17:10', '17:20', '17:30', '17:40', '17:50', '18:00', '18:10', '18:20', '18:30'];

        const genData = (base: number, volatility: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.min(100, Math.max(0, base + Math.sin(i * seed) * volatility)));

        const genVramData = (base: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.max(0, base + Math.sin(i * seed) * 30000));

        const genSmData = (base: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.min(100, Math.max(0, base + Math.cos(i * seed) * 40)));

        let utilSeries = [];
        let tempSeries = [];
        let vramSeries = [];
        let smSeries = [];

        if (selectedMapNode) {
            // "선택된 노드" 상세 보기 모드
            const seed = selectedMapNode.charCodeAt(selectedMapNode.length - 1);
            utilSeries = [
                { name: 'gpu-0', type: 'line', data: genData(40, 40, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genData(70, 30, seed + 1), smooth: true, showSymbol: false },
            ];
            tempSeries = [
                { name: 'gpu-0', type: 'line', data: genData(50, 10, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genData(65, 15, seed + 1), smooth: true, showSymbol: false },
            ];
            vramSeries = [
                { name: 'gpu-0', type: 'line', data: genVramData(150000, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genVramData(80000, seed + 1), smooth: true, showSymbol: false },
            ];
            smSeries = [
                { name: 'gpu-0', type: 'line', data: genSmData(30, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genSmData(60, seed + 1), smooth: true, showSymbol: false },
            ];
        } else {
            // "전체 보기" (Overview) 모드
            const nodes = ['node-0', 'node-1', 'node-2', 'node-3', 'node-4'];
            const baseUtils = [30, 80, 50, 20, 90];
            const baseTemps = [45, 80, 55, 40, 75];
            const baseVrams = [100000, 250000, 180000, 50000, 280000];
            const baseSms = [25, 70, 45, 15, 85];

            utilSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseUtils[idx], 20, idx + 1), smooth: true, showSymbol: false
            }));

            tempSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseTemps[idx], 10, idx + 1), smooth: true, showSymbol: false
            }));

            vramSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genVramData(baseVrams[idx], idx + 1), smooth: true, showSymbol: false
            }));

            smSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genSmData(baseSms[idx], idx + 1), smooth: true, showSymbol: false
            }));
        }

        const commonOptions = {
            tooltip: { trigger: 'axis' as const },
            grid: { left: '8%', right: '5%', bottom: '15%', top: '15%' },
            xAxis: { type: 'category' as const, boundaryGap: false, data: timeAxis }
        };

        return {
            utilData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: utilSeries },
            tempData: { ...commonOptions, yAxis: { type: 'value' as const, max: 90 }, series: tempSeries },
            vramData: { ...commonOptions, yAxis: { type: 'value' as const }, series: vramSeries },
            smData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: smSeries }
        };
    }, [selectedMapNode]);

    // Calculate Summary KPIs derived from gpuDevices
    const summaryStats = useMemo(() => {
        const stats = {
            totalNodes: new Set(gpuDevices.map(d => d.node)).size,
            physicalTotal: 0,
            physicalActive: 0,
            migTotal: 0,
            migActive: 0,
            migIdle: 0
        };

        gpuDevices.forEach(device => {
            if (device.type === 'P') {
                stats.physicalTotal++;
                if (device.status === 'Active') stats.physicalActive++;
            } else if (device.type === 'M') {
                stats.migTotal++;
                if (device.status === 'Active') stats.migActive++;
                if (device.status === 'Idle') stats.migIdle++;
            }
        });

        return stats;
    }, [gpuDevices]);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">GPU 대시보드</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        노드-GPU(MIG)-Pod간의 연결 관계를 추적하고, 리소스 과다/편중 사용 및 미사용 GPU 등 이상 징후를 한눈에 파악합니다.
                    </p>
                </div>

                {/* 1. GPU 리소스 상태 요약 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">GPU Node</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.totalNodes}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> Ready
                                </Text>
                                <Metric className="text-4xl font-black text-blue-500">{summaryStats.totalNodes}</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">Pod</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.physicalActive + summaryStats.migActive + 14}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 uppercase mb-1 whitespace-nowrap">
                                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-[3px]"></div> GPU 사용 중
                                </Text>
                                <Metric className="text-4xl font-black text-blue-500">{summaryStats.physicalActive + summaryStats.migActive}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase mb-1 whitespace-nowrap">
                                    <div className="w-2.5 h-2.5 bg-gray-300 rounded-[3px]"></div> CPU 전용
                                </Text>
                                <Metric className="text-4xl font-black text-gray-400">14</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">Device</Text>
                        <div className="flex justify-between items-end px-12">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.physicalTotal}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> Active
                                </Text>
                                <Metric className="text-4xl font-black text-blue-500">{summaryStats.physicalActive}</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">MIG</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.migTotal}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> Active
                                </Text>
                                <Metric className="text-4xl font-black text-blue-500">{summaryStats.migActive}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-gray-300 rounded-sm"></div> Idle
                                </Text>
                                <Metric className="text-4xl font-black text-gray-400">{summaryStats.migIdle}</Metric>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. GPU Map */}
                    <Card className="col-span-1 border border-border flex flex-col p-0 overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-lg font-bold mb-4">GPU Map</h3>
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muted-foreground font-bold">Group by</label>
                                    <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                                        <SelectTrigger className="h-8 text-xs bg-muted/50">
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
                                        <SelectTrigger className="h-8 text-xs bg-muted/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GPU Utilization">GPU Utilization</SelectItem>
                                            <SelectItem value="Status">Status</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-[400px] w-full flex bg-background relative">
                            {/* Legend Overlay */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-[10px] text-muted-foreground font-medium">
                                {colorBy === 'GPU Utilization' ? (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600"></div> ~100%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500"></div> ~80%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-400"></div> ~60%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-300"></div> ~40%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200"></div> ~20%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-100 border border-border"></div> 0%</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Active</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Idle</div>
                                    </>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading GPU Map...</div>
                            ) : (
                                <div className="w-full h-full flex-1 pt-8 pl-16 overflow-auto">
                                    <GpuHexMap data={gpuDevices} selectedNode={selectedMapNode} onNodeSelect={setSelectedMapNode} groupBy={groupBy} colorBy={colorBy} />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* 3. 사용량 및 Performance Summary */}
                    <div className="col-span-2 flex flex-col space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? 'Node Memory' : 'Total VRAM Memory'}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '32.00' : '293.13'} <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? 'Node VRAM Usage' : 'Total VRAM Usage'}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '18.4' : '79.84'} <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? 'Node GPU Util' : 'Avg GPU Utilization'}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '65.2' : '21.43'} <span className="text-lg text-muted-foreground font-semibold">%</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text className="font-bold text-foreground mb-4">Avg VRAM Usage</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    9.04 <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                        </div>

                        <Card className={`p-0 flex-1 flex flex-col overflow-hidden ${selectedMapNode ? 'border-blue-500/20 shadow-blue-500/10' : ''}`}>
                            <div className="px-4 py-3 border-b border-border bg-muted/20">
                                <h3 className="font-bold text-sm">
                                    {selectedMapNode ? `Performance for Node: ${selectedMapNode}` : 'GPU Performance Summary (Top 5)'}
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Utilization (%) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={utilData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">VRAM Usage (MiB) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={vramData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Temperature (°C) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={tempData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">SM Active (%) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={smData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* 4. GPU 상세 데이터 테이블 그룹 */}
                <div className="space-y-6">
                    {/* Table 1: GPU Utilization (List of all devices) */}
                    <Card className="overflow-hidden p-0 border-border shadow-sm">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold text-sm">GPU Utilization</h3>
                            <Select defaultValue="all">
                                <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
                                    <SelectValue placeholder="All Nodes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Nodes</SelectItem>
                                    <SelectItem value="node-0">node-0</SelectItem>
                                    <SelectItem value="node-1">node-1</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full overflow-x-auto max-h-[350px] overflow-y-auto">
                            <table className="w-full text-[11px] text-left whitespace-nowrap">
                                <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 font-bold w-10 text-center">상세</th>
                                        <th className="px-3 py-2 font-bold">Node</th>
                                        <th className="px-3 py-2 font-bold">Device</th>
                                        <th className="px-3 py-2 font-bold">GPU Type</th>
                                        <th className="px-3 py-2 font-bold">Status</th>
                                        <th className="px-3 py-2 font-bold">Model Name</th>
                                        <th className="px-3 py-2 font-bold text-center">MIG Mode</th>
                                        <th className="px-3 py-2 font-bold text-center">MIG_ID</th>
                                        <th className="px-3 py-2 font-bold text-center">MIG_PROFILE</th>
                                        <th className="px-3 py-2 font-bold">Namespace</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={10} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                    ) : (
                                        gpuDevices.map((device, idx) => (
                                            <tr key={device.uuid} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedGpu(device.id)}>
                                                <td className="px-3 py-2 text-center text-blue-500"><Search className="w-3 h-3 inline-block" /></td>
                                                <td className="px-3 py-2 font-mono text-muted-foreground">{device.node}</td>
                                                <td className="px-3 py-2">{device.id}</td>
                                                <td className="px-3 py-2">{device.type === 'P' ? 'Physical' : 'MIG'}</td>
                                                <td className="px-3 py-2">{device.status}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{device.model}</td>
                                                <td className="px-3 py-2 text-center">{device.migMode}</td>
                                                <td className="px-3 py-2 text-center">{device.migId}</td>
                                                <td className="px-3 py-2 text-center">{device.migProfile}</td>
                                                <td className="px-3 py-2">{device.namespace}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Table 2: GPU Utilization by Node (Top 5) */}
                    <Card className="overflow-hidden p-0 border-border shadow-sm">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold text-sm">GPU Utilization by Node (Top 5)</h3>
                            <button className="text-xs text-muted-foreground flex items-center hover:text-foreground">노드 목록으로 이동 <span className="ml-1">›</span></button>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-[11px] text-left whitespace-nowrap">
                                <thead className="bg-background text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-4 py-2 font-bold">Node</th>
                                        <th className="px-4 py-2 font-bold text-right">Total GPUs</th>
                                        <th className="px-4 py-2 font-bold text-right">Active GPUs</th>
                                        <th className="px-4 py-2 font-bold text-right">Idle GPUs</th>
                                        <th className="px-4 py-2 font-bold text-right">GPU Assigned Pods</th>
                                        <th className="px-4 py-2 font-bold text-center w-48">GPU Utilization</th>
                                        <th className="px-4 py-2 font-bold text-right">VRAM Usage</th>
                                        <th className="px-4 py-2 font-bold text-right">VRAM Total</th>
                                        <th className="px-4 py-2 font-bold text-right">Temperature</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={9} className="text-center py-4 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                    ) : (
                                        Object.entries(
                                            gpuDevices.reduce((acc, device) => {
                                                if (!acc[device.node]) {
                                                    acc[device.node] = { total: 0, active: 0, idle: 0, pTotal: 0, utilSum: 0, pods: 0, vram: 0, tempSum: 0 };
                                                }
                                                acc[device.node].total += 1;
                                                if (device.type === 'P') acc[device.node].pTotal += 1;
                                                if (device.status === 'Active') {
                                                    acc[device.node].active += 1;
                                                    acc[device.node].pods += 1; // Assuming 1 pod per active for mock
                                                    acc[device.node].vram += parseFloat(device.vramUsage);
                                                }
                                                if (device.status === 'Idle') acc[device.node].idle += 1;
                                                acc[device.node].utilSum += device.utilization;
                                                acc[device.node].tempSum += device.temperature;
                                                return acc;
                                            }, {} as Record<string, any>)
                                        ).map(([nodeName, stats]) => {
                                            const avgUtil = (stats.utilSum / stats.total).toFixed(2);
                                            const avgTemp = (stats.tempSum / stats.total).toFixed(0);
                                            return (
                                                <tr key={nodeName} className="hover:bg-muted/50 transition-colors">
                                                    <td className="px-4 py-2 font-mono text-muted-foreground">{nodeName}</td>
                                                    <td className="px-4 py-2 text-right">{stats.total}</td>
                                                    <td className="px-4 py-2 text-right">{stats.active}</td>
                                                    <td className="px-4 py-2 text-right">{stats.idle}</td>
                                                    <td className="px-4 py-2 text-right">{stats.pods}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center justify-end gap-2 w-full">
                                                            <span className="w-12 text-right">{avgUtil}%</span>
                                                            <div className="flex-1 max-w-[100px] h-2 bg-gray-200 dark:bg-gray-800 rounded-sm overflow-hidden">
                                                                <div className="h-full bg-blue-500" style={{ width: `${avgUtil}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">{stats.vram.toFixed(2)} GiB</td>
                                                    <td className="px-4 py-2 text-right">{(stats.pTotal * 40).toFixed(2)} GiB</td>
                                                    <td className="px-4 py-2 text-right">{avgTemp}°C</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Table 3: GPU Utilization by Pod (Top 5) */}
                    <Card className="overflow-hidden p-0 border-border shadow-sm">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold text-sm">GPU Utilization by Pod (Top 5)</h3>
                            <button className="text-xs text-muted-foreground flex items-center hover:text-foreground">Pod 목록으로 이동 <span className="ml-1">›</span></button>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-[11px] text-left whitespace-nowrap">
                                <thead className="bg-background text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-4 py-2 font-bold">Namespace</th>
                                        <th className="px-4 py-2 font-bold">CronJob</th>
                                        <th className="px-4 py-2 font-bold">Job</th>
                                        <th className="px-4 py-2 font-bold">Pod</th>
                                        <th className="px-4 py-2 font-bold text-center">Ready</th>
                                        <th className="px-4 py-2 font-bold">PodPhase</th>
                                        <th className="px-4 py-2 font-bold text-right">RestartCount</th>
                                        <th className="px-4 py-2 font-bold text-right">Age</th>
                                        <th className="px-4 py-2 font-bold text-center w-48">GPU Utilization</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={9} className="text-center py-4 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                    ) : (
                                        [...gpuDevices].sort((a, b) => b.utilization - a.utilization).filter(d => d.pod !== '-').slice(0, 5).map(device => (
                                            <tr key={device.uuid} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-4 py-2 {device.namespace !== '-' ? 'font-medium' : ''}">{device.namespace}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{device.cronJob}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{device.job}</td>
                                                <td className="px-4 py-2">{device.pod}</td>
                                                <td className="px-4 py-2 text-center">{device.ready}</td>
                                                <td className="px-4 py-2">{device.podPhase}</td>
                                                <td className="px-4 py-2 text-right">{device.restartCount}</td>
                                                <td className="px-4 py-2 text-right">{device.age}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        <span className="w-12 text-right">{device.utilization.toFixed(2)}%</span>
                                                        <div className="flex-1 max-w-[100px] h-2 bg-gray-200 dark:bg-gray-800 rounded-sm overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${device.utilization}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

            </div>

            <GpuDetailsSheet
                isOpen={!!selectedGpu}
                deviceId={selectedGpu}
                onClose={() => setSelectedGpu(null)}
            />
        </DashboardLayout>
    );
}
