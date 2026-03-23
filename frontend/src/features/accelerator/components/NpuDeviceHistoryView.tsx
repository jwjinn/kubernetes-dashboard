import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Card, Text, Metric } from '@tremor/react';
import { fetchNpuDeviceHistory, type DeviceMetricSeries } from '@/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from '@/components/ui/info-tooltip';

const historyPalette = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC', '#1F77B4', '#D62728', '#9467BD', '#8C564B', '#17BECF', '#BCBD22'];

function getSeriesLabel(item: DeviceMetricSeries) {
    return `${item.node} / ${item.deviceId}`;
}

function withSeriesStyle(series: DeviceMetricSeries[]) {
    return series.map((item, index) => ({
        ...item,
        color: historyPalette[index % historyPalette.length],
        legendLabel: getSeriesLabel(item),
    }));
}

function buildLineChartOption(
    title: string,
    timeAxis: string[],
    series: Array<DeviceMetricSeries & { color: string; legendLabel: string }>,
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
                            <span>평균 ${avg} / 최대 ${max}</span>
                        </div>`
                    );
                });

                return lines.join('');
            },
        },
        legend: {
            type: 'scroll' as const,
            bottom: 0,
            data: series.map((item) => item.legendLabel),
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
        series: series.map((item) => ({
            name: item.legendLabel,
            type: 'line',
            smooth: true,
            showSymbol: true,
            symbolSize: 6,
            data: item.avgValues.map((value, dataIndex) => ({
                value,
                max: item.maxValues[dataIndex] ?? value,
            })),
            lineStyle: { width: 2.5, color: item.color },
            itemStyle: { color: item.color },
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
    const [legendSearch, setLegendSearch] = useState('');

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

    const legendSeries = useMemo(() => withSeriesStyle(visibleUtilSeries), [visibleUtilSeries]);
    const utilChartSeries = legendSeries;
    const memoryChartSeries = useMemo(() => legendSeries.map((legendItem) => {
        const match = visibleMemorySeries.find((item) => item.uuid === legendItem.uuid);
        return match ? { ...match, color: legendItem.color, legendLabel: legendItem.legendLabel } : null;
    }).filter(Boolean) as Array<DeviceMetricSeries & { color: string; legendLabel: string }>, [legendSeries, visibleMemorySeries]);
    const tempChartSeries = useMemo(() => legendSeries.map((legendItem) => {
        const match = visibleTempSeries.find((item) => item.uuid === legendItem.uuid);
        return match ? { ...match, color: legendItem.color, legendLabel: legendItem.legendLabel } : null;
    }).filter(Boolean) as Array<DeviceMetricSeries & { color: string; legendLabel: string }>, [legendSeries, visibleTempSeries]);
    const powerChartSeries = useMemo(() => legendSeries.map((legendItem) => {
        const match = visiblePowerSeries.find((item) => item.uuid === legendItem.uuid);
        return match ? { ...match, color: legendItem.color, legendLabel: legendItem.legendLabel } : null;
    }).filter(Boolean) as Array<DeviceMetricSeries & { color: string; legendLabel: string }>, [legendSeries, visiblePowerSeries]);

    const searchedLegendSeries = useMemo(() => {
        const keyword = legendSearch.trim().toLowerCase();
        if (!keyword) return legendSeries;
        return legendSeries.filter((item) =>
            item.legendLabel.toLowerCase().includes(keyword) ||
            item.node.toLowerCase().includes(keyword) ||
            item.deviceId.toLowerCase().includes(keyword),
        );
    }, [legendSearch, legendSeries]);

    const groupedLegendSeries = useMemo(() => {
        return searchedLegendSeries.reduce((acc, item) => {
            if (!acc[item.node]) acc[item.node] = [];
            acc[item.node].push(item);
            return acc;
        }, {} as Record<string, Array<DeviceMetricSeries & { color: string; legendLabel: string }>>);
    }, [searchedLegendSeries]);

    const displayedDeviceCount = legendSeries.length;
    const timePointCount = data?.timeAxis.length || 0;

    const utilOption = useMemo(
        () => buildLineChartOption('일자별 평균 디바이스 사용률', data?.timeAxis || [], utilChartSeries, '%', 100),
        [data?.timeAxis, utilChartSeries],
    );
    const memoryOption = useMemo(
        () => buildLineChartOption('일자별 평균 디바이스 메모리 사용량', data?.timeAxis || [], memoryChartSeries, 'GiB'),
        [data?.timeAxis, memoryChartSeries],
    );
    const tempOption = useMemo(
        () => buildLineChartOption('일자별 평균 디바이스 온도', data?.timeAxis || [], tempChartSeries, 'C', 100),
        [data?.timeAxis, tempChartSeries],
    );
    const powerOption = useMemo(
        () => buildLineChartOption('일자별 평균 디바이스 전력', data?.timeAxis || [], powerChartSeries, 'W'),
        [data?.timeAxis, powerChartSeries],
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">NPU 디바이스 일자별 평균 추이</h3>
                        <InfoTooltip content="지난 7일 동안 각 디바이스의 일자별 평균값을 선으로 그리고, hover에서는 같은 날짜의 최대값도 함께 보여줍니다. 오른쪽 레전드는 현재 차트에 그려진 디바이스를 노드별로 쉽게 찾기 위한 목록입니다." />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">노드 필터</label>
                        <Select value={selectedNode} onValueChange={setSelectedNode}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {nodeOptions.map((node) => (
                                    <SelectItem key={node} value={node}>
                                        {node === 'all' ? '전체 노드' : node}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">Top N 기준</label>
                        <Select value={topNMetric} onValueChange={setTopNMetric}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="util">사용률</SelectItem>
                                <SelectItem value="memory">메모리</SelectItem>
                                <SelectItem value="power">전력</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full sm:w-[220px] space-y-1">
                        <label className="text-xs text-muted-foreground font-bold">기본 표시 라인 수</label>
                        <Select value={topN} onValueChange={setTopN}>
                            <SelectTrigger className="w-full h-9 text-sm bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">Top 3</SelectItem>
                                <SelectItem value="5">Top 5</SelectItem>
                                <SelectItem value="8">Top 8</SelectItem>
                                <SelectItem value="all">전체</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">표시 중인 디바이스</Text>
                    <Metric className="mt-2 text-3xl font-black text-green-600">{displayedDeviceCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">
                        {`${topNMetric === 'util' ? '사용률' : topNMetric === 'memory' ? '메모리' : '전력'} 기준 상위 라인`}
                    </Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">관측 기간</Text>
                    <Metric className="mt-2 text-3xl font-black">7d</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">일자별 평균으로 집계한 최근 7일</Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">데이터 포인트</Text>
                    <Metric className="mt-2 text-3xl font-black">{timePointCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">날짜 축 기준 샘플 수</Text>
                </Card>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-stretch">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="p-0 border-border shadow-sm overflow-hidden">
                        <div className="p-2">
                            {isLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">사용률 이력을 불러오는 중입니다...</div>
                            ) : (
                                <ReactECharts option={utilOption} style={{ height: '320px' }} notMerge={true} />
                            )}
                        </div>
                    </Card>

                    <Card className="p-0 border-border shadow-sm overflow-hidden">
                        <div className="p-2">
                            {isLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">메모리 이력을 불러오는 중입니다...</div>
                            ) : (
                                <ReactECharts option={memoryOption} style={{ height: '320px' }} notMerge={true} />
                            )}
                        </div>
                    </Card>

                    <Card className="p-0 border-border shadow-sm overflow-hidden">
                        <div className="p-2">
                            {isLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">온도 이력을 불러오는 중입니다...</div>
                            ) : (
                                <ReactECharts option={tempOption} style={{ height: '320px' }} notMerge={true} />
                            )}
                        </div>
                    </Card>

                    <Card className="p-0 border-border shadow-sm overflow-hidden">
                        <div className="p-2">
                            {isLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-muted-foreground animate-pulse">전력 이력을 불러오는 중입니다...</div>
                            ) : (
                                <ReactECharts option={powerOption} style={{ height: '320px' }} notMerge={true} />
                            )}
                        </div>
                    </Card>
                </div>

                <Card className="p-0 border-border shadow-sm overflow-hidden flex flex-col min-h-[420px] 2xl:min-h-[1352px] 2xl:h-full 2xl:sticky 2xl:top-6">
                    <div className="px-4 py-3 border-b border-border bg-muted/20">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm">표시 중인 레전드</h4>
                            <InfoTooltip content="현재 차트에 그려진 디바이스 목록입니다. 노드별로 묶여 있어서 노드 수가 늘어나도 원하는 디바이스를 검색하고 빠르게 찾을 수 있습니다." />
                        </div>
                        <div className="mt-3">
                            <input
                                value={legendSearch}
                                onChange={(event) => setLegendSearch(event.target.value)}
                                placeholder="노드 또는 디바이스 검색"
                                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {Object.entries(groupedLegendSeries).map(([nodeName, items]) => (
                            <div key={nodeName} className="border-b border-border last:border-b-0">
                                <div className="px-4 py-2 text-xs font-bold text-muted-foreground bg-muted/10">
                                    {nodeName} ({items.length})
                                </div>
                                <div className="divide-y divide-border">
                                    {items.map((item) => {
                                        return (
                                            <div
                                                key={item.uuid}
                                                className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-muted/20"
                                            >
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{item.legendLabel}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {item.node}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {!searchedLegendSeries.length && (
                            <div className="px-4 py-8 text-sm text-center text-muted-foreground">
                                검색 조건에 맞는 디바이스가 없습니다.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
