import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactECharts from 'echarts-for-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';

interface GpuDetailsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    deviceId: string | null;
}

export function GpuDetailsSheet({ isOpen, onClose, deviceId }: GpuDetailsSheetProps) {
    if (!deviceId) return null;

    // React Flow Mock Nodes (Node -> Device -> MIG -> Pod -> Container)
    const initialNodes: Node[] = [
        // Level 1: Node
        { id: '1', position: { x: 350, y: 50 }, data: { label: 'Node\nip-10-21-130-152.ec2.internal' }, style: { width: 220, padding: 10, background: '#f8fafc', border: '2px solid #94a3b8', borderRadius: '8px', fontWeight: 'bold' } },

        // Level 2: Devices (GPU Chips)
        { id: '2a', position: { x: 150, y: 180 }, data: { label: 'Device\ndev-0' }, style: { width: 180, padding: 10, background: '#fff', border: '1px solid #3b82f6', borderRadius: '8px' } },
        { id: '2b', position: { x: 550, y: 180 }, data: { label: 'Device\ndev-16' }, style: { width: 180, padding: 10, background: '#fff', border: '1px solid #3b82f6', borderRadius: '8px' } },

        // Level 3: MIG Partitions (Only for dev-0 for simplicity)
        { id: '3a', position: { x: 50, y: 310 }, data: { label: 'MIG\nMIG-1g.5gb' }, style: { width: 150, padding: 10, background: '#fff', border: '1px dashed #f59e0b', borderRadius: '8px' } },
        { id: '3b', position: { x: 250, y: 310 }, data: { label: 'MIG\nMIG-2g.10gb' }, style: { width: 150, padding: 10, background: '#fff', border: '1px dashed #f59e0b', borderRadius: '8px' } },
        { id: '3c', position: { x: 550, y: 310 }, data: { label: 'MIG\nMIG-3g.20gb' }, style: { width: 150, padding: 10, background: '#fff', border: '1px dashed #f59e0b', borderRadius: '8px' } },

        // Level 4: Pods
        { id: '4a', position: { x: 50, y: 440 }, data: { label: 'Pod\ninfer-gpt2-001' }, style: { width: 150, padding: 10, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px' } },
        { id: '4b', position: { x: 250, y: 440 }, data: { label: 'Pod\ntrain-job-9a2f' }, style: { width: 150, padding: 10, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px' } },
        { id: '4c', position: { x: 550, y: 440 }, data: { label: 'Pod\nllama3-serve-px' }, style: { width: 150, padding: 10, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px' } },

        // Level 5: Containers
        { id: '5a', position: { x: 50, y: 570 }, data: { label: 'Container\napi-server' }, style: { width: 150, padding: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' } },
        { id: '5b', position: { x: 250, y: 570 }, data: { label: 'Container\nworker' }, style: { width: 150, padding: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' } },
        { id: '5c', position: { x: 550, y: 570 }, data: { label: 'Container\nvllm-engine' }, style: { width: 150, padding: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' } },
    ];

    const initialEdges: Edge[] = [
        // Node -> Devices
        { id: 'e1-2a', source: '1', target: '2a', animated: true, style: { stroke: '#3b82f6' } },
        { id: 'e1-2b', source: '1', target: '2b', animated: true, style: { stroke: '#3b82f6' } },

        // Devices -> MIGs
        { id: 'e2a-3a', source: '2a', target: '3a', type: 'smoothstep' },
        { id: 'e2a-3b', source: '2a', target: '3b', type: 'smoothstep' },
        { id: 'e2b-3c', source: '2b', target: '3c', type: 'smoothstep' },

        // MIGs -> Pods
        { id: 'e3a-4a', source: '3a', target: '4a', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3b-4b', source: '3b', target: '4b', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3c-4c', source: '3c', target: '4c', animated: true, style: { stroke: '#10b981' } },

        // Pods -> Containers
        { id: 'e4a-5a', source: '4a', target: '5a' },
        { id: 'e4b-5b', source: '4b', target: '5b' },
        { id: 'e4c-5c', source: '4c', target: '5c' },
    ];

    // Mock Chart
    const timeAxis = ['17:00', '17:05', '17:10', '17:15', '17:20', '17:25', '17:30'];
    const metricData = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: timeAxis },
        yAxis: { type: 'value', max: 100 },
        series: [
            { name: 'Utilization', type: 'line', data: [80, 85, 90, 95, 100, 95, 90], smooth: true },
            { name: 'VRAM (%)', type: 'line', data: [60, 62, 65, 70, 75, 75, 70], smooth: true }
        ]
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-[600px] sm:max-w-none p-0 flex flex-col">
                <SheetHeader className="p-6 border-b border-border bg-muted/30">
                    <SheetTitle className="flex items-center gap-2">
                        GPU Details: {deviceId}
                    </SheetTitle>
                    <SheetDescription>
                        상세 리소스 할당 관계 다이어그램 및 개별 메트릭스
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="topology" className="flex-1 flex flex-col">
                    <div className="px-6 border-b border-border">
                        <TabsList className="bg-transparent h-12">
                            <TabsTrigger value="topology" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                파드 할당 관계 (Topology)
                            </TabsTrigger>
                            <TabsTrigger value="metrics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                성능 메트릭스 (Metrics)
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1">
                        <TabsContent value="topology" className="m-0">
                            <div className="h-[600px] flex flex-col">
                                <div className="p-4 bg-muted/20 border-b border-border text-sm text-muted-foreground">
                                    💡 <strong>Topology View</strong>: 선택한 GPU({deviceId})가 어떤 물리적 Node에 장착되어 있으며, 내부적으로 어떻게 논리 분할(MIG)되어 최종적으로 어느 Pod(컨테이너)에서 사용 중인지 <strong>End-to-End 연결 상태</strong>를 시각적으로 추적합니다.
                                </div>
                                <div className="flex-1 relative">
                                    <ReactFlow nodes={initialNodes} edges={initialEdges} fitView attributionPosition="bottom-right">
                                        <Background color="#ccc" gap={16} />
                                        <Controls />
                                    </ReactFlow>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="metrics" className="p-0 m-0">
                            <div className="p-4 bg-muted/20 border-b border-border text-sm text-muted-foreground">
                                💡 <strong>Metrics View</strong>: 선택한 개별 GPU 장치({deviceId})의 <strong>실시간 코어 사용률(Utilization) 및 VRAM 점유 시간 추이</strong>를 모니터링하여 리소스 병목이나 과다 점유 여부를 파악합니다.
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-semibold mb-4">Device Metrics Trend</h3>
                                <ReactECharts option={metricData} style={{ height: '400px' }} />
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
