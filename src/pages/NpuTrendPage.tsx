import React from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Flex, Metric } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { fetchNpuTrends } from '@/api';
import { Calendar, ChevronLeft, ChevronRight, Info, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export interface NpuTrendData {
    deviceId: string;
    label: string;
    uuid: string;
    history: number[];
}

export default function NpuTrendPage() {
    const { data: trends = [], isLoading } = useQuery<NpuTrendData[]>({
        queryKey: ['npuTrends'],
        queryFn: fetchNpuTrends,
    });

    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    const getBgColor = (util: number) => {
        if (util < 50) return 'bg-green-100 hover:bg-green-200';
        if (util < 80) return 'bg-green-400 hover:bg-green-500';
        return 'bg-green-700 hover:bg-green-800';
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Zap className="w-6 h-6 text-green-500 fill-green-500/20" /> Npu Trend
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Rebellion NPU 장비별 사용량을 시계열 히트맵으로 시각화하여 장기적인 워크로드 균형을 분석합니다.
                        </p>
                    </div>
                </div>

                {/* Legend */}
                <Card className="p-4 border border-border/50 shadow-sm">
                    <Flex justifyContent="between" alignItems="center">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-green-500" />
                            <Text className="text-sm font-medium">NPU Utilization Legend</Text>
                        </div>
                        <div className="flex items-center gap-6 text-xs font-semibold uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-100 rounded-sm"></div>
                                <span className="text-muted-foreground">50% 미만</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-400 rounded-sm"></div>
                                <span className="text-muted-foreground">80% 미만</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-700 rounded-sm"></div>
                                <span className="text-muted-foreground">80% 이상</span>
                            </div>
                        </div>
                    </Flex>
                </Card>

                {/* Heatmap Area */}
                <Card className="p-0 overflow-hidden border border-border">
                    <div className="overflow-x-auto min-w-full">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border">
                                    <th className="sticky left-0 bg-muted/30 z-20 p-4 text-left text-xs font-bold text-muted-foreground border-r border-border min-w-[280px]">
                                        Device / NPU Model
                                    </th>
                                    {days.map(day => (
                                        <th key={day} className="p-2 text-center text-[10px] font-bold text-muted-foreground min-w-[32px]">
                                            {day}일
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={32} className="p-20 text-center animate-pulse text-muted-foreground">
                                            Generating NPU usage heatmap...
                                        </td>
                                    </tr>
                                ) : (
                                    trends.map((trend) => (
                                        <tr key={trend.deviceId} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                                            <td className="sticky left-0 bg-background z-10 p-4 text-xs font-mono font-medium border-r border-border truncate max-w-[280px]">
                                                {trend.label}
                                            </td>
                                            {trend.history.map((util, i) => (
                                                <td key={i} className="p-1">
                                                    <TooltipProvider delayDuration={0}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={`w-full aspect-square rounded-[3px] transition-all cursor-crosshair ${getBgColor(util)} shadow-sm`}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="p-3 bg-background/95 backdrop-blur border border-border shadow-xl min-w-[240px]">
                                                                <div className="space-y-1.5 text-xs">
                                                                    <div className="flex justify-between gap-4 py-0.5 border-b border-border/50">
                                                                        <span className="text-muted-foreground font-semibold">Label</span>
                                                                        <span className="font-mono text-right">{trend.label}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-4 py-0.5 border-b border-border/50">
                                                                        <span className="text-muted-foreground font-semibold">UUID</span>
                                                                        <span className="font-mono text-[10px] text-right truncate max-w-[140px]">{trend.uuid}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-4 py-0.5 border-b border-border/50">
                                                                        <span className="text-muted-foreground font-semibold">Time</span>
                                                                        <span className="font-mono text-right">2025/07/{String(i + 1).padStart(2, '0')} 00:00:00</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-4 pt-1 items-center">
                                                                        <span className="text-muted-foreground font-semibold">NPU Utilization</span>
                                                                        <span className="text-lg font-bold text-orange-600">{util.toFixed(2)}%</span>
                                                                    </div>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
}
