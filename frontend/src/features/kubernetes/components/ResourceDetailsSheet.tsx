import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContainerData } from './ContainerBlock';
import { MetricsTab } from './MetricsTab';
import { PodEventsTab } from './PodEventsTab';
import { LogSourceTabs } from '@/features/logs/components/LogSourceTabs';
import { Box, Activity, FileText, Settings, Webhook, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { statusAccentClass, statusDisplayLabel } from '@/features/kubernetes/utils/status';

interface ResourceDetailsSheetProps {
    container: ContainerData | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ResourceDetailsSheet({ container, isOpen, onClose }: ResourceDetailsSheetProps) {
    const navigate = useNavigate();
    if (!container) return null;

    const handleFullAnalysis = () => {
        navigate(`/analysis?namespace=${container.namespace}&podName=${container.name}`);
        onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[800px] sm:max-w-none border-l border-border p-0 flex flex-col bg-card/95 backdrop-blur-md">
                <SheetHeader className="p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded shadow flex items-center justify-center
              ${statusAccentClass(container.status)} text-white`}>
                            <Box className="w-5 h-5" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl tracking-tight">{container.name}</SheetTitle>
                            <SheetDescription className="mt-1 flex items-center gap-4 text-xs font-medium">
                                <span><strong className="text-foreground">Namespace:</strong> {container.namespace}</span>
                                <span><strong className="text-foreground">Node:</strong> {container.node}</span>
                                <span className="tracking-wider opacity-80">{statusDisplayLabel(container.status)}</span>
                                {container.statusReason && <span><strong className="text-foreground">Reason:</strong> {container.statusReason}</span>}
                            </SheetDescription>
                        </div>
                    </div>
                    <button
                        onClick={handleFullAnalysis}
                        className="ml-auto p-2 hover:bg-muted rounded-full transition-colors group flex items-center gap-2"
                        title="상세 분석 (Full Analysis)"
                    >
                        <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">상세 분석</span>
                        <Maximize2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                </SheetHeader>

                <div className="flex-1 overflow-hidden p-6 relative">
                    <Tabs defaultValue="metrics" className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 rounded-lg p-1">
                            <TabsTrigger value="metrics" className="gap-2"><Activity className="w-4 h-4" /> Metrics</TabsTrigger>
                            <TabsTrigger value="logs" className="gap-2"><FileText className="w-4 h-4" /> Logs</TabsTrigger>
                            <TabsTrigger value="events" className="gap-2"><Settings className="w-4 h-4" /> Events</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 mt-4 overflow-hidden relative">
                            <TabsContent value="metrics" className="h-full m-0 p-0">
                                <ScrollArea className="h-full">
                                    <MetricsTab containerId={container.id} />
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="logs" className="h-full m-0 p-0">
                                <LogSourceTabs namespace={container.namespace} podName={container.name} height="h-full" />
                            </TabsContent>

                            <TabsContent value="events" className="h-full m-0 p-0">
                                <PodEventsTab namespace={container.namespace} podName={container.name} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
