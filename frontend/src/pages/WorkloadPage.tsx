import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchK8sEvents, fetchStartupAnalysis, type K8sEvent } from '@/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { StartupTimeline } from '@/features/diagnosis/components/StartupTimeline';
import { EventTable } from '@/features/diagnosis/components/EventTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ShieldAlert, Sparkles, Terminal, AlertCircle } from 'lucide-react';

export default function WorkloadPage() {
    const { data: events = [], isLoading: eventsLoading } = useQuery<K8sEvent[]>({
        queryKey: ['k8sEvents'],
        queryFn: () => fetchK8sEvents(),
    });
    const { data: analysis, isLoading: analysisLoading } = useQuery({ queryKey: ['startupAnalysis'], queryFn: fetchStartupAnalysis });

    const warningCount = events.filter((e: any) => e.type === 'Warning').length;

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-700">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            <h2 className="text-2xl font-bold tracking-tight">장애 진단 & 클러스터 이벤트</h2>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            최근 발생한 클러스터 이상 징후를 감지하고, AI 기반의 원인 분석 및 해결 방안을 제안합니다.
                        </p>
                    </div>
                    <Badge variant="outline" className="px-3 py-1 border-muted-foreground/20">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Real-time Monitoring Active
                    </Badge>
                </div>

                {/* Status Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-red-50/50 border-red-100">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-medium text-red-700 uppercase">Critical Warnings</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent className="py-0 px-4 pb-3">
                            <div className="text-2xl font-bold text-red-900">{warningCount}</div>
                            <p className="text-[10px] text-red-600 mt-1">최근 1시간 내 발생 수치</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50/50 border-indigo-100">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-medium text-indigo-700 uppercase">Pending Pods</CardTitle>
                            <Activity className="h-4 w-4 text-indigo-500" />
                        </CardHeader>
                        <CardContent className="py-0 px-4 pb-3">
                            <div className="text-2xl font-bold text-indigo-900">2</div>
                            <p className="text-[10px] text-indigo-600 mt-1">resource insufficient (GPU)</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50/50 border-emerald-100">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-medium text-emerald-700 uppercase">Health Check</CardTitle>
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent className="py-0 px-4 pb-3">
                            <div className="text-2xl font-bold text-emerald-900">98%</div>
                            <p className="text-[10px] text-emerald-600 mt-1">System connectivity stable</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-medium text-slate-700 uppercase">Total Events</CardTitle>
                            <Terminal className="h-4 w-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="py-0 px-4 pb-3">
                            <div className="text-2xl font-bold text-slate-900">{events.length}</div>
                            <p className="text-[10px] text-slate-600 mt-1">Logged in current session</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Analysis Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Timeline */}
                    <Card className="lg:col-span-1 shadow-md border-l-4 border-l-primary">
                        <CardContent className="p-6">
                            {analysis && <StartupTimeline data={analysis} />}
                        </CardContent>
                    </Card>

                    {/* Right: AI Diagnosis Summary */}
                    <Card className="lg:col-span-2 overflow-hidden shadow-lg border-2 border-primary/20 relative group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-24 h-24 text-primary" />
                        </div>
                        <CardHeader className="bg-primary/5 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" strokeWidth={3} />
                                AI Intelligent Diagnosis Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {analysis && (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-red-500 border-none">ROOT CAUSE</Badge>
                                            <span className="font-bold text-slate-900">{analysis.diagnosis.cause}</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg border-l-4 border-primary text-sm text-slate-700 leading-relaxed italic">
                                            "{analysis.diagnosis.recommendation}"
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <h5 className="text-[11px] font-bold text-slate-400 uppercase mb-3">Recommended Actions</h5>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-emerald-50 p-3 rounded-md border border-emerald-100">
                                                <p className="text-[10px] text-emerald-800 font-bold mb-1">IMAGE POLICY</p>
                                                <p className="text-xs text-emerald-700">Set PullPolicy: "IfNotPresent"</p>
                                            </div>
                                            <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                                <p className="text-[10px] text-indigo-800 font-bold mb-1">RESOURCE LIMIT</p>
                                                <p className="text-xs text-indigo-700">Update memory request to 1Gi</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Event Logs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-bold text-base">Recent Cluster Events</h3>
                    </div>
                    <EventTable events={events} />
                </div>
            </div>
        </DashboardLayout>
    );
}
