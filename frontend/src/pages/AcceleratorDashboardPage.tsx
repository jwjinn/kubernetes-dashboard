import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { AcceleratorHexMap } from '@/features/accelerator/components/AcceleratorHexMap';
import { AcceleratorDetailsSheet } from '@/features/accelerator/components/AcceleratorDetailsSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAcceleratorDevices } from '@/api';
import type { AcceleratorDevice } from '@/features/accelerator/components/AcceleratorHexMap';
import { Search } from 'lucide-react';
import { ClusterOverviewView } from '@/features/accelerator/components/ClusterOverviewView';
import { HardwareDetailsView } from '@/features/accelerator/components/HardwareDetailsView';
import { WorkloadMappingView } from '@/features/accelerator/components/WorkloadMappingView';
import { NpuDeviceHistoryView } from '@/features/accelerator/components/NpuDeviceHistoryView';
import { getEnv } from '@/config/env';

export default function AcceleratorDashboardPage() {
    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU') as 'GPU' | 'NPU';
    const isNpu = acceleratorMode === 'NPU';

    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'None' | 'Node'>('Node');
    const [colorBy, setColorBy] = useState<'Status' | 'Utilization'>('Utilization');
    const [activeTab, setActiveTab] = useState('overview');

    const { data: devices = [], isLoading } = useQuery<AcceleratorDevice[]>({
        queryKey: ['acceleratorDevices', acceleratorMode],
        queryFn: () => fetchAcceleratorDevices(acceleratorMode),
        refetchInterval: 5000
    });

    const summaryStats = useMemo(() => {
        const totalNodes = new Set(devices.map(d => d.node)).size;
        const totalDevices = devices.length;
        const activeDevices = devices.filter(d => d.status === 'Active').length;
        const idleDevices = totalDevices - activeDevices;

        let activeMig = 0;
        let idleMig = 0;

        if (!isNpu) {
            devices.forEach(d => {
                if (d.type === 'M') {
                    if (d.status === 'Active') activeMig++;
                    else idleMig++;
                }
            });
        }

        return {
            totalNodes,
            totalDevices,
            activeDevices,
            idleDevices,
            activeMig,
            idleMig
        };
    }, [devices, isNpu]);

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

    return (
        <DashboardLayout>
            <div className="flex flex-col space-y-6 mt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isNpu ? 'NPU Dashboard' : 'GPU Dashboard'}
                        </h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                            Hardware utilization, cluster metrics, and pod allocation
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isNpu ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                                {isNpu ? 'ATOM / RBLN-CA25' : 'NVIDIA / MIG'}
                            </span>
                        </p>
                    </div>
                </div>

                {isNpu ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                        <TabsList className="bg-muted border-border border">
                            <TabsTrigger value="overview">Cluster Overview</TabsTrigger>
                            <TabsTrigger value="hardware">Hardware Details</TabsTrigger>
                            <TabsTrigger value="workload">Workload & Pod Mapping</TabsTrigger>
                            <TabsTrigger value="history">Device History</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="overview">
                            <ClusterOverviewView />
                        </TabsContent>

                        <TabsContent value="hardware">
                            <HardwareDetailsView />
                        </TabsContent>

                        <TabsContent value="workload">
                            <WorkloadMappingView />
                        </TabsContent>

                        <TabsContent value="history">
                            <NpuDeviceHistoryView />
                        </TabsContent>
                    </Tabs>
                ) : (
                    // Classic view for GPU
                    <>
                        {/* Summary Stats Grid */}
                        <Grid numItems={2} numItemsSm={2} numItemsLg={4} className="gap-6">
                            <Card className="p-4 border-border shadow-sm rounded-lg flex flex-col justify-between" decoration="top" decorationColor={isNpu ? "emerald" : "blue"}>
                                <Text className="font-bold text-foreground">Total Nodes</Text>
                                <Metric className="text-4xl text-foreground font-black mt-2">{summaryStats.totalNodes}</Metric>
                            </Card>
                            
                            {!isNpu && (
                                <Card className="p-4 border-border shadow-sm rounded-lg flex flex-col justify-between">
                                    <Text className="font-bold text-foreground">Mig Instances (Active / Idle)</Text>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <Metric className="text-4xl text-blue-500 font-black">{summaryStats.activeMig}</Metric>
                                        <Text className="text-lg text-muted-foreground font-bold">/ {summaryStats.idleMig}</Text>
                                    </div>
                                </Card>
                            )}

                            <Card className="p-4 border-border shadow-sm rounded-lg flex flex-col justify-between relative overflow-hidden">
                                <Text className="font-bold text-foreground relative z-10">Total Devices / Allocated</Text>
                                <div className="flex items-baseline gap-2 mt-2 relative z-10">
                                    <Metric className="text-4xl text-foreground font-black">{summaryStats.totalDevices}</Metric>
                                    <Text className="text-lg text-muted-foreground font-bold">/ {summaryStats.activeDevices}</Text>
                                </div>
                                <div className="absolute right-0 bottom-0 opacity-10 blur-xl">
                                    <div className={`w-32 h-32 rounded-full ${isNpu ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                </div>
                            </Card>
                            
                            <Card className="p-4 border-border shadow-sm rounded-lg flex flex-col justify-between">
                                <Text className="font-bold text-foreground">Cluster Utilization</Text>
                                <Metric className="text-4xl text-foreground font-black mt-2">
                                    {summaryStats.totalDevices > 0 ? Math.round((summaryStats.activeDevices / summaryStats.totalDevices) * 100) : 0}%
                                </Metric>
                            </Card>
                        </Grid>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* HexMap Section */}
                            <Card className="col-span-1 border border-border rounded-xl flex flex-col p-0 overflow-hidden shadow-sm lg:min-h-[600px]">
                                <div className="p-4 border-b border-border bg-card">
                                    <h3 className="text-lg font-bold mb-4">{isNpu ? 'NPU Map' : 'GPU Map'}</h3>
                                    <div className="flex gap-4">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-xs text-muted-foreground font-bold">Group by</label>
                                            <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                                                <SelectTrigger className="h-8 text-xs bg-muted/50 border-border">
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
                                                <SelectTrigger className="h-8 text-xs bg-muted/50 border-border">
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
                                    {/* Legend */}
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
                                                <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${isNpu ? 'bg-green-500' : 'bg-blue-500'} rounded-sm`}></div> Active</div>
                                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Idle</div>
                                            </>
                                        )}
                                    </div>

                                    {isLoading ? (
                                        <div className="w-full h-full flex items-center justify-center animate-pulse text-muted-foreground">Loading Map...</div>
                                    ) : (
                                        <AcceleratorHexMap 
                                            data={devices} 
                                            acceleratorType={acceleratorMode} 
                                            selectedNode={selectedMapNode} 
                                            onNodeSelect={setSelectedMapNode} 
                                            groupBy={groupBy} 
                                            colorBy={colorBy} 
                                        />
                                    )}
                                </div>
                            </Card>

                            {/* Charts Section */}
                            <div className="col-span-2 flex flex-col space-y-6">
                                <Card className="p-0 border-border rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                                     <div className="px-4 py-3 border-b border-border bg-card">
                                        <h3 className="text-sm font-bold">{selectedMapNode ? `Node View: ${selectedMapNode}` : `Cluster View`}</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                                        <div className="h-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <Text className="font-bold text-xs text-foreground uppercase tracking-widest">Utilization (%)</Text>
                                            </div>
                                            <ReactECharts option={utilData} style={{ height: '200px' }} notMerge={true} />
                                        </div>
                                        <div className="h-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <Text className="font-bold text-xs text-foreground uppercase tracking-widest">Memory Usage (MiB)</Text>
                                            </div>
                                            <ReactECharts option={vramData} style={{ height: '200px' }} notMerge={true} />
                                        </div>
                                        <div className="h-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <Text className="font-bold text-xs text-foreground uppercase tracking-widest">Temperature (°C)</Text>
                                            </div>
                                            <ReactECharts option={tempData} style={{ height: '200px' }} notMerge={true} />
                                        </div>
                                        <div className="h-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <Text className="font-bold text-xs text-foreground uppercase tracking-widest">{isNpu ? 'NPU Core Util (%)' : 'SM Active (%)'}</Text>
                                            </div>
                                            <ReactECharts option={smData} style={{ height: '200px' }} notMerge={true} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* List / Table Section */}
                        <Card className="p-0 border-border rounded-xl shadow-sm overflow-hidden mt-6">
                            <div className="px-4 py-3 border-b border-border bg-card flex justify-between items-center">
                                <h3 className="text-sm font-bold">Device Insights & Workload Details</h3>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-2.5 top-2 text-muted-foreground" />
                                        <input type="text" placeholder="Search devices..." className="h-8 w-64 bg-muted/50 border border-border rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Node</th>
                                            <th className="px-4 py-3 font-semibold">Device ID</th>
                                            <th className="px-4 py-3 font-semibold">Type</th>
                                            <th className="px-4 py-3 font-semibold text-center">Status</th>
                                            <th className="px-4 py-3 font-semibold">Model</th>
                                            {!isNpu && <th className="px-4 py-3 font-semibold">MIG Info</th>}
                                            <th className="px-4 py-3 font-semibold">Namespace</th>
                                            <th className="px-4 py-3 font-semibold">Pod</th>
                                            <th className="px-4 py-3 font-semibold">VRAM</th>
                                            <th className="px-4 py-3 font-semibold">Temp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground animate-pulse">Loading device data...</td>
                                            </tr>
                                        ) : devices.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No devices found.</td>
                                            </tr>
                                        ) : (
                                            devices.map((device) => (
                                                <tr key={`${device.node}-${device.id}`} 
                                                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedDevice(device.id)}
                                                >
                                                    <td className="px-4 py-3 font-medium text-foreground">{device.node}</td>
                                                    <td className="px-4 py-3 font-mono text-muted-foreground">{device.id}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs font-semibold">{device.type}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {device.status === 'Active' ? (
                                                            <div className={`inline-flex items-center justify-center w-3 h-3 rounded-full ${isNpu ? 'bg-green-500' : 'bg-blue-500'} ring-4 ${isNpu ? 'ring-green-500/20' : 'ring-blue-500/20'}`}></div>
                                                        ) : (
                                                            <div className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">{device.model}</td>
                                                    
                                                    {!isNpu && (
                                                        <td className="px-4 py-3">
                                                            {device.type === 'M' ? (
                                                                <div className="flex flex-col text-xs">
                                                                    <span className="text-muted-foreground">ID: {device.migId}</span>
                                                                    <span>{device.migProfile}</span>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">{device.namespace}</td>
                                                    <td className="px-4 py-3">{device.pod}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className={`h-full ${isNpu ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(parseInt(device.vramUsage) / parseInt(device.vramTotal)) * 100}%` }}></div>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{device.vramUsage}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">{device.temperature}°C</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                )}

                <AcceleratorDetailsSheet 
                    isOpen={!!selectedDevice} 
                    deviceId={selectedDevice} 
                    acceleratorType={acceleratorMode}
                    onClose={() => setSelectedDevice(null)} 
                />
            </div>
        </DashboardLayout>
    );
}
