import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { NpuHexMap } from '@/features/npu/components/NpuHexMap';
import { NpuDetailsSheet } from '@/features/npu/components/NpuDetailsSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuDevices } from '@/api';
import type { NpuDevice } from '@/features/npu/components/NpuHexMap';
import { Search, Zap } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function NpuDashboardPage() {
    const [selectedNpu, setSelectedNpu] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'None' | 'Node'>('Node');
    const [colorBy, setColorBy] = useState<'Status' | 'NPU Utilization'>('NPU Utilization');

    const { data: npuDevices = [], isLoading } = useQuery<NpuDevice[]>({
        queryKey: ['npuDevices'],
        queryFn: fetchNpuDevices,
        refetchInterval: 5000
    });

    const { utilData, tempData, vramData, powerData } = useMemo(() => {
        const timeAxis = ['17:00', '17:10', '17:20', '17:30', '17:40', '17:50', '18:00', '18:10', '18:20', '18:30'];

        const genData = (base: number, volatility: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.min(100, Math.max(0, base + Math.sin(i * seed) * volatility)));

        const genVramData = (base: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.max(0, base + Math.sin(i * seed) * 3));

        const genPowerData = (base: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.max(0, base + Math.cos(i * seed) * 20));

        let utilSeries = [];
        let tempSeries = [];
        let vramSeries = [];
        let powerSeries = [];

        // Distinguishable green palette
        const colors = ['#22c55e', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6'];

        if (selectedMapNode) {
            const seed = selectedMapNode.charCodeAt(selectedMapNode.length - 1);
            utilSeries = [
                { name: 'npu-0', type: 'line', data: genData(40, 40, seed), smooth: true, showSymbol: false, itemStyle: { color: colors[0] } },
                { name: 'npu-1', type: 'line', data: genData(70, 30, seed + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[1] } },
            ];
            tempSeries = [
                { name: 'npu-0', type: 'line', data: genData(50, 10, seed), smooth: true, showSymbol: false, itemStyle: { color: colors[2] } },
                { name: 'npu-1', type: 'line', data: genData(65, 15, seed + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[3] } },
            ];
            vramSeries = [
                { name: 'npu-0', type: 'line', data: genVramData(8, seed), smooth: true, showSymbol: false, itemStyle: { color: colors[4] } },
                { name: 'npu-1', type: 'line', data: genVramData(12, seed + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[5] } },
            ];
            powerSeries = [
                { name: 'npu-0', type: 'line', data: genPowerData(120, seed), smooth: true, showSymbol: false, itemStyle: { color: colors[0] } },
                { name: 'npu-1', type: 'line', data: genPowerData(150, seed + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[1] } },
            ];
        } else {
            const nodes = ['node-0', 'node-1', 'node-2', 'node-3'];
            const baseUtils = [30, 80, 50, 20];
            const baseTemps = [45, 75, 55, 40];
            const baseVrams = [4, 12, 8, 2];
            const basePowers = [100, 180, 140, 80];

            utilSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseUtils[idx], 20, idx + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[idx % colors.length] }
            }));
            tempSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genData(baseTemps[idx], 10, idx + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[(idx + 1) % colors.length] }
            }));
            vramSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genVramData(baseVrams[idx], idx + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[(idx + 2) % colors.length] }
            }));
            powerSeries = nodes.map((node, idx) => ({
                name: node, type: 'line', data: genPowerData(basePowers[idx], idx + 1), smooth: true, showSymbol: false, itemStyle: { color: colors[(idx + 3) % colors.length] }
            }));
        }

        const commonOptions = {
            tooltip: { trigger: 'axis' as const },
            legend: {
                show: true,
                textStyle: { color: '#666', fontSize: 10 },
                top: 0
            },
            grid: { left: '8%', right: '5%', bottom: '15%', top: '20%' },
            xAxis: {
                type: 'category' as const,
                boundaryGap: false,
                data: timeAxis,
                axisLabel: { color: '#888', fontSize: 10 }
            }
        };

        return {
            utilData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: utilSeries },
            tempData: { ...commonOptions, yAxis: { type: 'value' as const, max: 90 }, series: tempSeries },
            vramData: { ...commonOptions, yAxis: { type: 'value' as const, max: 16 }, series: vramSeries },
            powerData: { ...commonOptions, yAxis: { type: 'value' as const, max: 300 }, series: powerSeries }
        };
    }, [selectedMapNode]);

    const summaryStats = useMemo(() => {
        const stats = {
            totalNodes: new Set(npuDevices.map(d => d.node)).size,
            npuTotal: npuDevices.length,
            npuActive: npuDevices.filter(d => d.status === 'Active').length,
            npuIdle: npuDevices.filter(d => d.status === 'Idle').length,
            totalVram: npuDevices.reduce((acc, d) => acc + parseInt(d.vramTotal), 0),
            usedVram: npuDevices.reduce((acc, d) => acc + parseInt(d.vramUsage), 0),
        };
        return stats;
    }, [npuDevices]);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Zap className="w-6 h-6 text-green-500 fill-green-500/20" /> Rebellion ATOM NPU Dashboard
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Rebellion ATOM 가속기 자원의 실시간 토폴로지와 성능 지표를 모니터링합니다.
                        </p>
                    </div>
                </div>

                {/* 1. NPU 리소스 상태 요약 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">NPU Node</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.totalNodes}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-green-600 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> Ready
                                </Text>
                                <Metric className="text-4xl font-black text-green-500">{summaryStats.totalNodes}</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">Active NPUs</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.npuTotal}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-green-600 uppercase mb-1">
                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> Running
                                </Text>
                                <Metric className="text-4xl font-black text-green-500">{summaryStats.npuActive}</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">Memory (VRAM)</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-3xl font-black text-foreground">{summaryStats.totalVram} <span className="text-sm">GiB</span></Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className="flex items-center gap-1.5 text-xs font-bold text-green-600 uppercase mb-1">
                                    Used
                                </Text>
                                <Metric className="text-3xl font-black text-green-500">{summaryStats.usedVram} <span className="text-sm">GiB</span></Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">Avg Utilization</Text>
                        <div className="pb-2">
                            <Metric className="text-4xl font-black text-green-500">
                                {npuDevices.length > 0 ? (npuDevices.reduce((acc, d) => acc + d.utilization, 0) / npuDevices.length).toFixed(1) : 0}%
                            </Metric>
                            <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" style={{ width: '45%' }}></div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. NPU Map */}
                    <Card className="col-span-1 border border-border flex flex-col p-0 overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-lg font-bold mb-4">NPU Map (ATOM Topology)</h3>
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
                                            <SelectItem value="NPU Utilization">NPU Utilization</SelectItem>
                                            <SelectItem value="Status">Status</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-[400px] w-full flex bg-background relative">
                            {/* Legend Overlay */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-[10px] text-muted-foreground font-medium">
                                {colorBy === 'NPU Utilization' ? (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-700"></div> ~100%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-600"></div> ~80%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500"></div> ~60%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400"></div> ~40%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-300"></div> ~20%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-100 border border-border"></div> 0%</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Active</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Idle</div>
                                    </>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading NPU Map...</div>
                            ) : (
                                <div className="w-full h-full flex-1 pt-8 pl-16 overflow-auto">
                                    <NpuHexMap data={npuDevices} selectedNode={selectedMapNode} onNodeSelect={setSelectedMapNode} groupBy={groupBy} colorBy={colorBy} />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* 3. Performance Summary */}
                    <div className="col-span-2 flex flex-col space-y-6">
                        <Card className={`p-0 flex-1 flex flex-col overflow-hidden ${selectedMapNode ? 'border-green-500/20 shadow-green-500/10' : ''}`}>
                            <div className="px-4 py-3 border-b border-border bg-muted/20">
                                <h3 className="font-bold text-sm">
                                    {selectedMapNode ? `Performance for Node: ${selectedMapNode}` : 'NPU Performance Summary (Overview)'}
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Utilization (%)</Text>
                                    <ReactECharts option={utilData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">VRAM Usage (GiB)</Text>
                                    <ReactECharts option={vramData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Temperature (°C)</Text>
                                    <ReactECharts option={tempData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Power Consumption (W)</Text>
                                    <ReactECharts option={powerData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* 4. NPU 상세 데이터 테이블 */}
                <Card className="overflow-hidden p-0 border-border shadow-sm">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                        <h3 className="font-bold text-sm">NPU Inventory & Utilization</h3>
                    </div>
                    <div className="w-full overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-[11px] text-left whitespace-nowrap">
                            <thead className="bg-background text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 font-bold w-10 text-center">상세</th>
                                    <th className="px-3 py-2 font-bold">Node</th>
                                    <th className="px-3 py-2 font-bold">Device ID</th>
                                    <th className="px-3 py-2 font-bold">Status</th>
                                    <th className="px-3 py-2 font-bold">Model</th>
                                    <th className="px-3 py-2 font-bold text-center">Utilization</th>
                                    <th className="px-3 py-2 font-bold">Memory Usage</th>
                                    <th className="px-3 py-2 font-bold text-center">Temp</th>
                                    <th className="px-3 py-2 font-bold">Running Pod</th>
                                    <th className="px-3 py-2 font-bold">Namespace</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr><td colSpan={10} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                ) : (
                                    npuDevices.map((device) => (
                                        <tr key={device.uuid} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedNpu(device.id)}>
                                            <td className="px-3 py-2 text-center text-green-500"><Search className="w-3 h-3 inline-block" /></td>
                                            <td className="px-3 py-2 font-mono text-muted-foreground">{device.node}</td>
                                            <td className="px-3 py-2 font-bold">{device.id}</td>
                                            <td className="px-3 py-2">
                                                <Badge variant={device.status === 'Active' ? 'default' : 'secondary'} className={device.status === 'Active' ? 'bg-green-500/80' : ''}>
                                                    {device.status}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">{device.model}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-green-500" style={{ width: `${device.utilization}%` }}></div>
                                                    </div>
                                                    <span className="w-8 text-right underline decoration-green-500/30">{device.utilization}%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 font-medium">{device.vramUsage} / {device.vramTotal}</td>
                                            <td className="px-3 py-2 text-center font-mono">{device.temperature}°C</td>
                                            <td className="px-3 py-2 text-green-600 font-medium">{device.pod}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{device.namespace}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <NpuDetailsSheet
                isOpen={!!selectedNpu}
                deviceId={selectedNpu}
                onClose={() => setSelectedNpu(null)}
            />
        </DashboardLayout>
    );
}
