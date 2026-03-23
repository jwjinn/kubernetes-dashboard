import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Card, Text, Metric } from '@tremor/react';
import { fetchNpuDeviceHistory, type DeviceMetricSeries } from '@/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from '@/components/ui/info-tooltip';

function buildLineChartOption(
    title: string,
    timeAxis: string[],
    series: DeviceMetricSeries[],
    color: string,
    yAxisName: string,
    maxValue?: number,
) {
    return {
        tooltip: { trigger: 'axis' as const },
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
            axisLabel: {
                fontSize: 10,
                rotate: timeAxis.length > 20 ? 35 : 0,
            },
        },
        yAxis: {
            type: 'value' as const,
            name: yAxisName,
            max: maxValue,
            axisLabel: { fontSize: 10 },
        },
        color: [color],
        series: series.map((item, index) => ({
            name: item.deviceId,
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: item.values,
            lineStyle: { width: 2 },
            itemStyle: { color: historyPalette[index % historyPalette.length] },
            areaStyle: { opacity: 0.05, color: historyPalette[index % historyPalette.length] },
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

const historyPalette = ['#10b981', '#059669', '#22c55e', '#16a34a', '#0f766e', '#14b8a6', '#84cc16', '#65a30d'];

export function NpuDeviceHistoryView() {
    const [selectedNode, setSelectedNode] = useState<string>('all');

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

    const filterSeries = (series: DeviceMetricSeries[]) =>
        selectedNode === 'all' ? series : series.filter((item) => item.node === selectedNode);

    const visibleUtilSeries = filterSeries(data?.utilSeries || []);
    const visibleMemorySeries = filterSeries(data?.memorySeries || []);
    const visibleTempSeries = filterSeries(data?.temperatureSeries || []);
    const visiblePowerSeries = filterSeries(data?.powerSeries || []);

    const visibleDeviceCount = visibleUtilSeries.length;
    const timePointCount = data?.timeAxis.length || 0;

    const utilOption = useMemo(
        () => buildLineChartOption('Device Utilization', data?.timeAxis || [], visibleUtilSeries, '#10b981', '%', 100),
        [data?.timeAxis, visibleUtilSeries],
    );
    const memoryOption = useMemo(
        () => buildLineChartOption('Device Memory Usage', data?.timeAxis || [], visibleMemorySeries, '#059669', 'GiB'),
        [data?.timeAxis, visibleMemorySeries],
    );
    const tempOption = useMemo(
        () => buildLineChartOption('Device Temperature', data?.timeAxis || [], visibleTempSeries, '#16a34a', 'C', 100),
        [data?.timeAxis, visibleTempSeries],
    );
    const powerOption = useMemo(
        () => buildLineChartOption('Device Power', data?.timeAxis || [], visiblePowerSeries, '#0f766e', 'W'),
        [data?.timeAxis, visiblePowerSeries],
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">NPU 디바이스 시계열 추이</h3>
                        <InfoTooltip content="지난 7일 동안 각 NPU 디바이스의 사용률, 메모리 사용량, 온도, 전력 변동을 시계열로 보여줍니다. 순간값보다 패턴과 추세를 보는 데 목적이 있습니다." />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        최근 7일 기준으로 디바이스별 변동을 비교합니다. 노드를 좁혀서 보면 패턴을 더 읽기 쉽습니다.
                    </p>
                </div>

                <div className="w-full lg:w-[220px] space-y-1">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Visible Devices</Text>
                    <Metric className="mt-2 text-3xl font-black text-green-600">{visibleDeviceCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">
                        {selectedNode === 'all' ? '전체 노드 기준' : `${selectedNode} 기준`}
                    </Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Observation Window</Text>
                    <Metric className="mt-2 text-3xl font-black">7d</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">지난 일주일 동안의 장치 변동</Text>
                </Card>
                <Card className="p-4 border-border shadow-sm">
                    <Text className="font-bold text-foreground">Data Points</Text>
                    <Metric className="mt-2 text-3xl font-black">{timePointCount}</Metric>
                    <Text className="mt-2 text-xs text-muted-foreground">각 디바이스별 시계열 샘플 수</Text>
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
