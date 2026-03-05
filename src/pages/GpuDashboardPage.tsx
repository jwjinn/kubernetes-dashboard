import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { GpuHexMap } from '@/features/gpu/components/GpuHexMap';
import { GpuDetailsSheet } from '@/features/gpu/components/GpuDetailsSheet';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGpuDevices } from '@/api';
import type { GpuDevice } from '@/features/gpu/components/GpuHexMap';

export default function GpuDashboardPage() {
    const [selectedGpu, setSelectedGpu] = useState<string | null>(null);
    const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);

    // Fetch unified mock data for Map and Table
    const { data: gpuDevices = [], isLoading } = useQuery<GpuDevice[]>({
        queryKey: ['gpuDevices'],
        queryFn: fetchGpuDevices,
        refetchInterval: 5000
    });

    const { utilData, tempData } = useMemo(() => {
        const timeAxis = ['17:00', '17:10', '17:20', '17:30', '17:40', '17:50', '18:00', '18:10', '18:20', '18:30'];

        const genData = (base: number, volatility: number, seed: number) =>
            Array.from({ length: 10 }).map((_, i) => Math.min(100, Math.max(0, base + Math.sin(i * seed) * volatility)));

        let utilSeries = [];
        let tempSeries = [];

        if (selectedMapNode) {
            // "선택된 노드" 상세 보기 모드: 해당 노드 안의 GPU 2개 정도를 샘플로 보여줌
            const seed = selectedMapNode.charCodeAt(selectedMapNode.length - 1);
            utilSeries = [
                { name: 'gpu-0', type: 'line', data: genData(40, 40, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genData(70, 30, seed + 1), smooth: true, showSymbol: false },
            ];
            tempSeries = [
                { name: 'gpu-0', type: 'line', data: genData(50, 10, seed), smooth: true, showSymbol: false },
                { name: 'gpu-1', type: 'line', data: genData(65, 15, seed + 1), smooth: true, showSymbol: false },
            ];
        } else {
            // "전체 보기" (Overview) 모드: 각 노드들의 평균 사용량을 각각 다른 선으로 렌더링
            const nodes = ['node-0', 'node-1', 'node-2', 'node-3'];
            const baseUtils = [30, 80, 50, 20]; // node-0~3 base util
            const baseTemps = [45, 80, 55, 40]; // node-0~3 base temp

            utilSeries = nodes.map((node, idx) => ({
                name: node,
                type: 'line',
                data: genData(baseUtils[idx], 20, idx + 1),
                smooth: true,
                showSymbol: false
            }));

            tempSeries = nodes.map((node, idx) => ({
                name: node,
                type: 'line',
                data: genData(baseTemps[idx], 10, idx + 1),
                smooth: true,
                showSymbol: false
            }));
        }

        return {
            utilData: {
                tooltip: { trigger: 'axis' },
                grid: { left: '5%', right: '5%', bottom: '15%', top: '15%' },
                xAxis: { type: 'category', boundaryGap: false, data: timeAxis },
                yAxis: { type: 'value', max: 100 },
                series: utilSeries
            },
            tempData: {
                tooltip: { trigger: 'axis' },
                grid: { left: '5%', right: '5%', bottom: '15%', top: '15%' },
                xAxis: { type: 'category', boundaryGap: false, data: timeAxis },
                yAxis: { type: 'value', max: 90 },
                series: tempSeries
            }
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
                <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
                    <Card decoration="top" decorationColor="blue">
                        <Text>GPU Node (물리 서버)</Text>
                        <Flex justifyContent="start" alignItems="baseline" className="space-x-2">
                            <Metric>{summaryStats.totalNodes}</Metric>
                            <Text className="ml-4 font-semibold text-blue-500">Ready: {summaryStats.totalNodes}</Text>
                        </Flex>
                        <Text className="text-xs text-muted-foreground mt-2 border-t pt-2">현재 클러스터 내에 인식된 전체 GPU 장착 물리 서버 대수입니다.</Text>
                    </Card>
                    <Card decoration="top" decorationColor="indigo">
                        <Text>GPU Pod (할당 컨테이너)</Text>
                        <Flex justifyContent="start" alignItems="baseline" className="space-x-2">
                            <Metric>{summaryStats.physicalActive + summaryStats.migActive + 6}</Metric>
                            <Text className="ml-4 font-semibold text-blue-500">Running: {summaryStats.physicalActive + summaryStats.migActive}</Text>
                            <Text className="ml-2">Pending: 6</Text>
                        </Flex>
                        <Text className="text-xs text-muted-foreground mt-2 border-t pt-2">GPU 자원을 요청하여 할당받은 파드의 총 개수 및 구동 상태입니다.</Text>
                    </Card>
                    <Card decoration="top" decorationColor="emerald">
                        <Text>P-Device (물리 GPU 칩)</Text>
                        <Flex justifyContent="start" alignItems="baseline" className="space-x-2">
                            <Metric>{summaryStats.physicalTotal}</Metric>
                            <Text className="ml-4 font-semibold text-blue-500">Active: {summaryStats.physicalActive}</Text>
                        </Flex>
                        <Text className="text-xs text-muted-foreground mt-2 border-t pt-2">서버에 꽂혀있는 온전한 물리적 GPU(통짜 할당)의 총 개수입니다.</Text>
                    </Card>
                    <Card decoration="top" decorationColor="amber">
                        <Text>MIG (논리 분할 GPU)</Text>
                        <Flex justifyContent="start" alignItems="baseline" className="space-x-2">
                            <Metric>{summaryStats.migTotal}</Metric>
                            <Text className="ml-4 font-semibold text-blue-500">Active: {summaryStats.migActive}</Text>
                            <Text className="ml-2">Idle: {summaryStats.migIdle}</Text>
                        </Flex>
                        <Text className="text-xs text-muted-foreground mt-2 border-t pt-2">NVIDIA MIG 기술로 잘게 쪼개어진 가상 GPU 파티션의 총 개수입니다.</Text>
                    </Card>
                </Grid>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. GPU Map */}
                    <Card className="col-span-1 border border-border flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold">GPU Map</h3>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground text-right border border-border rounded p-2 bg-muted/20 shadow-sm">
                                <div><span className="font-bold text-foreground">P</span>: 물리 장비 (Physical)</div>
                                <div><span className="font-bold text-foreground">M</span>: 논리 분할 (MIG)</div>
                                <div className="mt-1 flex items-center justify-end gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> 사용 중 (Active)</div>
                                <div className="flex items-center justify-end gap-1.5"><div className="w-3 h-3 bg-gray-300 rounded-sm"></div> 미구동 (Idle)</div>
                                <div className="flex items-center justify-end gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 에러 (Error)</div>
                            </div>
                        </div>
                        <div className="min-h-[350px] w-full flex items-center justify-center bg-muted/10 rounded-md py-4">
                            {isLoading ? (
                                <div className="animate-pulse text-muted-foreground">Loading GPU Map...</div>
                            ) : (
                                <GpuHexMap data={gpuDevices} selectedNode={selectedMapNode} onNodeSelect={setSelectedMapNode} />
                            )}
                        </div>
                    </Card>

                    {/* 3. 사용량 및 Performance Summary */}
                    <div className="col-span-2 space-y-6">
                        <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
                            <Card className={`p-4 flex flex-col justify-center transition-colors ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text>{selectedMapNode ? 'Node Memory' : 'Total VRAM Memory'}</Text>
                                <Metric>{selectedMapNode ? '32.00 GiB' : '293.13 GiB'}</Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-center transition-colors ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text>{selectedMapNode ? 'Node VRAM Usage' : 'Total VRAM Usage'}</Text>
                                <Metric>{selectedMapNode ? '18.4 GiB' : '79.84 GiB'}</Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-center transition-colors ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text>{selectedMapNode ? 'Node GPU Util' : 'Avg GPU Utilization'}</Text>
                                <Metric>{selectedMapNode ? '65.2 %' : '21.43 %'}</Metric>
                            </Card>
                            <Card className={`p-4 flex flex-col justify-center transition-colors ${selectedMapNode ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                <Text>Avg VRAM Usage</Text>
                                <Metric>9.04 GiB</Metric>
                            </Card>
                        </Grid>

                        <Card className={selectedMapNode ? 'border-blue-500/20 shadow-blue-500/10' : ''}>
                            <h3 className="font-semibold text-sm mb-4">
                                {selectedMapNode ? `Performance for Node: ${selectedMapNode}` : 'GPU Performance Summary (Top 5)'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Text className="mb-2">Utilization (%) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={utilData} style={{ height: '150px' }} notMerge={true} />
                                </div>
                                <div>
                                    <Text className="mb-2">Temperature (°C) {selectedMapNode ? '(Node GPUs)' : ''}</Text>
                                    <ReactECharts option={tempData} style={{ height: '150px' }} notMerge={true} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* 4. GPU 목록 Data Table */}
                <Card className="overflow-hidden">
                    <h3 className="text-lg font-semibold mb-4 px-2">GPU Utilization by Node (Top 5)</h3>
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Node</th>
                                    <th className="px-4 py-3 font-medium text-right">Total GPUs</th>
                                    <th className="px-4 py-3 font-medium text-right">Active GPUs</th>
                                    <th className="px-4 py-3 font-medium text-right">Idle GPUs</th>
                                    <th className="px-4 py-3 font-medium text-right">GPU Utilization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground animate-pulse">Loading data...</td></tr>
                                ) : (
                                    Object.entries(
                                        gpuDevices.reduce((acc, device) => {
                                            if (!acc[device.node]) {
                                                acc[device.node] = { total: 0, active: 0, idle: 0, utilSum: 0 };
                                            }
                                            acc[device.node].total += 1;
                                            if (device.status === 'Active') acc[device.node].active += 1;
                                            if (device.status === 'Idle') acc[device.node].idle += 1;
                                            acc[device.node].utilSum += device.utilization;
                                            return acc;
                                        }, {} as Record<string, { total: number, active: number, idle: number, utilSum: number }>)
                                    ).map(([nodeName, stats]) => {
                                        const avgUtil = (stats.utilSum / stats.total).toFixed(2);
                                        return (
                                            <tr key={nodeName} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedGpu(gpuDevices.find(d => d.node === nodeName)?.id || 'nvidia1')}>
                                                <td className="px-4 py-3 font-mono">{nodeName}</td>
                                                <td className="px-4 py-3 text-right">{stats.total}</td>
                                                <td className="px-4 py-3 text-right">{stats.active}</td>
                                                <td className="px-4 py-3 text-right">{stats.idle}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>{avgUtil}%</span>
                                                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${avgUtil}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>

            <GpuDetailsSheet
                isOpen={!!selectedGpu}
                deviceId={selectedGpu}
                onClose={() => setSelectedGpu(null)}
            />
        </DashboardLayout>
    );
}
