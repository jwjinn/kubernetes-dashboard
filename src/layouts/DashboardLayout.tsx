import { Link, useLocation } from 'react-router-dom';
import { useFilterStore } from '@/store/filterStore';
import { LayoutDashboard, Settings, Bell, User, Box, Activity, Cpu, BarChart3, Terminal } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { selectedCluster, setCluster } = useFilterStore();
    const location = useLocation();

    const navItems = [
        { name: 'Cluster Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Container Map', href: '/containers', icon: Box },
        { name: '장애 진단 (Diagnosis)', href: '/workloads', icon: Activity },
        { name: 'GPU Dashboard', href: '/gpu', icon: Cpu },
        { name: 'GPU Trends (통계)', href: '/gpu-trend', icon: BarChart3 },
        { name: '로그 (Logs)', href: '/logs', icon: Terminal },
    ];

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar (LNB) */}
            <aside className="w-64 bg-card border-r border-border flex flex-col z-20">
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
                        <Cpu className="w-6 h-6 text-indigo-500" /> InfraMap
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium text-sm">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header (GNB) */}
                <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground font-medium">Cluster:</span>
                        <select
                            value={selectedCluster}
                            onChange={(e) => setCluster(e.target.value)}
                            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                            <option value="all-clusters">All Clusters</option>
                            <option value="cluster-seoul">Seoul Region</option>
                            <option value="cluster-tokyo">Tokyo Region</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <button className="p-2 hover:bg-border rounded-full transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold cursor-pointer">
                            <User className="w-5 h-5" />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
