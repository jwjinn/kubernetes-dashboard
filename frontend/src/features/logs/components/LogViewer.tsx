import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogs } from '@/api';
import {
    Search, Filter, Trash2, Download,
    Play, Pause, ChevronDown, Terminal,
    AlertCircle, Info, AlertTriangle, SearchCode
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    source: string;
}

interface LogViewerProps {
    podName?: string;
    height?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ podName, height = "h-96" }) => {
    const [search, setSearch] = useState('');
    const [level, setLevel] = useState('ALL');
    const [isLive, setIsLive] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const { data: logs = [], isLoading } = useQuery<LogEntry[]>({
        queryKey: ['logs', podName, level, search],
        queryFn: () => fetchLogs(podName, level, search),
        refetchInterval: isLive ? 2000 : false,
    });

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        setAutoScroll(isAtBottom);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'WARN': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
            case 'DEBUG': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            default: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        }
    };

    const downloadLogs = () => {
        const content = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${podName || 'cluster'}-logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`flex flex-col bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl ${height}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 w-64 transition-all"
                        />
                    </div>

                    <Select value={level} onValueChange={setLevel}>
                        <SelectTrigger className="w-32 h-8 bg-black/40 border-white/10 text-xs text-white">
                            <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1d25] border-white/10 text-white">
                            <SelectItem value="ALL">All Levels</SelectItem>
                            <SelectItem value="INFO">Info</SelectItem>
                            <SelectItem value="WARN">Warning</SelectItem>
                            <SelectItem value="ERROR">Error</SelectItem>
                            <SelectItem value="DEBUG">Debug</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/10">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Live Tail</span>
                        <Switch
                            checked={isLive}
                            onCheckedChange={setIsLive}
                        />
                        {isLive ? (
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        ) : (
                            <div className="w-2 h-2 bg-white/20 rounded-full" />
                        )}
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    <button
                        onClick={downloadLogs}
                        className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent hover:border-white/10"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    <button
                        className="p-2 hover:bg-red-500/10 rounded-lg text-white/60 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
                        title="Clear View"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Log Display Area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto font-mono text-[13px] leading-relaxed p-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
                {isLoading && logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
                        <Terminal className="w-8 h-8 animate-pulse" />
                        <p className="text-sm font-medium">Fetching logs from {podName || 'cluster'}...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
                        <SearchCode className="w-8 h-8" />
                        <p className="text-sm font-medium">No logs found matching criteria</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log) => (
                            <div key={log.id} className="group flex gap-4 hover:bg-white/[0.02] -mx-4 px-4 py-0.5 transition-colors">
                                <span className="shrink-0 text-white/30 text-[11px] select-none pt-0.5">{log.timestamp}</span>
                                <span className={`shrink-0 px-1.5 py-0 text-[10px] font-bold rounded border h-fit mt-0.5 select-none ${getLevelColor(log.level)}`}>
                                    {log.level}
                                </span>
                                <span className="text-white/80 break-all whitespace-pre-wrap">{log.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="px-4 py-2 bg-black/60 border-t border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 text-white/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Total: <span className="text-white/80">{logs.length} Lines</span>
                    </span>
                    {!podName && (
                        <span className="flex items-center gap-1.5 text-white/40">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Source: <span className="text-white/80 italic">Global Explorer</span>
                        </span>
                    )}
                </div>
                {autoScroll && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                        <ChevronDown className="w-3 h-3 animate-bounce" />
                        STICKY BOTTOM
                    </span>
                )}
            </div>
        </div>
    );
};
