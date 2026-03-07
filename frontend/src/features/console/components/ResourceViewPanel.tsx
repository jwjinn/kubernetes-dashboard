import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@tremor/react';
import { Activity, Search, TerminalSquare, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ResourceViewPanelProps {
    onCommandSelect: (cmd: string) => void;
}

type ViewContext = 'pods' | 'svc' | 'nodes';

const MOCK_DATA = {
    pods: [
        { namespace: 'default', name: 'nginx-deployment-7fb96c846b-8b5x', ready: '1/1', status: 'Running', restarts: '0', age: '2d' },
        { namespace: 'kube-system', name: 'coredns-5dd5756b68-h6bvw', ready: '1/1', status: 'Running', restarts: '0', age: '10d' },
        { namespace: 'monitoring', name: 'prometheus-k8s-0', ready: '2/2', status: 'Running', restarts: '1', age: '5d' },
        { namespace: 'ai-workloads', name: 'npu-inference-job-xl2q', ready: '1/1', status: 'Running', restarts: '0', age: '4h' },
        { namespace: 'default', name: 'frontend-app-crashloop', ready: '0/1', status: 'CrashLoopBackOff', restarts: '42', age: '1d' },
    ],
    svc: [
        { namespace: 'default', name: 'kubernetes', type: 'ClusterIP', clusterIp: '10.96.0.1', externalIp: '<none>', ports: '443/TCP', age: '10d' },
        { namespace: 'kube-system', name: 'kube-dns', type: 'ClusterIP', clusterIp: '10.96.0.10', externalIp: '<none>', ports: '53/UDP,53/TCP,9153/TCP', age: '10d' },
        { namespace: 'monitoring', name: 'prometheus-operated', type: 'ClusterIP', clusterIp: 'None', externalIp: '<none>', ports: '9090/TCP', age: '5d' },
        { namespace: 'ai-workloads', name: 'inference-svc', type: 'LoadBalancer', clusterIp: '10.101.44.2', externalIp: '192.168.1.150', ports: '80:31234/TCP', age: '4h' }
    ],
    nodes: [
        { name: 'node-0', status: 'Ready', roles: 'control-plane', age: '10d', version: 'v1.28.2' },
        { name: 'node-1', status: 'Ready', roles: '<none>', age: '10d', version: 'v1.28.2' },
        { name: 'node-2', status: 'Ready', roles: '<none>', age: '10d', version: 'v1.28.2' }
    ]
};

export function ResourceViewPanel({ onCommandSelect }: ResourceViewPanelProps) {
    const [viewContext, setViewContext] = useState<ViewContext>('pods');
    const [filterQuery, setFilterQuery] = useState('');
    const [isCommandMode, setIsCommandMode] = useState(false);
    const [isFilterMode, setIsFilterMode] = useState(false);
    const [paletteInput, setPaletteInput] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const paletteInputRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Filter Data
    const data = MOCK_DATA[viewContext];
    const filteredData = data.filter(item =>
        Object.values(item).some(val => val.toLowerCase().includes(filterQuery.toLowerCase()))
    );

    // Global Keybindings for k9s feel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter command mode
            if (e.key === ':' && !isCommandMode && !isFilterMode) {
                e.preventDefault();
                setIsCommandMode(true);
                setPaletteInput(':');
            }
            // Enter filter mode
            else if (e.key === '/' && !isCommandMode && !isFilterMode) {
                e.preventDefault();
                setIsFilterMode(true);
                setPaletteInput('/');
            }
            // Escape to close palettes or clear selections
            else if (e.key === 'Escape') {
                setIsCommandMode(false);
                setIsFilterMode(false);
                setFilterQuery('');
            }
            // Navigation
            else if (!isCommandMode && !isFilterMode) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, filteredData.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'd') { // Describe shortcut
                    const item = filteredData[selectedIndex];
                    if (item) {
                        const resourceType = viewContext === 'pods' ? 'pod' : viewContext === 'svc' ? 'svc' : 'node';
                        const name = (item as any).name;
                        const ns = (item as any).namespace ? `-n ${(item as any).namespace}` : '';
                        onCommandSelect(`kubectl describe ${resourceType} ${name} ${ns}`.trim());
                    }
                } else if (e.key === 'y') { // YAML shortcut
                    const item = filteredData[selectedIndex];
                    if (item) {
                        const resourceType = viewContext === 'pods' ? 'pod' : viewContext === 'svc' ? 'svc' : 'node';
                        const name = (item as any).name;
                        const ns = (item as any).namespace ? `-n ${(item as any).namespace}` : '';
                        onCommandSelect(`kubectl get ${resourceType} ${name} ${ns} -o yaml`.trim());
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCommandMode, isFilterMode, filteredData, selectedIndex, viewContext, onCommandSelect]);

    // Focus palette input when modes change
    useEffect(() => {
        if (isCommandMode || isFilterMode) {
            paletteInputRef.current?.focus();
        }
        // reset selection when data changes
        setSelectedIndex(0);
    }, [isCommandMode, isFilterMode, viewContext, filterQuery]);


    const handlePaletteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isCommandMode) {
            const cmd = paletteInput.substring(1).trim().toLowerCase();
            if (['po', 'pod', 'pods'].includes(cmd)) setViewContext('pods');
            else if (['svc', 'service', 'services'].includes(cmd)) setViewContext('svc');
            else if (['no', 'node', 'nodes'].includes(cmd)) setViewContext('nodes');
            setIsCommandMode(false);
        } else if (isFilterMode) {
            setFilterQuery(paletteInput.substring(1));
            setIsFilterMode(false);
        }
    };

    const handleRowClick = (index: number) => {
        setSelectedIndex(index);
    };

    const handleActionClick = (item: any, action: string) => {
        const resourceType = viewContext === 'pods' ? 'pod' : viewContext === 'svc' ? 'svc' : 'node';
        const name = item.name;
        const ns = item.namespace ? `-n ${item.namespace}` : '';

        if (action === 'logs' && resourceType === 'pod') {
            onCommandSelect(`kubectl logs ${name} ${ns}`);
        } else if (action === 'describe') {
            onCommandSelect(`kubectl describe ${resourceType} ${name} ${ns}`.trim());
        } else if (action === 'yaml') {
            onCommandSelect(`kubectl get ${resourceType} ${name} ${ns} -o yaml`.trim());
        }
    };


    const renderTableHeaders = () => {
        if (viewContext === 'pods') {
            return (
                <>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">NAMESPACE</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">NAME</th>
                    <th className="px-3 py-2 text-left font-bold w-20 text-gray-100">READY</th>
                    <th className="px-3 py-2 text-left font-bold w-32 text-gray-100">STATUS</th>
                    <th className="px-3 py-2 text-left font-bold w-24 text-gray-100">RESTARTS</th>
                    <th className="px-3 py-2 text-left font-bold w-20 text-gray-100">AGE</th>
                    <th className="px-3 py-2 text-right font-bold w-12 text-gray-100"></th>
                </>
            );
        } else if (viewContext === 'svc') {
            return (
                <>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">NAMESPACE</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">NAME</th>
                    <th className="px-3 py-2 text-left font-bold w-24 text-gray-100">TYPE</th>
                    <th className="px-3 py-2 text-left font-bold w-32 text-gray-100">CLUSTER-IP</th>
                    <th className="px-3 py-2 text-left font-bold w-32 text-gray-100">EXTERNAL-IP</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">PORT(S)</th>
                    <th className="px-3 py-2 text-left font-bold w-20 text-gray-100">AGE</th>
                    <th className="px-3 py-2 text-right font-bold w-12 text-gray-100"></th>
                </>
            );
        } else if (viewContext === 'nodes') {
            return (
                <>
                    <th className="px-3 py-2 text-left font-bold text-gray-100">NAME</th>
                    <th className="px-3 py-2 text-left font-bold w-32 text-gray-100">STATUS</th>
                    <th className="px-3 py-2 text-left font-bold w-40 text-gray-100">ROLES</th>
                    <th className="px-3 py-2 text-left font-bold w-24 text-gray-100">AGE</th>
                    <th className="px-3 py-2 text-left font-bold w-32 text-gray-100">VERSION</th>
                    <th className="px-3 py-2 text-right font-bold w-12 text-gray-100"></th>
                </>
            );
        }
    };

    const renderTableRow = (item: any, index: number) => {
        const isSelected = index === selectedIndex;
        const baseClass = "transition-colors cursor-default text-[13px] font-mono group ";
        // k9s uses a solid background color for selected row
        const selectedClass = isSelected ? "bg-cyan-900 text-white" : "hover:bg-muted/50 text-gray-300 border-b border-border/50";

        const getStatusColor = (status: string) => {
            if (['Running', 'Ready'].includes(status)) return 'text-emerald-500';
            if (['CrashLoopBackOff', 'Error'].includes(status)) return 'text-red-500';
            return 'text-gray-300';
        };

        const renderActions = () => (
            <td className="px-3 py-1.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className={`h-6 w-6 ${isSelected ? 'text-white hover:text-white' : 'text-gray-400'}`}>
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-mono text-xs w-48">
                        {viewContext === 'pods' && <DropdownMenuItem onClick={() => handleActionClick(item, 'logs')}>[ l ] Logs</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => handleActionClick(item, 'describe')}>[ d ] Describe</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleActionClick(item, 'yaml')}>[ y ] Get YAML</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        );

        if (viewContext === 'pods') {
            return (
                <tr key={index} className={baseClass + selectedClass} onClick={() => handleRowClick(index)}>
                    <td className="px-3 py-1.5 truncate max-w-[120px]" title={item.namespace}>{item.namespace}</td>
                    <td className="px-3 py-1.5 truncate max-w-[250px]" title={item.name}>{item.name}</td>
                    <td className="px-3 py-1.5">{item.ready}</td>
                    <td className={`px-3 py-1.5 font-bold ${!isSelected && getStatusColor(item.status)}`}>{item.status}</td>
                    <td className="px-3 py-1.5">{item.restarts}</td>
                    <td className="px-3 py-1.5">{item.age}</td>
                    {renderActions()}
                </tr>
            );
        } else if (viewContext === 'svc') {
            return (
                <tr key={index} className={baseClass + selectedClass} onClick={() => handleRowClick(index)}>
                    <td className="px-3 py-1.5 truncate max-w-[120px]">{item.namespace}</td>
                    <td className="px-3 py-1.5 truncate max-w-[200px]">{item.name}</td>
                    <td className="px-3 py-1.5 text-blue-400">{item.type}</td>
                    <td className="px-3 py-1.5">{item.clusterIp}</td>
                    <td className="px-3 py-1.5">{item.externalIp}</td>
                    <td className="px-3 py-1.5 truncate max-w-[150px] text-amber-500">{item.ports}</td>
                    <td className="px-3 py-1.5">{item.age}</td>
                    {renderActions()}
                </tr>
            );
        } else if (viewContext === 'nodes') {
            return (
                <tr key={index} className={baseClass + selectedClass} onClick={() => handleRowClick(index)}>
                    <td className="px-3 py-1.5 truncate max-w-[200px]">{item.name}</td>
                    <td className={`px-3 py-1.5 font-bold ${!isSelected && getStatusColor(item.status)}`}>{item.status}</td>
                    <td className="px-3 py-1.5 truncate">{item.roles}</td>
                    <td className="px-3 py-1.5">{item.age}</td>
                    <td className="px-3 py-1.5">{item.version}</td>
                    {renderActions()}
                </tr>
            );
        }
    };

    return (
        <Card className="flex flex-col h-full p-0 border-border/60 bg-background/50 backdrop-blur shadow-xl overflow-hidden relative font-mono">
            {/* Header / Palette Bar */}
            <div className={`p-2 border-b flex items-center gap-3 shrink-0 ${isCommandMode ? 'bg-indigo-500 text-white border-indigo-600' : isFilterMode ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-[#18181B] border-[#27272A] text-gray-200'}`}>
                {isCommandMode || isFilterMode ? (
                    <form onSubmit={handlePaletteSubmit} className="flex-1 flex items-center">
                        <input
                            ref={paletteInputRef}
                            type="text"
                            value={paletteInput}
                            onChange={(e) => setPaletteInput(e.target.value)}
                            onBlur={() => {
                                // optional: delay blur so submit works if clicking out
                                setTimeout(() => {
                                    setIsCommandMode(false);
                                    setIsFilterMode(false);
                                }, 100);
                            }}
                            className="bg-transparent border-none outline-none w-full font-mono text-sm placeholder:text-white/50"
                            placeholder={isCommandMode ? "Type command (e.g. pods, svc)..." : "Filter..."}
                        />
                    </form>
                ) : (
                    <>
                        <Activity className="w-4 h-4 ml-1" />
                        <div className="flex gap-4 flex-1 text-sm font-bold uppercase tracking-wider">
                            <span className="text-cyan-400">Context: <span className="text-white">{viewContext}</span></span>
                            {filterQuery && (
                                <span className="text-emerald-400 flex items-center gap-1">
                                    <Search className="w-3.5 h-3.5" /> Filter: <span className="text-white">{filterQuery}</span>
                                </span>
                            )}
                        </div>
                        <div className="flex gap-4 text-xs font-semibold text-gray-400">
                            <span title="Press ':' to switch context">
                                <kbd className="font-sans px-1.5 py-0.5 rounded-sm bg-[#27272A] border border-[#3F3F46] text-gray-300 ml-1">:</kbd> cmd
                            </span>
                            <span title="Press '/' to filter">
                                <kbd className="font-sans px-1.5 py-0.5 rounded-sm bg-[#27272A] border border-[#3F3F46] text-gray-300 ml-1">/</kbd> filter
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto bg-[#0a0a0a]" ref={tableContainerRef}>
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-[#27272A]">
                        <tr className="text-xs text-gray-400 bg-[#18181B]">
                            {renderTableHeaders()}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272A]/50">
                        {filteredData.length > 0 ? (
                            filteredData.map((item, idx) => renderTableRow(item, idx))
                        ) : (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-muted-foreground text-sm">
                                    No {viewContext} found {filterQuery && `matching '/${filterQuery}'`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Status Bar */}
            <div className="p-1.5 px-3 bg-[#0a0a0a] border-t border-[#27272A] flex justify-between items-center text-[10px] text-gray-400 font-bold shrink-0 uppercase tracking-widest">
                <span>{filteredData.length}/{data.length} Items</span>
                <span className="flex gap-4">
                    <span><span className="text-cyan-400 font-black">d</span> describe</span>
                    <span><span className="text-cyan-400 font-black">y</span> yaml</span>
                    <span><span className="text-cyan-400 font-black">l</span> logs</span>
                </span>
            </div>
        </Card>
    );
}
