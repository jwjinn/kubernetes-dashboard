import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { AcceleratorHexMap } from '@/features/accelerator/components/AcceleratorHexMap';
import { AcceleratorDetailsSheet } from '@/features/accelerator/components/AcceleratorDetailsSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAcceleratorDevices } from '@/api';
import type { AcceleratorDevice } from '@/features/accelerator/components/AcceleratorHexMap';
import { Search } from 'lucide-react';

export default function AcceleratorDashboardPage() {
    const acceleratorMode = (import.meta.env.VITE_ACCELERATOR_TYPE || 'GPU') as 'GPU' | 'NPU';
    const isNpu = acceleratorMode === 'NPU';

    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'None' | 'Node'>('Node');
    const [colorBy, setColorBy] = useState<'Status' | 'Utilization'>('Utilization');

    const { data: devices = [], isLoading } = useQuery<AcceleratorDevice[]>({
        queryKey: ['acceleratorDevices', acceleratorMode],
        queryFn: () => fetchAcceleratorDevices(acceleratorMode),
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
            const seed = selectedMapNode.charCodeAt(selectedMapNode.length - 1);
            utilSeries = [
                { name: 'dev-0', type: 'line', data: genData(40, 40, seed), smooth: true, showSymbol: false },
                { name: 'dev-1', type: 'line', data: genData(70, 30, seed + 1), smooth: true, showSymbol: false },
            ];
            tempSeries = [
                { name: 'dev-0', type: 'line', data: genData(50, 10, seed), smooth: true, showSymbol: false },
                { name: 'dev-1', type: 'line', data: genData(65, 15, seed + 1), smooth: true, showSymbol: false },
            ];
            vramSeries = [
                { name: 'dev-0', type: 'line', data: genVramData(150000, seed), smooth: true, showSymbol: false },
                { name: 'dev-1', type: 'line', data: genVramData(80000, seed + 1), smooth: true, showSymbol: false },
            ];
            smSeries = [
                { name: 'dev-0', type: 'line', data: genSmData(30, seed), smooth: true, showSymbol: false },
                { name: 'dev-1', type: 'line', data: genSmData(60, seed + 1), smooth: true, showSymbol: false },
            ];
        } else {
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
            xAxis: { type: 'category' as const, boundaryGap: false, data: timeAxis },
            color: isNpu ? ['#22c55e', '#10b981', '#059669', '#047857', '#065f46'] : ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a']
        };

        return {
            utilData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: utilSeries },
            tempData: { ...commonOptions, yAxis: { type: 'value' as const, max: 90 }, series: tempSeries },
            vramData: { ...commonOptions, yAxis: { type: 'value' as const }, series: vramSeries },
            smData: { ...commonOptions, yAxis: { type: 'value' as const, max: 100 }, series: smSeries }
        };
    }, [selectedMapNode, isNpu]);

    const summaryStats = useMemo(() => {
        const stats = {
            totalNodes: new Set(devices.map(d => d.node)).size,
            physicalTotal: 0,
            physicalActive: 0,
            migTotal: 0,
            migActive: 0,
            migIdle: 0
        };

        devices.forEach(device => {
            if (!device.type || device.type === 'P') {
                stats.physicalTotal++;
                if (device.status === 'Active') stats.physicalActive++;
            } else if (device.type === 'M') {
                stats.migTotal++;
                if (device.status === 'Active') stats.migActive++;
                if (device.status === 'Idle') stats.migIdle++;
            }
        });

        return stats;
    }, [devices]);

    const primaryColorClass = isNpu ? 'text-green-500' : 'text-blue-500';
    const primaryBgClass = isNpu ? 'bg-green-500' : 'bg-blue-500';
    const primaryTitle = isNpu ? 'NPU' : 'GPU';

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{primaryTitle} 대시보드</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        노드-{primaryTitle}({isNpu ? 'Core' : 'MIG'})-Pod간의 연결 관계를 추적하고, 리소스 과다/편중 사용 및 미사용 {primaryTitle} 등 이상 징후를 한눈에 파악합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 border-border shadow-sm flex flex-col justify-between">
                        <Text className="font-bold text-foreground mb-4">{primaryTitle} Node</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.totalNodes}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className={`flex items-center gap-1.5 text-xs font-bold ${primaryColorClass} uppercase mb-1`}>
                                    <div className={`w-2.5 h-2.5 ${primaryBgClass} rounded-sm`}></div> Ready
                                </Text>
                                <Metric className={`text-4xl font-black ${primaryColorClass}`}>{summaryStats.totalNodes}</Metric>
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
                                <Text className={`flex items-center gap-1.5 text-[11px] font-bold ${primaryColorClass} uppercase mb-1 whitespace-nowrap`}>
                                    <div className={`w-2.5 h-2.5 ${primaryBgClass} rounded-[3px]`}></div> {primaryTitle} 사용 중
                                </Text>
                                <Metric className={`text-4xl font-black ${primaryColorClass}`}>{summaryStats.physicalActive + summaryStats.migActive}</Metric>
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
                                <Text className={`flex items-center gap-1.5 text-xs font-bold ${primaryColorClass} uppercase mb-1`}>
                                    <div className={`w-2.5 h-2.5 ${primaryBgClass} rounded-sm`}></div> Active
                                </Text>
                                <Metric className={`text-4xl font-black ${primaryColorClass}`}>{summaryStats.physicalActive}</Metric>
                            </div>
                        </div>
                    </Card>

                    <Card className={`p-4 border-border shadow-sm flex flex-col justify-between ${isNpu ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Text className="font-bold text-foreground mb-4">MIG (GPU Only)</Text>
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col items-center">
                                <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Total</Text>
                                <Metric className="text-4xl font-black text-foreground">{summaryStats.migTotal}</Metric>
                            </div>
                            <div className="flex flex-col items-center">
                                <Text className={`flex items-center gap-1.5 text-xs font-bold ${primaryColorClass} uppercase mb-1`}>
                                    <div className={`w-2.5 h-2.5 ${primaryBgClass} rounded-sm`}></div> Active
                                </Text>
                                <Metric className={`text-4xl font-black ${primaryColorClass}`}>{summaryStats.migActive}</Metric>
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
                    <Card className="col-span-1 border border-border flex flex-col p-0 overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-lg font-bold mb-4">{primaryTitle} Map</h3>
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
                                            <SelectItem value="Utilization">Utilization</SelectItem>
                                            <SelectItem value="Status">Status</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-[400px] w-full flex bg-background relative">
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-[10px] text-muted-foreground font-medium">
                                {colorBy === 'Utilization' ? (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${isNpu ? 'bg-green-600' : 'bg-blue-600'}`}></div> ~100%</div>
                                        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${isNpu ? 'bg-green-500' : 'bg-blue-500'}`}></div> ~80%</div>
                                        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${isNpu ? 'bg-green-400' : 'bg-blue-400'}`}></div> ~60%</div>
                                        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${isNpu ? 'bg-green-300' : 'bg-blue-300'}`}></div> ~40%</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 border border-border"></div> ~0%</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${primaryBgClass} rounded-sm`}></div> Active</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Idle</div>
                                    </>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading {primaryTitle} Map...</div>
                            ) : (
                                <div className="w-full h-full flex-1 pt-8 pl-16 overflow-auto">
                                    <AcceleratorHexMap data={devices} acceleratorType={acceleratorMode} selectedNode={selectedMapNode} onNodeSelect={setSelectedMapNode} groupBy={groupBy} colorBy={colorBy} />
                                </div>
                            )}
                        </div>
                    </Card>

                    <div className="col-span-2 flex flex-col space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? (isNpu ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20') : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? 'Node Memory' : 'Total Memory'}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '32.00' : '293.13'} <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? (isNpu ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20') : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? 'Node Memory Usage' : 'Total Memory Usage'}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '18.4' : '79.84'} <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? (isNpu ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20') : ''}`}>
                                <Text className="font-bold text-foreground mb-4">{selectedMapNode ? `Node ${primaryTitle} Util` : `Avg ${primaryTitle} Utilization`}</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    {selectedMapNode ? '65.2' : '21.43'} <span className="text-lg text-muted-foreground font-semibold">%</span>
                                </Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-start transition-colors border-border shadow-sm ${selectedMapNode ? (isNpu ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20') : ''}`}>
                                <Text className="font-bold text-foreground mb-4">Avg Memory Usage</Text>
                                <Metric className="text-3xl font-black text-foreground">
                                    9.04 <span className="text-lg text-muted-foreground font-semibold">GiB</span>
                                </Metric>
                            </Card>
                        </div>

                        <Card className={`p-0 flex-1 flex flex-col overflow-hidden ${selectedMapNode ? (isNpu ? 'border-green-500/20 shadow-green-500/10' : 'border-blue-500/20 shadow-blue-500/10') : ''}`}>
                            <div className="px-4 py-3 border-b border-border bg-muted/20">
                                <h3 className="font-bold text-sm">
                                    {selectedMapNode ? `Performance for Node: ${selectedMapNode}` : `${primaryTitle} Performance Summary (Top 5)`}
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Utilization (%) {selectedMapNode ? '(Node Accelerators)' : ''}</Text>
                                    <ReactECharts option={utilData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Memory Usage (MiB) {selectedMapNode ? '(Node Accelerators)' : ''}</Text>
                                    <ReactECharts option={vramData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">Temperature (°C) {selectedMapNode ? '(Node Accelerators)' : ''}</Text>
                                    <ReactECharts option={tempData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                                <div className="h-full">
                                    <Text className="font-bold text-xs mb-2 text-foreground">SM/Core Active (%) {selectedMapNode ? '(Node Accelerators)' : ''}</Text>
                                    <ReactECharts option={smData} style={{ height: '240px' }} notMerge={true} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="overflow-hidden p-0 border-border shadow-sm">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold text-sm">{primaryTitle} Utilization</h3>
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
                                        <th className="px-3 py-2 font-bold">Type</th>
                                        <th className="px-3 py-2 font-bold">Status</th>
                                        <th className="px-3 py-2 font-bold">Model Name</th>
                                        {!isNpu && (
                                            <>
                                                <th className="px-3 py-2 font-bold text-center">MIG Mode</th>
                                                <th className="px-3 py-2 font-bold text-center">MIG_ID</th>
                                                <th className="px-3 py-2 font-bold text-center">MIG_PROFILE</th>
                                            </>
                                        )}
                                        <th className="px-3 py-2 font-bold">Namespace</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={isNpu ? 7 : 10} className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                    ) : (
                                        devices.map((device, idx) => (
                                            <tr key={device.uuid} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedDevice(device.id)}>
                                                <td className={`px-3 py-2 text-center flex justify-center content-center ${primaryColorClass}`}><Search className="w-3 h-3" /></td>
                                                <td className="px-3 py-2 font-mono text-muted-foreground">{device.node}</td>
                                                <td className="px-3 py-2">{device.id}</td>
                                                <td className="px-3 py-2">{device.type === 'P' ? 'Physical' : (device.type === 'M' ? 'MIG' : 'NPU Core')}</td>
                                                <td className="px-3 py-2">{device.status}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{device.model}</td>
                                                {!isNpu && (
                                                    <>
                                                        <td className="px-3 py-2 text-center">{device.migMode}</td>
                                                        <td className="px-3 py-2 text-center">{device.migId}</td>
                                                        <td className="px-3 py-2 text-center">{device.migProfile}</td>
                                                    </>
                                                )}
                                                <td className="px-3 py-2">{device.namespace}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>

            <AcceleratorDetailsSheet
                isOpen={!!selectedDevice}
                deviceId={selectedDevice}
                acceleratorType={acceleratorMode}
                onClose={() => setSelectedDevice(null)}
            />
        </DashboardLayout>
    );
}
