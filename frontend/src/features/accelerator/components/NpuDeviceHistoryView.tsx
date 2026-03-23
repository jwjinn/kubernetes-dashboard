import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Card, Text, Metric } from '@tremor/react';
import { fetchNpuDeviceHistory, type DeviceMetricSeries } from '@/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from '@/components/ui/info-tooltip';

const historyPalette = ['#10b981', '#059669', '#22c55e', '#16a34a', '#0f766e', '#14b8a6', '#84cc16', '#65a30d'];

function buildLineChartOption(
    title: string,
    timeAxis: string[],
    series: DeviceMetricSeries[],
    yAxisName: string,
    maxValue?: number,
) {
    return {
        tooltip: {
            trigger: 'axis' as const,
            formatter: (params: any[]) => {
                if (!params.length) return '';
                const dayLabel = params[0].axisValue;
                const lines = [
                    `<div style="font-weight:700;margin-bottom:6px;">${dayLabel}</div>`,
                ];

                params.forEach((param) => {
                    const avg = Number(param.data?.value ?? 0).toFixed(1);
                    const max = Number(param.data?.max ?? 0).toFixed(1);
                    lines.push(
                        `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                            <span><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${param.color};margin-right:6px;"></span>${param.seriesName}</span>
                            <span>avg ${avg} / max ${max}</span>
                        </div>`
                    );
                });

                return lines.join('');
            },
        },
        legend: {
            type: 'scroll' as const,
            bottom: 0,
            data: series.map((item) => item.deviceId),
            textStyle: { fontSize: 11 },
        },
        grid: { left: '9%', right: '4%', bottom: '18%', top: '12%', containLabel: true },
        xAxis: {
            type: 'category' as const,
            boundaryGap: false,
            data: timeAxis,
            axisLabel: { fontSize: 11 },
        },
        yAxis: {
            type: 'value' as const,
            name: yAxisName,
            max: maxValue,
            axisLabel: { fontSize: 10 },
        },
        series: series.map((item, index) => ({
            name: item.deviceId,
            type: 'line',
            smooth: true,
            showSymbol: true,
            symbolSize: 6,
            data: item.avgValues.map((value, dataIndex) => ({
                value,
                max: item.maxValues[dataIndex] ?? value,
            })),
            lineStyle: { width: 2.5, color: historyPalette[index % historyPalette.length] },
            itemStyle: { color: historyPalette[index % historyPalette.length] },
            emphasis: { focus: 'series' as const },
        })),
        title: {
            text: title,
            left: 'center',
            top: 8,
            textStyle: { fontSize: 12, fontWeight: 700 },
        },
    };
}

