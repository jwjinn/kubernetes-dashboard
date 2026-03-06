import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { fetchNpuDevices } from '@/api';
import type { NpuDevice } from './NpuHexMap';
import { Card, Text, Metric, Grid, AreaChart } from '@tremor/react';
import { Activity, Thermometer, Zap, Box, Tag, Server } from 'lucide-react';

interface NpuDetailsSheetProps {
    isOpen: boolean;
    deviceId: string | null;
    onClose: () => void;
}

export function NpuDetailsSheet({ isOpen, deviceId, onClose }: NpuDetailsSheetProps) {
    const { data: devices = [] } = useQuery<NpuDevice[]>({
        queryKey: ['npuDevices'],
        queryFn: fetchNpuDevices,
        enabled: isOpen
    });

    const device = devices.find(d => d.id === deviceId);

    // Mock chart data for Rebellion ATOM NPU
    const chartData = [
        { time: '10:00', utilization: 45, power: 120, temp: 42 },
        { time: '10:05', utilization: 52, power: 135, temp: 44 },
        { time: '10:10', utilization: 48, power: 128, temp: 43 },
        { time: '10:15', utilization: 70, power: 180, temp: 48 },
        { time: '10:20', utilization: 85, power: 220, temp: 52 },
        { time: '10:25', utilization: 65, power: 160, temp: 49 },
        { time: '10:30', utilization: 58, power: 145, temp: 46 },
    ];

    if (!device) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant={device.status === 'Active' ? 'default' : 'secondary'}
                            className={device.status === 'Active' ? 'bg-green-500 hover:bg-green-600 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : ''}>
                            {device.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{device.uuid}</span>
                    </div>
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="w-6 h-6 text-green-500 fill-green-500/10" />
                        {device.model} ({device.id})
                    </SheetTitle>
                    <SheetDescription>
                        Rebellion ATOM NPU 가속기 상세 정보 및 실시간 상태 분석
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6">
                    {/* Key Metrics Grid */}
                    <Grid numItems={2} className="gap-4">
                        <Card className="p-4 border-l-4 border-green-500">
                            <Text className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <Activity className="w-3 h-3" /> UTILIZATION
                            </Text>
                            <Metric className="text-2xl font-black">{device.utilization}%</Metric>
                        </Card>
                        <Card className="p-4 border-l-4 border-emerald-500">
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
                                    <Tag className="w-3 h-3" /> Running Pod
                                </Text>
                                <Text className="text-sm font-medium text-green-600">{device.pod || 'N/A'}</Text>
                            </div>
                        </div>
                    </Card>

                    {/* Performance Charts */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-500" /> Utilization Trend (%)
                        </h4>
                        <AreaChart
                            className="h-48"
                            data={chartData}
                            index="time"
                            categories={["utilization"]}
                            colors={["green"]}
                            showLegend={false}
                            yAxisWidth={30}
                        />

                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Thermometer className="w-4 h-4 text-emerald-500" /> Temperature (°C)
                        </h4>
                        <AreaChart
                            className="h-48"
                            data={chartData}
                            index="time"
                            categories={["temp"]}
                            colors={["emerald"]}
                            showLegend={false}
                            yAxisWidth={30}
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
