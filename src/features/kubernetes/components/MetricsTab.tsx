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
        return <div className="animate-pulse h-64 bg-muted/20 rounded-md"></div>;
    }

    const option = {
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

    return (
        <Card className="p-4 mt-4">
            <h3 className="font-semibold mb-2">Resource Usage Trend</h3>
            <ReactECharts option={option} style={{ height: '350px' }} />
        </Card>
    );
}
