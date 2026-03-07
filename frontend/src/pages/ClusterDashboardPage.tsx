import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex, ProgressBar } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { Server, Activity, Database, Network, Cpu, HardDrive, Share2, Layers, CheckCircle2 } from 'lucide-react';

// Mock Data Types
interface NodeMetrics {
    nodeId: string;
    cpuUtil: number;
    memTotal: number;
    memUsed: number;
    memBuffers: number;
    memCached: number;
    diskReads: number; // MB/s
    diskWrites: number; // MB/s
    fsUsedPercent: number;
    netRx: number; // MB/s
    netTx: number; // MB/s
    tcpEstablished: number;
    load1m: number;
    load5m: number;
    load15m: number;
    status: 'Ready' | 'NotReady';
}

export default function ClusterDashboardPage() {
    // State for interactive node filtering
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

    // 1. Generate Base Mock Data (All Nodes)
    const baseNodes: NodeMetrics[] = useMemo(() => [
        { nodeId: 'cluster-master-01', cpuUtil: 15.2, memTotal: 64, memUsed: 12.4, memBuffers: 1.2, memCached: 8.5, diskReads: 1.2, diskWrites: 5.4, fsUsedPercent: 32, netRx: 12.1, netTx: 8.5, tcpEstablished: 120, load1m: 0.8, load5m: 1.2, load15m: 1.1, status: 'Ready' },
        { nodeId: 'gpu-node-01', cpuUtil: 45.8, memTotal: 256, memUsed: 84.2, memBuffers: 4.5, memCached: 32.1, diskReads: 45.2, diskWrites: 120.5, fsUsedPercent: 65, netRx: 450.2, netTx: 125.4, tcpEstablished: 1450, load1m: 4.5, load5m: 3.8, load15m: 3.2, status: 'Ready' },
        { nodeId: 'gpu-node-02', cpuUtil: 32.1, memTotal: 256, memUsed: 42.1, memBuffers: 3.8, memCached: 25.4, diskReads: 12.5, diskWrites: 45.2, fsUsedPercent: 12, netRx: 210.5, netTx: 85.2, tcpEstablished: 890, load1m: 2.1, load5m: 2.5, load15m: 2.8, status: 'Ready' },
        { nodeId: 'npu-node-01', cpuUtil: 68.9, memTotal: 512, memUsed: 312.5, memBuffers: 12.4, memCached: 85.2, diskReads: 150.2, diskWrites: 220.8, fsUsedPercent: 48, netRx: 850.5, netTx: 620.1, tcpEstablished: 2100, load1m: 8.2, load5m: 7.5, load15m: 6.8, status: 'Ready' },
    ], []);

    // 2. Filter nodes based on selection
    const visibleNodes = useMemo(() =>
        selectedNodes.length === 0 ? baseNodes : baseNodes.filter(n => selectedNodes.includes(n.nodeId)),
        [baseNodes, selectedNodes]);

    // 3. Generate Time Series Data based on visible nodes
    const {
        cpuTimeSeries,
        memTimeSeries,
        diskIoSeries,
        netIoSeries,
        loadTimeSeries,
        fsUsageData,
        tcpConnSeries
    } = useMemo(() => {
        const timeAxis = ['17:00', '17:10', '17:20', '17:30', '17:40', '17:50', '18:00', '18:10', '18:20', '18:30'];
        const visibleNodeNames = visibleNodes.map(n => n.nodeId);

        // Map original node names to keep consistent colors
        const allNodeNames = ['cluster-master-01', 'gpu-node-01', 'gpu-node-02', 'npu-node-01'];
        const nodeColorMap: Record<string, string> = {
            'cluster-master-01': '#94a3b8',
            'gpu-node-01': '#3b82f6',
            'gpu-node-02': '#2563eb',
            'npu-node-01': '#10b981'
        };

        const genData = (base: number, volatility: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.max(0, base + Math.sin(i * seed) * volatility + (Math.random() * 5)));

        const commonChartOptions = {
            tooltip: { trigger: 'axis' },
            grid: { left: '10%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: timeAxis },
            yAxis: { type: 'value' },
        };

        // Shared legend configuration to prevent multi-line wrapping and handle long names
        const createLegendConfig = (dataNames: string[]) => ({
            type: 'scroll',
            bottom: 0,
            data: dataNames,
            textStyle: { fontSize: 11 },
            tooltip: { show: true },
            formatter: (name: string) => name.length > 20 ? name.substring(0, 10) + '...' + name.substring(name.length - 8) : name
        });

        // Factory to create series for visible nodes
        const createMultiNodeSeries = (metricExtractor: (n: NodeMetrics) => number, volatilityExtractor: (n: NodeMetrics) => number) => {
            return visibleNodes.map((node, i) => ({
                name: node.nodeId,
                type: 'line',
                smooth: true,
                showSymbol: false,
                data: genData(metricExtractor(node), volatilityExtractor(node), i + 1),
                itemStyle: { color: nodeColorMap[node.nodeId] },
                areaStyle: { opacity: 0.05, color: nodeColorMap[node.nodeId] }
            }));
        };

        const cpuTimeSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames),
            yAxis: { type: 'value', max: 100 },
            series: createMultiNodeSeries(n => n.cpuUtil, n => n.cpuUtil * 0.2)
        };

        const memTimeSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames),
            series: createMultiNodeSeries(n => n.memUsed, n => n.memUsed * 0.1)
        };

        const loadTimeSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames.map(name => `${name} (1m)`)),
            series: visibleNodes.map((node, i) => ({
                name: `${node.nodeId} (1m)`, type: 'line', smooth: true, showSymbol: false,
                data: genData(node.load1m * 10, node.load1m * 2, i + 10), // Multiplied by 10 for visibility in mock
                itemStyle: { color: nodeColorMap[node.nodeId] }
            }))
        };

        // To keep charts readable, we can sum READ+WRITE for disk if multi-node, or show separated if 1 node.
        // For per-node metric separation, we show the Total Disk I/O (Read+Write) per node.
        const diskIoSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames),
            series: createMultiNodeSeries(n => n.diskReads + n.diskWrites, n => (n.diskReads + n.diskWrites) * 0.3)
        };

        // Aggregate Net Rx+Tx per node
        const netIoSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames),
            series: createMultiNodeSeries(n => n.netRx + n.netTx, n => (n.netRx + n.netTx) * 0.3)
        };

        const tcpConnSeries = {
            ...commonChartOptions,
            legend: createLegendConfig(visibleNodeNames),
            series: createMultiNodeSeries(n => n.tcpEstablished, n => n.tcpEstablished * 0.2)
        };

        const fsUsageData = visibleNodes.map(n => ({ name: n.nodeId, value: n.fsUsedPercent }));

        return { cpuTimeSeries, memTimeSeries, diskIoSeries, netIoSeries, loadTimeSeries, fsUsageData, tcpConnSeries };
    }, [visibleNodes]);

    // Summary Calculations (Based on visible nodes)
    const avgLoad1m = visibleNodes.length > 0
        ? (visibleNodes.reduce((acc, curr) => acc + curr.load1m, 0) / visibleNodes.length).toFixed(2)
        : "0.00";
    const totalTcp = visibleNodes.reduce((acc, curr) => acc + curr.tcpEstablished, 0);
    const avgFsUsage = visibleNodes.length > 0
        ? (visibleNodes.reduce((acc, curr) => acc + curr.fsUsedPercent, 0) / visibleNodes.length).toFixed(0)
        : "0";

    const toggleNodeSelection = (nodeId: string) => {
        setSelectedNodes(prev =>
            prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
        );
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
                            Advanced Node Metrics (Node Exporter)
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            클러스터 리소스를 심층 분석하고 실시간 부하 상태를 모니터링합니다. 우측 노드 리스트를 클릭하여 필터링할 수 있습니다.
                        </p>
                    </div>
                    {/* Clear Filter Button */}
                    {selectedNodes.length > 0 && (
                        <button
                            onClick={() => setSelectedNodes([])}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                            전체 노드 보기 ({baseNodes.length})
                        </button>
                    )}
                </div>

                {/* Summary Grid */}
                <Grid numItemsSm={1} numItemsMd={2} numItemsLg={4} className="gap-4">
                    <Card className="p-4 border-l-4 border-l-amber-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">Avg System Load (1m)</Text>
                            <Activity className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{avgLoad1m}</Metric>
                        <ProgressBar value={Number(avgLoad1m) * 10} color="amber" className="mt-4" />
                    </Card>

                    <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">Avg FS Usage</Text>
                            <HardDrive className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{avgFsUsage}%</Metric>
                        <ProgressBar value={Number(avgFsUsage)} color="emerald" className="mt-4" />
                    </Card>

                    <Card className="p-4 border-l-4 border-l-violet-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">TCP Connections</Text>
                            <Share2 className="w-5 h-5 text-violet-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{totalTcp.toLocaleString()}</Metric>
                        <Text className="mt-4 text-xs font-medium text-muted-foreground">
                            {selectedNodes.length > 0 ? 'Established in selected nodes' : 'Established across all nodes'}
                        </Text>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-blue-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">Viewing Nodes</Text>
                            <Layers className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{visibleNodes.length} / {baseNodes.length}</Metric>
                        <Text className="mt-4 text-xs font-medium text-blue-500">
                            {selectedNodes.length === 0 ? 'All systems showing' : 'Filtered view active'}
                        </Text>
                    </Card>
                </Grid>

                {/* Main Visualization Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: System Performance */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Activity className="w-4 h-4 text-amber-500" /> System Load Average (Relative)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={loadTimeSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Share2 className="w-4 h-4 text-violet-500" /> TCP Established Connections
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={tcpConnSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Cpu className="w-4 h-4 text-blue-500" /> CPU Utilization (%)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={cpuTimeSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Server className="w-4 h-4 text-emerald-500" /> Memory Distribution (GiB)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={memTimeSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>
                        </div>

                        {/* Network & Disk */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Network className="w-4 h-4 text-indigo-500" /> Total Network IO (MB/s)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={netIoSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Database className="w-4 h-4 text-cyan-500" /> Total Disk I/O (MB/s)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={diskIoSeries} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">No nodes selected</div>}
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Right: File System & Node Details */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <Card className="p-0 border-border shadow-sm flex flex-col flex-1 min-h-[400px]">
                            <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                                <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                    <HardDrive className="w-4 h-4 text-emerald-500" /> File System Usage
                                </h3>
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-center gap-6">
                                {visibleNodes.length > 0 ? visibleNodes.map(node => (
                                    <div key={node.nodeId} className="space-y-2 animate-in fade-in zoom-in duration-300">
                                        <Flex>
                                            <Text className="text-xs font-bold text-foreground">{node.nodeId}</Text>
                                            <Text className="text-xs font-mono">{node.fsUsedPercent}%</Text>
                                        </Flex>
                                        <ProgressBar
                                            value={node.fsUsedPercent}
                                            color={node.fsUsedPercent > 80 ? 'red' : (node.fsUsedPercent > 60 ? 'orange' : 'emerald')}
                                            className="h-2"
                                        />
                                    </div>
                                )) : (
                                    <div className="flex-1 flex items-center justify-center text-muted-foreground font-medium text-sm">
                                        No nodes selected to show FS usage
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Interactive Node Status Info */}
                        <Card className="p-0 border-border shadow-sm flex flex-col flex-1 min-h-[400px]">
                            <div className="px-4 py-3 border-b border-border bg-muted/20">
                                <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                    <Activity className="w-4 h-4 text-muted-foreground" />
                                    Node Status Info (Click to Filter)
                                </h3>
                            </div>
                            <div className="flex-1 flex flex-col divide-y divide-border">
                                {baseNodes.map(node => {
                                    const isSelected = selectedNodes.length === 0 || selectedNodes.includes(node.nodeId);

                                    return (
                                        <div
                                            key={node.nodeId}
                                            onClick={() => toggleNodeSelection(node.nodeId)}
                                            className={`
                                                flex-1 p-4 flex items-center cursor-pointer transition-all duration-200
                                                ${isSelected ? 'bg-background hover:bg-muted/30' : 'bg-muted/10 opacity-50 grayscale hover:opacity-80'}
                                            `}
                                        >
                                            <Flex className="w-full" justifyContent="between" alignItems="center">
                                                <div className="space-y-1 flex items-center gap-3">
                                                    {selectedNodes.includes(node.nodeId) ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-4 h-4 border border-muted-foreground/30 rounded-full flex-shrink-0" />
                                                    )}
                                                    <div>
                                                        <Text className={`text-sm font-bold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                            {node.nodeId}
                                                        </Text>
                                                        <Text className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                                            Load: {node.load1m} / {node.load5m} / {node.load15m}
                                                        </Text>
                                                    </div>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full ${node.status === 'Ready' ? 'bg-emerald-500' : 'bg-red-500'} ${isSelected && 'shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                                            </Flex>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
