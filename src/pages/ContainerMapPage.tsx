import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContainerMap } from '@/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ContainerBlock } from '@/features/kubernetes/components/ContainerBlock';
import type { ContainerData } from '@/features/kubernetes/components/ContainerBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResourceDetailsSheet } from '@/features/kubernetes/components/ResourceDetailsSheet';
import { Cpu, Zap, Search, Info } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function ContainerMapPage() {
    const [groupBy, setGroupBy] = useState<'node' | 'namespace'>('node');
    const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredPodId, setHoveredPodId] = useState<string | null>(null);

    const { data: containers = [], isLoading } = useQuery<ContainerData[]>({
        queryKey: ['containerMap'],
        queryFn: fetchContainerMap,
        refetchInterval: 5000
    });

    const handleContainerClick = (container: ContainerData) => {
        setSelectedContainer(container);
    };

    // Extract workload prefix (e.g., app-worker-A-0 -> app-worker-A)
    const getWorkloadName = (name: string) => {
        const parts = name.split('-');
        if (parts.length > 1) {
            // Remove the last part (instance/node index)
            return parts.slice(0, -1).join('-');
        }
        return name;
    };

    const filteredContainers = useMemo(() => {
        if (!searchQuery) return containers;
        return containers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.namespace.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [containers, searchQuery]);

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
                                        <li>각 블록은 하나의 **컨테이너/파드**를 나타냅니다.</li>
                                        <li>**색상**: 리소스 사용량 및 상태 (초록:정상, 노랑:경고, 빨강:장애)</li>
                                        <li>**아이콘**: <Zap className="inline w-3 h-3" /> GPU 사용, <Cpu className="inline w-3 h-3" /> CPU 전용</li>
                                        <li>**하이라이트**: 블록에 마우스를 올리면 해당 파드만 강조됩니다.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 mb-4">
                            클러스터 리소스 상태를 가시화합니다. 블록 위로 마우스를 올려 상세 정보를 확인하세요.
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                                <span className="text-muted-foreground">GPU (Usage Base)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                <span className="text-muted-foreground">CPU (Usage Base)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-yellow-400"></div>
                                <span className="text-muted-foreground">Warning</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                                <span className="text-muted-foreground">Failed</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
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
                            Processing cluster topology...
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
                                    No containers found matching "{searchQuery}"
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
