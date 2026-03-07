import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchContainerMap } from '@/api';
import type { ContainerData } from '@/features/kubernetes/components/ContainerBlock';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, Text, Metric, Grid, Badge, Flex, TabGroup, TabList, Tab, TabPanels, TabPanel, TextInput } from '@tremor/react';
import {
    Search, Filter, ChevronRight, Activity, FileText,
    Share2, History, Zap, Settings, Box, LayoutGrid,
    AlertCircle, CheckCircle2, Info, ChevronDown, ListFilter, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TraceTab } from '@/features/analysis/components/TraceTab';
import { EventsTab } from '@/features/analysis/components/EventsTab';
import { MetricsTab } from '@/features/kubernetes/components/MetricsTab';
import { ResourceRelationshipTab } from '@/features/analysis/components/ResourceRelationshipTab';
import { LogViewer } from '@/features/logs/components/LogViewer';
import { MoreVertical, ExternalLink } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export default function AnalysisPage() {
    const [searchParams] = useSearchParams();
    const namespaceParam = searchParams.get('namespace');
    const podNameParam = searchParams.get('podName');

    const [selectedTab, setSelectedTab] = useState(0);
    const [expandedPodId, setExpandedPodId] = useState<string | null>(null);
    const [isManifestOpen, setIsManifestOpen] = useState(false);
    const navigate = useNavigate();

    const { data: containers = [], isLoading } = useQuery<ContainerData[]>({
        queryKey: ['containerMap'],
        queryFn: fetchContainerMap,
        refetchInterval: 5000,
    });

    // Find the currently selected pod from the URL params
    const selectedPod = containers.find(c => c.namespace === namespaceParam && c.name === podNameParam);

    useEffect(() => {
        if (selectedPod) {
            setExpandedPodId(selectedPod.id);
        } else {
            setExpandedPodId(null);
        }
    }, [selectedPod]);

    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-140px)] flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm ${selectedPod ? (selectedPod.status === 'healthy' ? 'bg-blue-600' : selectedPod.status === 'warning' ? 'bg-amber-500' : 'bg-red-500') : 'bg-indigo-600'}`}>
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">
                                {selectedPod ? selectedPod.name : 'Pod Analysis'}
                            </h2>
                            <p className="text-muted-foreground text-xs font-medium">
                                {selectedPod ? '단일 파드 상세 분석 및 리소스 진단' : 'Container Map에서 분석할 대상을 선택해주세요.'}
                            </p>
                        </div>
                    </div>
                    {selectedPod && (
                        <div className="flex gap-2">
                            <Badge color="gray" size="sm" className="px-3 py-1 text-xs">Node: {selectedPod.node}</Badge>
                            <Badge color="gray" size="sm" className="px-3 py-1 text-xs">Namespace: {selectedPod.namespace}</Badge>
                            <Badge color={selectedPod.status === 'healthy' ? 'blue' : selectedPod.status === 'warning' ? 'yellow' : 'red'} size="sm" className="px-3 py-1 text-xs uppercase font-bold text-white shadow-sm">
                                Status: {selectedPod.status}
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* LEFT PANEL: Single Pod Details */}
                    <div className="w-[360px] flex flex-col gap-4 shrink-0 overflow-hidden">
                        {selectedPod ? (
                            <Card className="flex-1 p-0 border-border shadow-sm flex flex-col overflow-hidden bg-card">
                                <div className="p-4 border-b border-border bg-muted/20">
                                    <Text className="font-extrabold flex items-center gap-2">
                                        <Info className="w-4 h-4 text-indigo-500" /> 대상 상세 정보
                                    </Text>
                                </div>
                                <div className="p-4 space-y-4 overflow-y-auto">
                                    {/* Quick Info Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                                            <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Namespace</Text>
                                            <Text className="text-xs font-semibold text-foreground truncate">{selectedPod.namespace}</Text>
                                        </div>
                                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                                            <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Node</Text>
                                            <Text className="text-[11px] font-semibold text-foreground truncate flex items-center gap-1 cursor-pointer hover:text-indigo-600" onClick={() => navigate('/dashboard')}>
                                                {selectedPod.node} <ExternalLink className="w-3 h-3 opacity-50" />
                                            </Text>
                                        </div>
                                        <div className="bg-muted/30 p-3 rounded-lg border border-border col-span-2">
                                            <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Image</Text>
                                            <Text className="text-[11px] font-medium text-blue-600 truncate bg-blue-50/50 p-1.5 rounded">{selectedPod.image || 'N/A'}</Text>
                                        </div>
                                        <div className="bg-muted/30 p-3 rounded-lg border border-border col-span-2">
                                            <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Service Name</Text>
                                            <Text className="text-[11px] font-medium text-foreground truncate">{selectedPod.serviceName || 'N/A'}</Text>
                                        </div>
                                    </div>

                                    {/* Resource Metrics Summary */}
                                    <div className="space-y-3">
                                        <Text className="text-xs font-bold border-b border-border pb-1">Current Resource Usage</Text>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="border border-border/50 rounded p-2">
                                                <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">CPU Usage</Text>
                                                <div className="flex items-end gap-2">
                                                    <Metric className="text-lg font-black">{selectedPod.cpuUsagePercent}%</Metric>
                                                </div>
                                            </div>
                                            <div className="border border-border/50 rounded p-2">
                                                <Text className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Memory Usage</Text>
                                                <div className="flex items-end gap-2">
                                                    <Metric className="text-lg font-black">{selectedPod.memUsagePercent}%</Metric>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-6 border-t border-border mt-6 grid grid-cols-2 gap-2">
                                        <button onClick={() => setIsManifestOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100 transition-colors">
                                            <FileText className="w-3.5 h-3.5" /> Manifest
                                        </button>
                                        <button onClick={() => navigate('/dashboard')} className="flex items-center justify-center gap-2 px-4 py-2 bg-muted text-foreground text-xs font-bold rounded hover:bg-muted/80 transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" /> Go to Node
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="flex-1 p-8 border-dashed border-2 border-border flex flex-col items-center justify-center text-center bg-muted/10">
                                <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                                    <Box className="w-10 h-10 text-indigo-300" />
                                </div>
                                <Text className="text-lg font-bold text-foreground mb-2">대상 선택 필요</Text>
                                <Text className="text-sm text-muted-foreground max-w-[250px]">
                                    Container Map에서 특정 파드를 선택하여 상세 분석 화면으로 진입해주세요.
                                </Text>
                            </Card>
                        )}
                    </div>

                    {/* RIGHT PANEL: Diagnostic Tabs */}
                    <div className="flex-1 flex flex-col border border-border rounded-xl bg-card shadow-lg overflow-hidden">
                        <TabGroup index={selectedTab} onIndexChange={setSelectedTab} className="flex flex-col h-full">
                            <TabList variant="line" className="px-4 border-b border-border bg-muted/10 h-12 shrink-0">
                                <Tab className="gap-2 h-full"><Share2 className="w-4 h-4" /> 리소스 관계</Tab>
                                <Tab className="gap-2 h-full"><Activity className="w-4 h-4" /> 메트릭스</Tab>
                                <Tab className="gap-2 h-full"><FileText className="w-4 h-4" /> 로그</Tab>
                                <Tab className="gap-2 h-full"><History className="w-4 h-4" /> 이벤트</Tab>
                            </TabList>

                            <div className="flex-1 overflow-y-auto p-6 relative">
                                {selectedTab === 0 && (
                                    <ResourceRelationshipTab podId={expandedPodId} />
                                )}

                                {selectedTab === 1 && (
                                    <MetricsTab containerId={expandedPodId || 'demo'} />
                                )}

                                {selectedTab === 2 && (
                                    <div className="h-full flex flex-col">
                                        {selectedPod ? (
                                            <LogViewer podName={selectedPod.name} height="h-full" />
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                                                대상을 선택해주세요.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedTab === 3 && (
                                    <EventsTab />
                                )}
                            </div>
                        </TabGroup>
                    </div>
                </div>
            </div>

            {/* Manifest Dialog */}
            <Dialog open={isManifestOpen} onOpenChange={setIsManifestOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden bg-[#1e1e1e] border-indigo-500/30 text-indigo-100">
                    <DialogHeader className="p-6 border-b border-indigo-500/20 shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                            <FileText className="w-5 h-5 text-indigo-400" /> {selectedPod?.name} Manifest
                        </DialogTitle>
                        <DialogDescription className="text-indigo-300/60">
                            Kubernetes Object YAML 정의문
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed relative">
                        <button
                            className="absolute top-4 right-6 p-2 hover:bg-white/10 rounded-md transition-colors text-indigo-300"
                            onClick={() => {
                                const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${selectedPod?.name}
  namespace: ${selectedPod?.namespace}
  labels:
    app: ${selectedPod?.serviceName}
spec:
  containers:
  - name: container-0
    image: ${selectedPod?.image}
    ports:
    - containerPort: 80`;
                                navigator.clipboard.writeText(yaml);
                                alert('YAML이 클립보드에 복사되었습니다.');
                            }}
                        >
                            Copy YAML
                        </button>
                        <pre className="text-indigo-200">
                            {`apiVersion: v1
kind: Pod
metadata:
  name: ${selectedPod?.name}
  namespace: ${selectedPod?.namespace}
  labels:
    app: ${selectedPod?.serviceName}
spec:
  containers:
  - name: container-0
    image: ${selectedPod?.image}
    ports:
    - containerPort: 80
    resources:
      limits:
        cpu: "1"
        memory: "1Gi"
      requests:
        cpu: "0.5"
        memory: "512Mi"`}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
