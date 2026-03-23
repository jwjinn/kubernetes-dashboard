import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Text, Metric, Grid, Flex, ProgressBar } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { Server, Activity, Database, Network, Cpu, HardDrive, Share2, Layers, CheckCircle2 } from 'lucide-react';

import { fetchNodeDashboardMetrics, type NodeDashboardNode, type NodeDashboardSeries } from '@/api';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useFilterStore } from '@/store/filterStore';

function buildLineChartOption(
    titleNames: string[],
    timeAxis: string[],
    series: NodeDashboardSeries[],
    selectedNodes: string[],
    yMax?: number,
) {
    const visibleSeries = series.filter((item) => selectedNodes.length === 0 || selectedNodes.includes(item.nodeId));
    const palette = ['#3b82f6', '#2563eb', '#10b981', '#94a3b8', '#f59e0b', '#8b5cf6'];

    return {
        tooltip: { trigger: 'axis' },
        legend: {
            type: 'scroll',
            bottom: 0,
            data: titleNames,
            textStyle: { fontSize: 11 },
        },
        grid: { left: '10%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: timeAxis },
        yAxis: { type: 'value', max: yMax },
        series: visibleSeries.map((item, index) => ({
            name: item.nodeId,
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: item.values,
            itemStyle: { color: palette[index % palette.length] },
            areaStyle: { opacity: 0.06, color: palette[index % palette.length] },
        })),
    };
}

export default function ClusterDashboardPage() {
    const { selectedCluster } = useFilterStore();
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['nodeDashboardMetrics', selectedCluster],
        queryFn: () => fetchNodeDashboardMetrics(selectedCluster),
        refetchInterval: 15000,
    });

    const baseNodes: NodeDashboardNode[] = data?.nodes || [];
    const visibleNodes = useMemo(
        () => (selectedNodes.length === 0 ? baseNodes : baseNodes.filter((node) => selectedNodes.includes(node.nodeId))),
        [baseNodes, selectedNodes],
    );

    const avgLoad1m = visibleNodes.length > 0
        ? (visibleNodes.reduce((sum, node) => sum + node.load1m, 0) / visibleNodes.length).toFixed(2)
        : '0.00';
    const totalTcp = visibleNodes.reduce((sum, node) => sum + node.tcpEstablished, 0);
    const avgFsUsage = visibleNodes.length > 0
        ? (visibleNodes.reduce((sum, node) => sum + node.fsUsedPercent, 0) / visibleNodes.length).toFixed(0)
        : '0';

    const chartOptions = useMemo(() => {
        const timeAxis = data?.timeAxis || [];
        return {
            load: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.loadSeries || [], selectedNodes),
            tcp: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.tcpSeries || [], selectedNodes),
            cpu: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.cpuSeries || [], selectedNodes, 100),
            memory: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.memorySeries || [], selectedNodes),
            network: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.networkIoSeries || [], selectedNodes),
            disk: buildLineChartOption(visibleNodes.map((node) => node.nodeId), timeAxis, data?.diskIoSeries || [], selectedNodes),
        };
    }, [data, selectedNodes, visibleNodes]);

    const toggleNodeSelection = (nodeId: string) => {
        setSelectedNodes((previous) =>
            previous.includes(nodeId) ? previous.filter((id) => id !== nodeId) : [...previous, nodeId],
        );
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center text-muted-foreground animate-pulse">노드 메트릭을 불러오는 중입니다...</div>
            </DashboardLayout>
        );
    }

    if (error || !data) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center text-destructive">노드 메트릭을 불러오지 못했습니다.</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
                            노드 상태 대시보드
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            실제 백엔드 메트릭을 기준으로 노드 부하와 자원 상태를 보여줍니다. 오른쪽 노드 목록을 눌러 원하는 노드만 볼 수 있습니다.
                        </p>
                    </div>
                    {selectedNodes.length > 0 && (
                        <button
                            onClick={() => setSelectedNodes([])}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                            전체 노드 보기 ({baseNodes.length})
                        </button>
                    )}
                </div>

                <Grid numItemsSm={1} numItemsMd={2} numItemsLg={4} className="gap-4">
                    <Card className="p-4 border-l-4 border-l-amber-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
                                평균 시스템 로드 (1분)
                                <InfoTooltip content={
                                    <div className="space-y-2">
                                        <p>최근 1분 동안 이 노드에서 CPU를 쓰려고 하거나 실행 대기 중인 작업이 얼마나 몰렸는지 보여주는 값입니다.</p>
                                        <p>CPU 사용률과 완전히 같지는 않지만, 일이 밀리고 있는지 빠르게 파악하는 데 유용합니다.</p>
                                        <p>보통 값이 노드의 CPU 코어 수와 비슷하거나 더 높게 오래 유지되면, 해당 노드가 바쁘거나 병목이 생겼다고 해석하면 됩니다.</p>
                                    </div>
                                } />
                            </Text>
                            <Activity className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{avgLoad1m}</Metric>
                        <ProgressBar value={Math.min(Number(avgLoad1m) * 10, 100)} color="amber" className="mt-4" />
                    </Card>

                    <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
                                평균 파일시스템 사용률
                                <InfoTooltip content="현재 보이는 노드들의 루트 파일시스템 사용률 평균입니다. 디스크 용량 부족 징후를 빠르게 보는 데 도움이 됩니다." />
                            </Text>
                            <HardDrive className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{avgFsUsage}%</Metric>
                        <ProgressBar value={Number(avgFsUsage)} color="emerald" className="mt-4" />
                    </Card>

                    <Card className="p-4 border-l-4 border-l-violet-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
                                TCP 연결 수
                                <InfoTooltip content="현재 열려 있는 TCP 연결 수의 합입니다. 갑자기 급증하면 네트워크 트래픽이나 연결 누수 여부를 같이 점검하는 것이 좋습니다." />
                            </Text>
                            <Share2 className="w-5 h-5 text-violet-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{Math.round(totalTcp).toLocaleString()}</Metric>
                        <Text className="mt-4 text-xs font-medium text-muted-foreground">
                            {selectedNodes.length > 0 ? '선택한 노드 기준 연결 수' : '현재 표시 중인 전체 노드 기준 연결 수'}
                        </Text>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-blue-500 shadow-sm transition-all">
                        <Flex alignItems="center" justifyContent="between">
                            <Text className="font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
                                보고 있는 노드
                                <InfoTooltip content="전체 노드 중 현재 화면에 반영된 노드 수입니다. 오른쪽 목록에서 눌러 원하는 노드만 좁혀서 볼 수 있습니다." />
                            </Text>
                            <Layers className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        </Flex>
                        <Metric className="mt-2 text-3xl font-black">{visibleNodes.length} / {baseNodes.length}</Metric>
                        <Text className="mt-4 text-xs font-medium text-blue-500">
                            {selectedNodes.length === 0 ? '전체 노드를 표시 중입니다' : '선택한 노드만 표시 중입니다'}
                        </Text>
                    </Card>
                </Grid>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Activity className="w-4 h-4 text-amber-500" /> 시스템 로드 추이
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.load} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Share2 className="w-4 h-4 text-violet-500" /> TCP 연결 추이
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.tcp} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Cpu className="w-4 h-4 text-blue-500" /> CPU 사용률 (%)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.cpu} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Server className="w-4 h-4 text-emerald-500" /> 메모리 사용량 (GiB)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.memory} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Network className="w-4 h-4 text-indigo-500" /> 총 네트워크 입출력 (MB/s)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.network} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>

                            <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-border bg-muted/20">
                                    <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                        <Database className="w-4 h-4 text-cyan-500" /> 총 디스크 입출력 (MB/s)
                                    </h3>
                                </div>
                                <div className="p-2">
                                    {visibleNodes.length > 0 ? <ReactECharts option={chartOptions.disk} style={{ height: '260px' }} notMerge={true} /> : <div className="h-[260px] flex items-center justify-center text-muted-foreground font-medium">선택된 노드가 없습니다</div>}
                                </div>
                            </Card>
                        </div>
                    </div>

                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <Card className="p-0 border-border shadow-sm flex flex-col flex-1 min-h-[400px]">
                            <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                                <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                    <HardDrive className="w-4 h-4 text-emerald-500" /> 파일시스템 사용률
                                </h3>
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-center gap-6">
                                {visibleNodes.length > 0 ? visibleNodes.map((node) => (
                                    <div key={node.nodeId} className="space-y-2 animate-in fade-in zoom-in duration-300">
                                        <Flex>
                                            <Text className="text-xs font-bold text-foreground">{node.nodeId}</Text>
                                            <Text className="text-xs font-mono">{Math.round(node.fsUsedPercent)}%</Text>
                                        </Flex>
                                        <ProgressBar
                                            value={node.fsUsedPercent}
                                            color={node.fsUsedPercent > 80 ? 'red' : (node.fsUsedPercent > 60 ? 'amber' : 'emerald')}
                                            className="h-2"
                                        />
                                    </div>
                                )) : (
                                    <div className="flex-1 flex items-center justify-center text-muted-foreground font-medium text-sm">
                                        선택된 노드가 없습니다
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className="p-0 border-border shadow-sm flex flex-col flex-1 min-h-[400px]">
                            <div className="px-4 py-3 border-b border-border bg-muted/20">
                                <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                                    <Activity className="w-4 h-4 text-muted-foreground" />
                                    노드 상태 목록 (눌러서 필터)
                                </h3>
                            </div>
                            <div className="flex-1 flex flex-col divide-y divide-border">
                                {baseNodes.map((node) => {
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
                                                            Load: {node.load1m.toFixed(2)} / {node.load5m.toFixed(2)} / {node.load15m.toFixed(2)}
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
