import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface K8sEvent {
    id: number;
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    count: number;
    lastTimestamp: string;
    component: string;
    object: string;
}

export function EventTable({ events }: { events: K8sEvent[] }) {
    return (
        <div className="rounded-md border border-border bg-card shadow-sm">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[150px]">Reason</TableHead>
                        <TableHead>Object / Message</TableHead>
                        <TableHead className="w-[100px]">Time</TableHead>
                        <TableHead className="w-[150px]">Component</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => (
                        <TableRow key={event.id} className="group hover:bg-muted/30 transition-colors">
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {event.type === 'Warning' ? (
                                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                                    ) : (
                                        <Info className="w-3.5 h-3.5 text-blue-500" />
                                    )}
                                    <span className={event.type === 'Warning' ? 'text-yellow-600 font-semibold' : 'text-blue-600 font-semibold'}>
                                        {event.type}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{event.reason}</TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-primary font-bold">{event.object}</span>
                                    <span className="text-xs text-muted-foreground line-clamp-1 group-hover:line-clamp-none transition-all">
                                        {event.message}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{event.lastTimestamp} ago</TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground">{event.component}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
