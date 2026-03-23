import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, User, Box, Activity, Cpu, BarChart3, Server, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { getEnv } from '@/config/env';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();
    const { logout } = useAuth();
    const acceleratorMode = getEnv('VITE_ACCELERATOR_TYPE', 'GPU');

    const baseNavItems = [
        { name: 'Cluster Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Node Dashboard', href: '/cluster-dashboard', icon: Server },
        { name: 'Container Map', href: '/containers', icon: Box },
        { name: '장애 진단 (Diagnosis)', href: '/workloads', icon: Activity },
    ];

    const acceleratorNavItems = [
        { name: `${acceleratorMode} Dashboard`, href: '/accelerator', icon: Cpu },
        { name: `${acceleratorMode} Trends (통계)`, href: '/accelerator-trend', icon: BarChart3 },
    ];

    const navItems = [
        ...baseNavItems,
        ...acceleratorNavItems,
    ];

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar (LNB) */}
            <aside className="w-64 bg-card border-r border-border flex flex-col z-20">
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <h1 className={`text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent flex items-center gap-2 ${acceleratorMode === 'NPU' ? 'from-green-500 to-emerald-700' : 'from-blue-400 to-indigo-500'}`}>
                        <Cpu className={`w-6 h-6 ${acceleratorMode === 'NPU' ? 'text-green-500' : 'text-indigo-500'}`} />
                        {acceleratorMode === 'NPU' ? 'InfraMap NPU' : 'InfraMap GPU'}
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
                    <div />
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <button className="p-2 hover:bg-border rounded-full transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
                        </button>
                        <div className="flex items-center gap-2 pl-2 border-l border-border">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-indigo-600 transition-colors">
                                <User className="w-5 h-5" />
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
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
