import React, { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { fetchAcceleratorDevices } from '@/api';
import type { AcceleratorDevice } from './AcceleratorHexMap';
import ReactECharts from 'echarts-for-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, Text, Metric, Grid } from '@tremor/react';
import { Activity, Thermometer, Zap, Box, Tag, Server, Cpu } from 'lucide-react';

interface AcceleratorDetailsSheetProps {
    isOpen: boolean;
    deviceId: string | null;
    acceleratorType: 'GPU' | 'NPU';
    onClose: () => void;
}

export function AcceleratorDetailsSheet({ isOpen, deviceId, acceleratorType, onClose }: AcceleratorDetailsSheetProps) {
    const isNpu = acceleratorType === 'NPU';

    const { data: devices = [] } = useQuery<AcceleratorDevice[]>({
        queryKey: ['acceleratorDevices', acceleratorType],
        queryFn: () => fetchAcceleratorDevices(acceleratorType),
        enabled: isOpen && !!deviceId
    });

    const device = devices.find(d => d.id === deviceId);

    // Mock Topology Nodes (GPU specific MIGs, but adaptable)
    const initialNodes: Node[] = useMemo(() => [
        { id: '1', position: { x: 350, y: 50 }, data: { label: `Node\n${device?.node || 'Unknown'}` }, style: { width: 220, padding: 10, background: '#f8fafc', border: '2px solid #94a3b8', borderRadius: '8px', fontWeight: 'bold' } },
        { id: '2a', position: { x: 350, y: 180 }, data: { label: `Device\n${deviceId}` }, style: { width: 180, padding: 10, background: '#fff', border: `1px solid ${isNpu ? '#22c55e' : '#3b82f6'}`, borderRadius: '8px' } },
        ...(isNpu ? [] : [
            { id: '3a', position: { x: 150, y: 310 }, data: { label: 'MIG\nMIG-1g.5gb' }, style: { width: 150, padding: 10, background: '#fff', border: '1px dashed #f59e0b', borderRadius: '8px' } },
            { id: '3b', position: { x: 550, y: 310 }, data: { label: 'MIG\nMIG-3g.20gb' }, style: { width: 150, padding: 10, background: '#fff', border: '1px dashed #f59e0b', borderRadius: '8px' } },
        ]),
        { id: '4a', position: { x: 350, y: 440 }, data: { label: `Pod\n${device?.pod || 'None'}` }, style: { width: 150, padding: 10, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px' } },
    ], [device, deviceId, isNpu]);

    const initialEdges: Edge[] = useMemo(() => [
        { id: 'e1-2a', source: '1', target: '2a', animated: true, style: { stroke: isNpu ? '#22c55e' : '#3b82f6' } },
        ...(isNpu ? [
            { id: 'e2a-4a', source: '2a', target: '4a', animated: true, style: { stroke: '#10b981' } }
        ] : [
            { id: 'e2a-3a', source: '2a', target: '3a', type: 'smoothstep' },
            { id: 'e2a-3b', source: '2a', target: '3b', type: 'smoothstep' },
            { id: 'e3a-4a', source: '3a', target: '4a', animated: true, style: { stroke: '#10b981' } }
        ])
    ], [isNpu]);

    // Mock Chart
    const timeAxis = ['17:00', '17:05', '17:10', '17:15', '17:20', '17:25', '17:30'];
    const metricData = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: timeAxis },
        yAxis: { type: 'value', max: 100 },
        series: [
            {
                name: 'Utilization (%)', type: 'line',
                data: [45, 52, 48, 70, 85, 65, 58],
                smooth: true,
                itemStyle: { color: isNpu ? '#22c55e' : '#3b82f6' },
                lineStyle: { width: 3 }
            },
            {
                name: 'Temperature (°C)', type: 'line',
                data: [42, 44, 43, 48, 52, 49, 46],
                smooth: true,
                itemStyle: { color: isNpu ? '#10b981' : '#f59e0b' }
            }
        ]
    };

    if (!deviceId || !device) return null;

    const themeColor = isNpu ? 'green' : 'blue';
    const activeColorClass = isNpu ? 'bg-green-500 hover:bg-green-600 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-blue-500 hover:bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
    const iconColorClass = isNpu ? 'text-green-500 fill-green-500/10' : 'text-blue-500 fill-blue-500/10';
    const borderClass = isNpu ? 'border-green-500' : 'border-blue-500';

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[600px] sm:max-w-none p-0 flex flex-col overflow-hidden">
                <SheetHeader className="p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant={device.status === 'Active' ? 'default' : 'secondary'}
                            className={device.status === 'Active' ? activeColorClass : ''}>
                            {device.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{device.uuid}</span>
                    </div>
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        {isNpu ? <Zap className={`w-6 h-6 ${iconColorClass}`} /> : <Cpu className={`w-6 h-6 ${iconColorClass}`} />}
                        {device.model} ({device.id})
                    </SheetTitle>
                    <SheetDescription>
                        {isNpu ? 'NPU' : 'GPU'} 가속기 상세 정보 및 실시간 상태 분석
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="metrics" className="flex-1 flex flex-col">
                    <div className="px-6 border-b border-border">
                        <TabsList className="bg-transparent h-12">
                            <TabsTrigger value="metrics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                메트릭스 (Metrics)
                            </TabsTrigger>
                            <TabsTrigger value="topology" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                토폴로지 (Topology)
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1">
                        <TabsContent value="metrics" className="p-6 m-0 space-y-6">
                            {/* Key Metrics Grid */}
                            <Grid numItems={2} className="gap-4">
                                <Card className={`p-4 border-l-4 ${borderClass}`}>
                                    <Text className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                        <Activity className="w-3 h-3" /> UTILIZATION
                                    </Text>
                                    <Metric className="text-2xl font-black">{device.utilization}%</Metric>
                                </Card>
                                <Card className={`p-4 border-l-4 ${isNpu ? 'border-emerald-500' : 'border-indigo-500'}`}>
                                    <Text className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> MEMORY
                                    </Text>
                                    <Metric className="text-2xl font-black">{device.vramUsage}</Metric>
                                    <Text className="text-[10px] text-muted-foreground mt-1">Total {device.vramTotal}</Text>
                                </Card>
                            </Grid>

                            {/* Metadata Section */}
                            <Card className="p-4 bg-muted/30 border-none">
                                <div className="grid grid-cols-2 gap-y-4">
                                    <div className="space-y-1">
                                        <Text className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Server className="w-3 h-3" /> Node
                                        </Text>
                                        <Text className="font-mono text-sm">{device.node}</Text>
                                    </div>
                                    <div className="space-y-1">
                                        <Text className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Box className="w-3 h-3" /> Namespace
                                        </Text>
                                        <Text className="text-sm">{device.namespace}</Text>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <Text className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Tag className="w-3 h-3" /> Observed Pod Label
                                        </Text>
                                        <Text className={`text-sm font-medium ${isNpu ? 'text-green-600' : 'text-blue-600'}`}>
                                            {device.pod || 'N/A'}
                                        </Text>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-4 mt-6">
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    <Activity className={`w-4 h-4 ${isNpu ? 'text-green-500' : 'text-blue-500'}`} /> Performance Trends
                                </h4>
                                <ReactECharts option={metricData} style={{ height: '300px' }} />
                            </div>
                        </TabsContent>
                        <TabsContent value="topology" className="m-0 flex flex-col h-[600px]">
                            <div className="p-4 bg-muted/20 border-b border-border text-sm text-muted-foreground">
                                💡 <strong>Topology View</strong>: 선택한 {isNpu ? 'NPU' : 'GPU'} 장치({deviceId})의 <strong>물리적 소속 및 컨테이너 매핑 상태</strong>를 시각화합니다.
                            </div>
                            <div className="flex-1 relative">
                                <ReactFlow nodes={initialNodes} edges={initialEdges} fitView attributionPosition="bottom-right">
                                    <Background color="#ccc" gap={16} />
                                    <Controls />
                                </ReactFlow>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
