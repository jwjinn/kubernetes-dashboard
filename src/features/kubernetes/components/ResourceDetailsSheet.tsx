import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContainerData } from './ContainerBlock';
import { MetricsTab } from './MetricsTab';
import { Box, Activity, FileText, Settings, Webhook } from 'lucide-react';

interface ResourceDetailsSheetProps {
    container: ContainerData | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ResourceDetailsSheet({ container, isOpen, onClose }: ResourceDetailsSheetProps) {
    if (!container) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[800px] sm:max-w-none border-l border-border p-0 flex flex-col bg-card/95 backdrop-blur-md">
                <SheetHeader className="p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded shadow flex items-center justify-center
              ${container.status === 'failed' ? 'bg-red-500' : container.status === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500'} text-white`}>
                            <Box className="w-5 h-5" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl tracking-tight">{container.name}</SheetTitle>
                            <SheetDescription className="mt-1 flex items-center gap-4 text-xs font-medium">
                                <span><strong className="text-foreground">Namespace:</strong> {container.namespace}</span>
                                <span><strong className="text-foreground">Node:</strong> {container.node}</span>
                                <span className="uppercase tracking-wider opacity-80">{container.status}</span>
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden p-6 relative">
                    <Tabs defaultValue="metrics" className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-5 h-12 bg-muted/50 rounded-lg p-1">
                            <TabsTrigger value="metrics" className="gap-2"><Activity className="w-4 h-4" /> Metrics</TabsTrigger>
                            <TabsTrigger value="logs" className="gap-2"><FileText className="w-4 h-4" /> Logs</TabsTrigger>
                            <TabsTrigger value="events" className="gap-2"><Settings className="w-4 h-4" /> Events</TabsTrigger>
                            <TabsTrigger value="trace" className="gap-2" disabled={!container.hasTrace}><Webhook className="w-4 h-4" /> Trace (APM)</TabsTrigger>
                            <TabsTrigger value="callinfo" className="gap-2"><Box className="w-4 h-4" /> Call Info</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 mt-4 overflow-hidden relative">
                            <TabsContent value="metrics" className="h-full m-0 p-0">
                                <ScrollArea className="h-full">
                                    <MetricsTab containerId={container.id} />
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="logs" className="h-full m-0 p-0">
                                <div className="bg-[#1e1e1e] text-green-400 font-mono text-xs p-4 rounded-md h-full overflow-hidden flex flex-col">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700 text-gray-400">
                                        <span>container-stdout.log</span>
                                        <span className="flex gap-2">
                                            <button className="hover:text-white">Live Tail: ON</button>
                                        </span>
                                    </div>
                                    <ScrollArea className="flex-1 font-mono">
                                        <div className="space-y-1">
                                            <p>[2026-03-05 14:02:01] INFO  com.myapp.Server - Application started on port 8080</p>
                                            <p>[2026-03-05 14:02:05] WARN  com.myapp.DB - Connection took &gt; 500ms</p>
                                            <p>[2026-03-05 14:03:12] INFO  com.myapp.Worker - Processed 1500 items in batch job</p>
                                            {container.status === 'failed' && (
                                                <p className="text-red-400">[2026-03-05 14:03:15] ERROR com.myapp.Main - OutOfMemoryError: Java heap space</p>
                                            )}
                                            {Array.from({ length: 20 }).map((_, i) => (
                                                <p key={i} className="opacity-80">[2026-03-05 14:04:{i < 10 ? `0${i}` : i}] DEBUG Request handling ok.</p>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </TabsContent>

                            <TabsContent value="events" className="h-full m-0 p-0 flex items-center justify-center text-muted-foreground">
                                Kubernetes Events Timeline Mock...
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