export function NpuDeviceHistoryView() {
    const [selectedNode, setSelectedNode] = useState<string>('all');
    const [topN, setTopN] = useState<string>('3');
    const [topNMetric, setTopNMetric] = useState<string>('util');

    const { data, isLoading } = useQuery({
        queryKey: ['npuDeviceHistory'],
        queryFn: fetchNpuDeviceHistory,
        refetchInterval: 60000,
    });

    const nodeOptions = useMemo(() => {
        const nodes = new Set<string>();
        (data?.utilSeries || []).forEach((series) => nodes.add(series.node));
        return ['all', ...Array.from(nodes).sort()];
    }, [data]);

    const filterByNode = (series: DeviceMetricSeries[]) =>
        selectedNode === 'all' ? series : series.filter((item) => item.node === selectedNode);

    const utilSeries = filterByNode(data?.utilSeries || []);
    const memorySeries = filterByNode(data?.memorySeries || []);
    const tempSeries = filterByNode(data?.temperatureSeries || []);
    const powerSeries = filterByNode(data?.powerSeries || []);

    const rankingSource = useMemo(() => {
        switch (topNMetric) {
            case 'memory':
                return memorySeries;
            case 'power':
                return powerSeries;
            default:
                return utilSeries;
        }
    }, [memorySeries, powerSeries, topNMetric, utilSeries]);

    const rankedDeviceIds = useMemo(() => {
        return [...rankingSource]
            .sort((a, b) => {
                const avgA = a.avgValues.reduce((sum, value) => sum + value, 0) / Math.max(a.avgValues.length, 1);
                const avgB = b.avgValues.reduce((sum, value) => sum + value, 0) / Math.max(b.avgValues.length, 1);
                return avgB - avgA;
            })
            .map((item) => item.deviceId);
    }, [rankingSource]);

    const displayedDeviceIds = useMemo(() => {
        if (topN === 'all') return new Set(rankedDeviceIds);
        return new Set(rankedDeviceIds.slice(0, Number(topN)));
    }, [rankedDeviceIds, topN]);

    const applyTopN = (series: DeviceMetricSeries[]) => series.filter((item) => displayedDeviceIds.has(item.deviceId));

    const visibleUtilSeries = applyTopN(utilSeries);
    const visibleMemorySeries = applyTopN(memorySeries);
    const visibleTempSeries = applyTopN(tempSeries);
    const visiblePowerSeries = applyTopN(powerSeries);

    const displayedDeviceCount = visibleUtilSeries.length;
    const timePointCount = data?.timeAxis.length || 0;

    const utilOption = useMemo(
        () => buildLineChartOption('Daily Average Device Utilization', data?.timeAxis || [], visibleUtilSeries, '%', 100),
        [data?.timeAxis, visibleUtilSeries],
    );
    const memoryOption = useMemo(
        () => buildLineChartOption('Daily Average Device Memory Usage', data?.timeAxis || [], visibleMemorySeries, 'GiB'),
        [data?.timeAxis, visibleMemorySeries],
    );
    const tempOption = useMemo(
        () => buildLineChartOption('Daily Average Device Temperature', data?.timeAxis || [], visibleTempSeries, 'C', 100),
        [data?.timeAxis, visibleTempSeries],
    );
    const powerOption = useMemo(
        () => buildLineChartOption('Daily Average Device Power', data?.timeAxis || [], visiblePowerSeries, 'W'),
        [data?.timeAxis, visiblePowerSeries],
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">NPU 디바이스 일자별 평균 추이</h3>
                        <InfoTooltip content="지난 7일 동안 각 디바이스의 일자별 평균값을 선으로 그리고, hover에서는 같은 날짜의 최대값도 함께 보여줍니다. 기본 노출은 사용자가 고른 기준(Util, Memory, Power)에서 상위 디바이스만 표시합니다." />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        시점값이 아니라 하루 평균 기준으로 보도록 바꿨습니다. 라인 겹침은 Top N으로 줄이고, 필요하면 기준과 개수를 바꿔 비교할 수 있습니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">Node Filter</label>
                        <Select value={selectedNode} onValueChange={setSelectedNode}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {nodeOptions.map((node) => (
                                    <SelectItem key={node} value={node}>
                                        {node === 'all' ? 'All Nodes' : node}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">Top N Rank By</label>
                        <Select value={topNMetric} onValueChange={setTopNMetric}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="util">Utilization</SelectItem>
                                <SelectItem value="memory">Memory</SelectItem>
                                <SelectItem value="power">Power</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">Default Visible Lines</label>
                        <Select value={topN} onValueChange={setTopN}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">Top 3</SelectItem>
                                <SelectItem value="5">Top 5</SelectItem>
                                <SelectItem value="8">Top 8</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Displayed Devices</Text>
                    <Metric className="mt-2 text-3xl font-black text-green-600">{displayedDeviceCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">
                        {topNMetric === 'util' ? 'Util' : topNMetric === 'memory' ? 'Memory' : 'Power'} 기준 상위 라인
                    </Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Observation Window</Text>
                    <Metric className="mt-2 text-3xl font-black">7d</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">일자별 평균으로 집계한 최근 7일</Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Data Points</Text>
                    <Metric className="mt-2 text-3xl font-black">{timePointCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">날짜 축 기준 샘플 수</Text>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="p-0 border-border shadow-sm overflow-hidden">
                    <div className="p-2">
                        {isLoading ? (
                            <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">Loading utilization history...</div>
                        ) : (
                            <ReactECharts option={utilOption} style={{ height: '320px' }} notMerge={true} />
                        )}
                    </div>
                </Card>

                <Card className="p-0 border-border shadow-sm overflow-hidden">
                    <div className="p-2">
                        {isLoading ? (
                            <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">Loading memory history...</div>
                        ) : (
                            <ReactECharts option={memoryOption} style={{ height: '320px' }} notMerge={true} />
                        )}
                    </div>
                </Card>

                <Card className="p-0 border-border shadow-sm overflow-hidden">
                    <div className="p-2">
                        {isLoading ? (
                            <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">Loading temperature history...</div>
                        ) : (
                            <ReactECharts option={tempOption} style={{ height: '320px' }} notMerge={true} />
                        )}
                    </div>
                </Card>

                <Card className="p-0 border-border shadow-sm overflow-hidden">
                    <div className="p-2">
                        {isLoading ? (
                            <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">Loading power history...</div>
                        ) : (
                            <ReactECharts option={powerOption} style={{ height: '320px' }} notMerge={true} />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
