import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Badge, Flex } from '@tremor/react';
import ReactECharts from 'echarts-for-react';
import { AlertCircle, CheckCircle2, Clock, Lightbulb, ServerCrash } from 'lucide-react';

export default function AnalysisPage() {
    // Mock Data for Pod Startup Phases
    const startupData = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: { data: ['Scheduling', 'Image Pull', 'Container Create', 'App Ready'] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', name: 'Seconds' },
        yAxis: {
            type: 'category',
            data: ['api-server-8f4', 'worker-job-2b1', 'redis-cache-9x', 'frontend-ui-5c']
        },
        series: [
            { name: 'Scheduling', type: 'bar', stack: 'total', data: [1.2, 0.5, 0.8, 1.0] },
            { name: 'Image Pull', type: 'bar', stack: 'total', data: [15.3, 2.1, 5.5, 12.0] },
            { name: 'Container Create', type: 'bar', stack: 'total', data: [2.1, 1.5, 1.8, 2.2] },
            { name: 'App Ready', type: 'bar', stack: 'total', data: [8.5, 4.0, 2.5, 5.0] }
        ]
    };

    const pendingPods = [
        { name: 'data-processor-xyz', namespace: 'data-team', reason: 'InsufficientCPU', age: '15m' },
        { name: 'ml-inference-v2', namespace: 'ai-ops', reason: 'ImagePullBackOff', age: '2h' },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Pod Analysis (지능형 분석)</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        파드 시작 시퀀스를 분석하여 지연 구간을 파악하고, Pending 상태인 파드의 원인을 자동으로 진단하여 해결책을 제시합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Pod Start Analysis */}
                    <Card className="col-span-1 lg:col-span-2">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            파드 시작 지연 분석 (Pod Startup Phases)
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            최근 배포된 파드들이 Ready 상태가 되기까지 소요된 각 단계별(스케줄링, 이미지 다운로드 등) 시간을 시각화합니다. 특정 단계에서 병목이 발생하는지 확인하세요.
                        </p>
                        <ReactECharts option={startupData} style={{ height: '350px' }} />
                    </Card>

                    {/* 2. Error / Pending Summary */}
                    <div className="space-y-6">
                        <Card decoration="top" decorationColor="red">
                            <Text>총 Pending/Error 파드</Text>
                            <Metric className="text-red-500">2 건</Metric>
                            <Flex className="mt-4">
                                <Text>Insufficient CPU</Text>
                                <Text>1</Text>
                            </Flex>
                            <Flex className="mt-2">
                                <Text>Image Pull Error</Text>
                                <Text>1</Text>
                            </Flex>
                        </Card>

                        <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                            <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-2">
                                <Lightbulb className="w-5 h-5" />
                                AI Insight 진단
                            </h3>
                            <p className="text-sm text-indigo-900/80 leading-relaxed font-medium">
                                현재 <span className="font-bold">data-team</span> 물리 노드의 CPU 할당량이 95%를 초과하여 새 파드 스케줄링이 지연되고 있습니다.
                                <br /><br />
                                <span className="font-bold">추천 조치:</span> HPA 임계값을 조정하거나, 새로운 Node Group을 스케일 아웃(Scale-out) 하세요.
                            </p>
                        </Card>
                    </div>
                </div>

                {/* 3. Pending Pods List & Solutions */}
                <h3 className="text-lg font-semibold mt-8 mb-4">Pending 파드 상세 분석 및 추천 조치</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingPods.map((pod, idx) => (
                        <Card key={idx} className="border-l-4 border-l-amber-500">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-base">{pod.name}</h4>
                                    <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                                        <Badge color="amber" size="sm">{pod.reason}</Badge>
                                        <span>Namespace: {pod.namespace}</span>
                                        <span>Age: {pod.age}</span>
                                    </div>
                                </div>
                                <AlertCircle className="w-6 h-6 text-amber-500" />
                            </div>

                            <div className="bg-muted p-3 rounded-md text-sm text-foreground/80 space-y-2">
                                <div className="flex gap-2 font-medium text-foreground">
                                    <ServerCrash className="w-4 h-4" /> 근본 원인 (Root Cause)
                                </div>
                                <p>
                                    {pod.reason === 'InsufficientCPU'
                                        ? '요청한 파드의 CPU Request(2.0)를 수용할 수 있는 잔여 자원을 가진 노드가 클러스터 내에 없습니다.'
                                        : '이미지 저장소(Registry) 인증 실패 또는 유효하지 않은 이미지 태그(v2-latest)를 참조하고 있습니다.'}
                                </p>
                            </div>

                            <div className="bg-green-500/10 text-green-800 p-3 rounded-md text-sm mt-3 space-y-2">
                                <div className="flex gap-2 font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> 해결 가이드 (Resolution)
                                </div>
                                <p>
                                    {pod.reason === 'InsufficientCPU'
                                        ? 'Node Auto-scaler가 구성되어 있다면 자동으로 노드가 추가될 때까지 대기하세요. 임시 처리를 위해 중요도가 낮은 Job을 강제 종료할 수 있습니다.'
                                        : 'ImagePullSecret이 올바르게 마운트되었는지 확인하고, 이미지 태그가 레지스트리에 존재하는지 검증하세요.'}
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>

            </div>
        </DashboardLayout>
    );
}
