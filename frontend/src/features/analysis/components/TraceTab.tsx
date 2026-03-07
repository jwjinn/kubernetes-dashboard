import React from 'react';
import { Card, Text, Flex, Badge, Metric } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { Activity, Zap, Clock } from 'lucide-react';

export function TraceTab() {
    // Mock data for APM Hitmap
    const hitmapData = {
        tooltip: { position: 'top' },
        grid: { height: '80%', top: '10%' },
        xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            splitArea: { show: true }
        },
        yAxis: {
            type: 'category',
            data: ['0-1s', '1-3s', '3-5s', '5s+'],
            splitArea: { show: true }
        },
        visualMap: {
            min: 0,
            max: 100,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            inRange: { color: ['#e0f2f1', '#4db6ac', '#00796b'] }
        },
        series: [{
            name: 'Transactions',
            type: 'heatmap',
            data: Array.from({ length: 24 * 4 }, (_, i) => [i % 24, Math.floor(i / 24), Math.floor(Math.random() * 100)]),
            label: { show: false }
        }]
    };

    const transactions = [
        { id: 'tx-001', service: 'auth-service', path: '/api/v1/login', duration: '450ms', status: 'success', time: '17:34:01' },
        { id: 'tx-002', service: 'order-service', path: '/api/order/create', duration: '1.2s', status: 'slow', time: '17:34:22' },
        { id: 'tx-003', service: 'payment-gateway', path: '/v2/process', duration: '3.5s', status: 'critical', time: '17:35:10' },
        { id: 'tx-004', service: 'auth-service', path: '/api/v1/validate', duration: '120ms', status: 'success', time: '17:35:45' },
    ];

    return (
        <div className="space-y-6 flex flex-col h-full overflow-y-auto pr-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="col-span-1 lg:col-span-2 p-4">
                    <Flex className="mb-4">
                        <Text className="font-semibold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" /> APM 트랜잭션 히트맵
                        </Text>
                        <Badge color="emerald">LIVE</Badge>
                    </Flex>
                    <ReactECharts option={hitmapData} style={{ height: '300px' }} />
                </Card>

                <Card className="p-4 flex flex-col justify-center items-center">
                    <Text className="font-semibold mb-4">액티브 트랜잭션</Text>
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <div className="absolute inset-0 border-[12px] border-emerald-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-[12px] border-emerald-500 rounded-full" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%)' }}></div>
                        <Metric className="text-3xl font-bold">450</Metric>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4 text-center w-full">
                        <div><Text className="text-emerald-600 font-bold italic">Normal</Text><Text className="text-xs">334</Text></div>
                        <div><Text className="text-amber-600 font-bold italic">Slow</Text><Text className="text-xs">132</Text></div>
                        <div><Text className="text-red-600 font-bold italic">V.Slow</Text><Text className="text-xs">65</Text></div>
                    </div>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                    <Text className="font-semibold flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" /> 최근 트랜잭션 목록
                    </Text>
                    <button className="text-xs text-primary hover:underline font-medium">전체 보기</button>
                </div>
                <div className="divide-y divide-border">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`w-2 h-10 rounded-full ${tx.status === 'success' ? 'bg-emerald-500' : tx.status === 'slow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Text className="font-bold text-foreground">{tx.service}</Text>
                                        <Badge size="xs" color={tx.status === 'success' ? 'emerald' : tx.status === 'slow' ? 'amber' : 'red'}>
                                            {tx.status}
                                        </Badge>
                                    </div>
                                    <Text className="text-xs text-muted-foreground font-mono mt-1">{tx.path}</Text>
                                </div>
                            </div>
                            <div className="text-right">
                                <Text className="font-semibold text-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {tx.duration}
                                </Text>
                                <Text className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">{tx.time}</Text>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
