import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Phase {
    name: string;
    duration: number;
    status: 'completed' | 'failed' | 'pending';
    timestamp: string;
}

interface StartupAnalysis {
    podName: string;
    status: string;
    phases: Phase[];
}

export function StartupTimeline({ data }: { data: StartupAnalysis }) {
    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Pod Startup Analysis: <span className="text-primary">{data.podName}</span>
                    </CardTitle>
                    <Badge variant={data.status.includes('Failed') || data.status.includes('BackOff') ? 'destructive' : 'outline'}>
                        {data.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-0">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-border/50 before:to-transparent">
                    {data.phases.map((phase, index) => (
                        <div key={index} className="relative flex items-start gap-6 pl-8 group">
                            {/* Milestone Dot */}
                            <div className={cn(
                                "absolute left-0 w-6 h-6 rounded-full flex items-center justify-center bg-background border-2 z-10 transition-colors",
                                phase.status === 'completed' && "border-emerald-500 text-emerald-500",
                                phase.status === 'failed' && "border-red-500 text-red-500 animate-pulse",
                                phase.status === 'pending' && "border-muted-foreground/30 text-muted-foreground/30"
                            )}>
                                {phase.status === 'completed' && <CheckCircle2 className="w-4 h-4 fill-emerald-50" />}
                                {phase.status === 'failed' && <AlertCircle className="w-4 h-4 fill-red-50" />}
                                {phase.status === 'pending' && <Circle className="w-4 h-4" />}
                            </div>

                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <h4 className={cn(
                                        "text-sm font-bold transition-colors",
                                        phase.status === 'failed' ? "text-red-500" : "text-foreground"
                                    )}>
                                        {phase.name}
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                        {phase.duration > 0 ? `${phase.duration}s` : '-'}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{phase.timestamp}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
