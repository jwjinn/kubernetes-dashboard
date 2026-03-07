import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@tremor/react';
import { Play, Terminal as TerminalIcon, XCircle, FileCode, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast"

interface TerminalPanelProps {
    prefilledCommand: string;
}

export function TerminalPanel({ prefilledCommand }: TerminalPanelProps) {
    const [commandInput, setCommandInput] = useState('');
    const { toast } = useToast();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-detect YAML content
    const isYamlInput = commandInput.trim().startsWith('apiVersion:') || commandInput.trim().includes('kind:');

    useEffect(() => {
        if (prefilledCommand) {
            setCommandInput(prefilledCommand);
            inputRef.current?.focus();
        }
    }, [prefilledCommand]);

    const handleExecute = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = commandInput.trim();
        if (!trimmed) return;

        const type = (trimmed.startsWith('apiVersion:') || trimmed.includes('kind:')) ? 'yaml' : 'command';

        setCommandInput('');

        toast({
            title: type === 'yaml' ? "YAML Applied" : "Command Executed",
            description: type === 'yaml' ? "The resource has been applied to the cluster." : `Executed: ${trimmed.substring(0, 40)}...`,
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Input Area */}
            <Card className={`flex-1 p-0 border-border/60 bg-background/50 backdrop-blur shadow-sm flex flex-col overflow-hidden min-h-0 transition-all ${isYamlInput ? 'ring-1 ring-emerald-500/30' : ''}`}>
                <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        {isYamlInput ? (
                            <FileCode className="w-4 h-4 text-emerald-500" />
                        ) : (
                            <TerminalIcon className="w-4 h-4 text-blue-500" />
                        )}
                        <h3 className="text-sm font-bold">
                            {isYamlInput ? 'Apply YAML Resource' : 'Terminal Action'}
                        </h3>
                        {isYamlInput && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter ml-1">
                                YAML Mode
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground mr-2" onClick={() => setCommandInput('')}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                        <Button
                            size="sm"
                            className={`h-8 px-4 flex items-center gap-2 transition-colors ${isYamlInput ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold' : ''}`}
                            onClick={handleExecute}
                        >
                            {isYamlInput ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            {isYamlInput ? 'Apply YAML' : 'Execute'}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 relative p-1 bg-[#0a0a0a]">
                    {!isYamlInput && (
                        <div className="absolute left-3 top-4 text-emerald-500 font-mono text-sm leading-none flex items-center gap-1 opacity-80 pointer-events-none">
                            <span>$</span>
                        </div>
                    )}
                    <textarea
                        ref={inputRef}
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder="Paste YAML here or type kubectl commands..."
                        className={`w-full h-full pr-4 pt-3.5 bg-transparent border-none text-sm font-mono text-[#d4d4d4] resize-none focus:outline-none focus:ring-0 leading-relaxed scrollbar-hide overflow-y-auto ${isYamlInput ? 'pl-4' : 'pl-8'}`}
                        spellCheck={false}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleExecute();
                            }
                        }}
                    />
                    <div className="absolute bottom-2 right-4 text-[10px] text-gray-600 font-mono italic pointer-events-none bg-black/40 px-2 py-1 rounded">
                        {isYamlInput ? 'Ctrl+Enter to Apply' : 'Ctrl+Enter to execute'}
                    </div>
                </div>
            </Card>
        </div>
    );
}
