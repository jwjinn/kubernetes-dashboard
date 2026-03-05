import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContainerMap } from '@/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ContainerBlock } from '@/features/kubernetes/components/ContainerBlock';
import type { ContainerData } from '@/features/kubernetes/components/ContainerBlock';
import { useFilterStore } from '@/store/filterStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResourceDetailsSheet } from '@/features/kubernetes/components/ResourceDetailsSheet';

export default function ContainerMapPage() {
    const [groupBy, setGroupBy] = useState<'node' | 'namespace'>('node');
    const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);

    const { data: containers = [], isLoading } = useQuery<ContainerData[]>({
        queryKey: ['containerMap'],
        queryFn: fetchContainerMap,
        refetchInterval: 5000 // auto refresh every 5s mimicking real-time
    });

    const handleContainerClick = (container: ContainerData) => {
        // TODO: Open ResourceDetailsSheet
        console.log("Clicked:", container);
    };

    // Grouping logic
    const groupedContainers = containers.reduce((acc, container) => {
        const key = container[groupBy];
        if (!acc[key]) acc[key] = [];
        acc[key].push(container);
        return acc;
    }, {} as Record<string, ContainerData[]>);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Container Map</h2>
                        <p className="text-muted-foreground text-sm mt-1 mb-3">
                            클러스터 내 모든 파드와 컨테이너의 실시간 자원 활용 상태(CPU/Memory)를 시각적인 블록 맵으로 한눈에 파악합니다.
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500"></div><span className="text-muted-foreground">정상 (CPU 사용량 비례 진하기)</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-400"></div><span className="text-muted-foreground">경고/지연</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500"></div><span className="text-muted-foreground">장애/실패 (Failed)</span></div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Group By:</span>
                        <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Group by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="node">Node (Host)</SelectItem>
                                <SelectItem value="namespace">Namespace</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 bg-card border border-border rounded-lg shadow-inner overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center animate-pulse text-muted-foreground">
                            Processing cluster topology...
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedContainers).map(([groupName, groupItems]) => (
                                <div key={groupName} className="bg-background rounded-md border border-border p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4 border-b pb-2">
                                        <h3 className="font-semibold text-base">{groupName}</h3>
                                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                                            {groupItems.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {groupItems.map(item => (
                                            <ContainerBlock key={item.id} data={item} onClick={handleContainerClick} />
                                        ))}
                                    </div>
                                </div>
                            ))}
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
