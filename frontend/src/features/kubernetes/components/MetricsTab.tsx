import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchContainerMetrics } from '@/api';
import { Card } from '@/components/ui/card';

interface MetricsTabProps {
    containerId: string;
}

export function MetricsTab({ containerId }: MetricsTabProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['metrics', containerId],
        queryFn: () => fetchContainerMetrics(containerId),
        refetchInterval: 5000
    });

    if (isLoading || !data) {
        return <div className="flex h-64 items-center justify-center rounded-md bg-muted/20 text-sm text-muted-foreground animate-pulse">메트릭을 불러오는 중입니다...</div>;
    }

    const optionCpuMem = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['CPU Usage (%)', 'Memory Usage (%)'], bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: data.times },
        yAxis: { type: 'value', max: 100 },
        color: ['#10b981', '#6366f1'],
        series: [
            {
                name: 'CPU Usage (%)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.cpu
            },
            {
                name: 'Memory Usage (%)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.memory
            }
        ]
    };

    const optionNetwork = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['Receive (MB/s)', 'Transmit (MB/s)'], bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: data.times },
        yAxis: { type: 'value' },
        color: ['#3b82f6', '#f59e0b'],
        series: [
            {
                name: 'Receive (MB/s)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.networkRx
            },
            {
                name: 'Transmit (MB/s)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.networkTx
            }
        ]
    };

    const optionDisk = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['Read (MB/s)', 'Write (MB/s)'], bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: data.times },
        yAxis: { type: 'value' },
        color: ['#ec4899', '#8b5cf6'],
        series: [
            {
                name: 'Read (MB/s)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.diskRead
            },
            {
                name: 'Write (MB/s)',
                type: 'line',
                smooth: true,
                showSymbol: false,
                areaStyle: { opacity: 0.1 },
                data: data.diskWrite
            }
        ]
    };

    return (
        <div className="space-y-4 mt-4 pb-8">
            <Card className="p-4">
                <h3 className="font-semibold mb-2">Resource Usage Trend</h3>
                <ReactECharts option={optionCpuMem} style={{ height: '350px' }} />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                    <h3 className="font-semibold mb-2">Network I/O (MB/s)</h3>
                    <ReactECharts option={optionNetwork} style={{ height: '250px' }} />
                </Card>
                <Card className="p-4">
                    <h3 className="font-semibold mb-2">Disk I/O (MB/s)</h3>
                    <ReactECharts option={optionDisk} style={{ height: '250px' }} />
                </Card>
            </div>
        </div>
    );
}
