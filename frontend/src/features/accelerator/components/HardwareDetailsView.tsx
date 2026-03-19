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
    const nodeAllocation = hardwareDetails?.nodeAllocation || [];

    const nodeAllocationMap = useMemo(() => {
        const summary: Record<string, { allocated: number; capacity: number }> = {};
        nodeAllocation.forEach((row: any) => {
            summary[row.node] = { allocated: row.allocated, capacity: row.capacity };
        });
        return summary;
    }, [nodeAllocation]);

    const { utilData, tempData, vramData, powerData } = useMemo(() => {
        const parseGiB = (value: string) => {
            const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ''));
            return Number.isFinite(numeric) ? numeric : 0;
        };

        const isNodeFocused = !!selectedMapNode;
        const labels = isNodeFocused
            ? devices.filter((device) => device.node === selectedMapNode).map((device) => device.id)
            : Object.keys(nodeAllocationMap);

        const metricSource = isNodeFocused
            ? devices.filter((device) => device.node === selectedMapNode)
            : Object.keys(nodeAllocationMap).map((nodeName) => {
                const nodeDevices = devices.filter((device) => device.node === nodeName);
                const average = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

                return {
                    id: nodeName,
                    utilization: average(nodeDevices.map((device) => device.utilization)),
                    temperature: average(nodeDevices.map((device) => device.temperature)),
                    vramUsageValue: average(nodeDevices.map((device) => parseGiB(device.vramUsage))),
                    power: average(nodeDevices.map((device) => device.power ?? 0)),
                };
            });

        const buildBarOption = (seriesName: string, values: number[], max?: number) => ({
            tooltip: { trigger: 'axis' as const },
            grid: { left: '8%', right: '5%', bottom: '20%', top: '12%' },
            xAxis: {
                type: 'category' as const,
                data: labels,
                axisLabel: { rotate: labels.length > 8 ? 35 : 0 },
            },
            yAxis: {
                type: 'value' as const,
                max,
            },
            color: ['#10b981'],
            series: [
                {
                    name: seriesName,
                    type: 'bar' as const,
                    data: values,
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: '#10b981',
                    },
                },
            ],
        });

        return {
            utilData: buildBarOption('Utilization (%)', metricSource.map((item: any) => item.utilization), 100),
            tempData: buildBarOption('Temperature (°C)', metricSource.map((item: any) => item.temperature), 100),
            vramData: buildBarOption('Memory Usage (GiB)', metricSource.map((item: any) => item.vramUsageValue ?? parseGiB(item.vramUsage))),
            powerData: buildBarOption('Power (W)', metricSource.map((item: any) => item.power ?? 0), 150),
        };
    }, [devices, selectedMapNode, nodeAllocationMap]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(nodeAllocationMap).map(([nodeName, allocation]) => {
                    const requestRatio = allocation.capacity > 0 ? Math.round((allocation.allocated / allocation.capacity) * 100) : 0;

                    return (
                        <Card key={nodeName} className="p-4 border-border shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center">
                                        <h3 className="font-bold text-base">{nodeName}</h3>
                                        <InfoTooltip content={
                                            <div className="space-y-2">
                                                <p><strong>요청 할당</strong>: Kubernetes API 기준입니다. 이 노드에 스케줄된 Pod들의 `resources.requests` 합계를 사용합니다.</p>
                                                <p><strong>성능 지표</strong>: 아래 차트와 상태 맵은 Prometheus / VictoriaMetrics에서 수집한 장치 telemetry 기준입니다.</p>
                                                <p><strong>왜 다를 수 있나</strong>: 요청은 Kubernetes 스케줄링 기준이고, 차트와 타일 색은 실제 장치 관측값 기준이라 순간적으로 다르게 보일 수 있습니다.</p>
                                            </div>
                                        } />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        이 노드의 공식 요청량과 실제 장치 관측 상태를 함께 보여줍니다.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] uppercase text-muted-foreground">Capacity</p>
                                    <p className="text-lg font-black">{allocation.capacity}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 col-span-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-green-800">요청 할당량</span>
                                        <span className="text-xs text-green-700">{requestRatio}%</span>
                                    </div>
                                    <div className="mt-2 text-2xl font-black text-green-700">
                                        {allocation.allocated} / {allocation.capacity}
                                    </div>
                                    <p className="mt-1 text-xs text-green-700">
                                        출처: Kubernetes Pod requests
                                    </p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

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
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Telemetry Active</div>
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
                                nodeAllocation={nodeAllocationMap}
                            />
                        )}
                    </div>
                </Card>

                {/* Metrics Charts */}
                <div className="col-span-2 flex flex-col space-y-6">
                    <Card className="p-0 flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center">
                            <h3 className="font-bold text-sm">
                                {selectedMapNode ? `${selectedMapNode} 디바이스별 실시간 NPU 성능 지표` : `노드별 평균 실시간 NPU 성능 지표`}
                            </h3>
                            <InfoTooltip content={selectedMapNode
                                ? "선택한 노드의 die별 사용률, 메모리 사용량, 온도, 전력 값을 보여줍니다."
                                : "노드를 선택하지 않으면 노드별 평균 사용률, 평균 메모리 사용량, 평균 온도, 평균 전력 값을 보여줍니다."} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 flex-1">
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">{selectedMapNode ? '장치별 사용률 (%)' : '노드별 평균 사용률 (%)'}</Text>
                                <ReactECharts option={utilData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">{selectedMapNode ? '장치별 메모리 사용량 (GiB)' : '노드별 평균 메모리 사용량 (GiB)'}</Text>
                                <ReactECharts option={vramData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">{selectedMapNode ? '장치별 온도 (°C)' : '노드별 평균 온도 (°C)'}</Text>
                                <ReactECharts option={tempData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                            <div className="h-full">
                                <Text className="font-bold text-xs mb-2 text-foreground">{selectedMapNode ? '장치별 전력 (W)' : '노드별 평균 전력 (W)'}</Text>
                                <ReactECharts option={powerData} style={{ height: '240px' }} notMerge={true} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <AcceleratorDetailsSheet
                isOpen={!!selectedDevice}
                deviceId={selectedDevice}
                acceleratorType="NPU"
                onClose={() => setSelectedDevice(null)}
            />
        </div>
    );
}
