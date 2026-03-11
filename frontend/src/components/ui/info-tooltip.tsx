import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface InfoTooltipProps {
    content: React.ReactNode;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors outline-none cursor-help ml-1.5 flex items-center">
                        <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px] p-3 text-xs text-foreground leading-relaxed break-keep bg-background/95 backdrop-blur shadow-xl border border-border">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
