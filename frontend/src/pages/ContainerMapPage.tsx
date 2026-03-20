import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContainerMap } from '@/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ContainerBlock } from '@/features/kubernetes/components/ContainerBlock';
import type { ContainerData } from '@/features/kubernetes/components/ContainerBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResourceDetailsSheet } from '@/features/kubernetes/components/ResourceDetailsSheet';
import { Zap, Search, Info } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { getEnv } from '@/config/env';
import { statusDisplayLabel } from '@/features/kubernetes/utils/status';
import { formatClockTime } from '@/lib/format';

export default function ContainerMapPage() {
    const [groupBy, setGroupBy] = useState<'node' | 'namespace'>('node');
    const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredPodId, setHoveredPodId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'warning' | 'failed'>('all');
    const [workloadFilter, setWorkloadFilter] = useState<'all' | 'NPU' | 'CPU'>('all');

    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU');

    const { data: containers = [], isLoading, dataUpdatedAt } = useQuery<ContainerData[]>({
        queryKey: ['containerMap'],
        queryFn: fetchContainerMap,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const previousSnapshotRef = useRef<Map<string, string>>(new Map());
    const [recentlyChangedIds, setRecentlyChangedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (containers.length === 0) return;

        const changedIds = new Set<string>();
        const nextSnapshot = new Map<string, string>();

        containers.forEach((container) => {
            const signature = `${container.status}|${container.statusReason || ''}`;
            nextSnapshot.set(container.id, signature);
            const previous = previousSnapshotRef.current.get(container.id);
            if (previous && previous !== signature) {
                changedIds.add(container.id);
            }
        });

        previousSnapshotRef.current = nextSnapshot;

        if (changedIds.size > 0) {
            setRecentlyChangedIds((prev) => new Set([...prev, ...changedIds]));
            const timeout = window.setTimeout(() => {
                setRecentlyChangedIds((prev) => {
                    const next = new Set(prev);
                    changedIds.forEach((id) => next.delete(id));
                    return next;
                });
            }, 60000);

            return () => window.clearTimeout(timeout);
        }
    }, [containers]);

    const handleContainerClick = (container: ContainerData) => {
        setSelectedContainer(container);
    };

    const filteredContainers = useMemo(() => {
        return containers.filter(c => {
            const matchesSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.namespace.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
            const matchesWorkload = workloadFilter === 'all' || c.resourceType === workloadFilter;
            return matchesSearch && matchesStatus && matchesWorkload;
        });
    }, [containers, searchQuery, statusFilter, workloadFilter]);

    // Grouping logic
    const groupedContainers = filteredContainers.reduce((acc, container) => {
        const key = container[groupBy];
        if (!acc[key]) acc[key] = [];
        acc[key].push(container);
        return acc;
    }, {} as Record<string, ContainerData[]>);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold tracking-tight">Container Map</h2>
                            <div className="group relative">
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                <div className="absolute left-0 top-6 w-80 p-3 bg-popover border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed">
                                    <p className="font-bold mb-1">지도 읽는 법:</p>
                                    <ul className="list-disc ml-4 space-y-1">
                                        <li>각 블록은 하나의 파드를 의미합니다.</li>
                                        <li>보라색 카드는 {acceleratorMode} 요청 파드, 초록색 카드는 CPU 전용 파드입니다.</li>
                                        <li>주황색 카드는 경고 상태, 빨간색 카드는 실패 상태입니다.</li>
                                        <li>{acceleratorMode} 파드는 CPU, MEM, 그리고 Pod 기준 {acceleratorMode} 실사용률을 함께 보여줍니다.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 mb-4">
                            클러스터 리소스 상태를 가시화합니다. 블록 위로 마우스를 올려 상세 정보를 확인하세요.
                        </p>
                        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>마지막 갱신 {formatClockTime(dataUpdatedAt)}</span>
                            <span>최근 변경 {recentlyChangedIds.size}건</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                                <span className="text-muted-foreground">{acceleratorMode} workload</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                <span className="text-muted-foreground">CPU Pod</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-amber-400"></div>
                                <span className="text-muted-foreground">Warning Pod</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                                <span className="text-muted-foreground">Failed pod</span>
                            </div>

                            <div className="h-3 w-[1px] bg-border mx-1"></div>

                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-indigo-600" fill="currentColor" />
                                <span className="text-muted-foreground">{acceleratorMode} observed usage</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Info className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Hover to see warning reason</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search pods or namespaces..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체 상태</SelectItem>
                                    <SelectItem value="healthy">{statusDisplayLabel('healthy')}</SelectItem>
                                    <SelectItem value="warning">{statusDisplayLabel('warning')}</SelectItem>
                                    <SelectItem value="failed">{statusDisplayLabel('failed')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Select value={workloadFilter} onValueChange={(val: any) => setWorkloadFilter(val)}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Workload" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Workloads</SelectItem>
                                    <SelectItem value="NPU">{acceleratorMode} Pods</SelectItem>
                                    <SelectItem value="CPU">CPU-only Pods</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Group by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="node">By Node</SelectItem>
                                    <SelectItem value="namespace">By Namespace</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 bg-card/50 border border-border rounded-xl shadow-inner overflow-auto p-6 min-h-[600px]">
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">
                            클러스터 상태를 불러오는 중입니다...
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {Object.entries(groupedContainers).map(([groupName, groupItems]) => (
                                <div key={groupName} className="animate-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-2">
                                        <h3 className="font-bold text-lg">{groupName}</h3>
                                        <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-black">
                                            {groupItems.length} UNITS
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {groupItems.map(item => {
                                            const isHighlighted = hoveredPodId === item.id;
                                            const isDimmed = hoveredPodId !== null && !isHighlighted;

                                            return (
                                                <ContainerBlock
                                                    key={item.id}
                                                    data={item}
                                                    onClick={handleContainerClick}
                                                    recentlyChanged={recentlyChangedIds.has(item.id)}
                                                    isHighlighted={isHighlighted}
                                                    isDimmed={isDimmed}
                                                    onHover={(id) => setHoveredPodId(id)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {filteredContainers.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground italic">
                                    현재 검색어 또는 상태 필터에 맞는 파드가 없습니다. 필터를 완화하거나 다른 노드/네임스페이스를 확인해보세요.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Detail Sheet Modal */}
            <ResourceDetailsSheet
                container={selectedContainer}
                isOpen={!!selectedContainer}
                onClose={() => setSelectedContainer(null)}
            />
        </DashboardLayout>
    );
}
