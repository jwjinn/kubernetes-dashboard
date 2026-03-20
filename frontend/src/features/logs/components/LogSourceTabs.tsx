import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogViewer } from '@/features/logs/components/LogViewer';

interface LogSourceTabsProps {
    namespace: string;
    podName: string;
    height?: string;
}

export function LogSourceTabs({ namespace, podName, height = "h-full" }: LogSourceTabsProps) {
    return (
        <Tabs defaultValue="pod" className="h-full flex flex-col">
            <TabsList className="mb-3 grid w-full max-w-[320px] grid-cols-2">
                <TabsTrigger value="pod">Pod Logs</TabsTrigger>
                <TabsTrigger value="victoria">VictoriaLogs</TabsTrigger>
            </TabsList>

            <TabsContent value="pod" className="mt-0 h-full">
                <LogViewer namespace={namespace} podName={podName} logSource="pod" height={height} />
            </TabsContent>

            <TabsContent value="victoria" className="mt-0 h-full">
                <LogViewer namespace={namespace} podName={podName} logSource="victoria" height={height} />
            </TabsContent>
        </Tabs>
    );
}
