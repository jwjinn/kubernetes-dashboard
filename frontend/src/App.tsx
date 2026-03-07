import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContainerMapPage from '@/pages/ContainerMapPage';
import WorkloadPage from '@/pages/WorkloadPage';
import AnalysisPage from '@/pages/AnalysisPage';
import AcceleratorDashboardPage from '@/pages/AcceleratorDashboardPage';
import AcceleratorTrendPage from '@/pages/AcceleratorTrendPage';
import KubeConsolePage from '@/pages/KubeConsolePage';
import LogsPage from '@/pages/LogsPage';
import ClusterDashboardPage from '@/pages/ClusterDashboardPage';
import LoginPage from '@/pages/LoginPage';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/AuthContext';
import { PrivateRoute } from '@/components/PrivateRoute';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/cluster-dashboard" element={<PrivateRoute><ClusterDashboardPage /></PrivateRoute>} />
            <Route path="/containers" element={<PrivateRoute><ContainerMapPage /></PrivateRoute>} />
            <Route path="/workloads" element={<PrivateRoute><WorkloadPage /></PrivateRoute>} />
            <Route path="/accelerator" element={<PrivateRoute><AcceleratorDashboardPage /></PrivateRoute>} />
            <Route path="/accelerator-trend" element={<PrivateRoute><AcceleratorTrendPage /></PrivateRoute>} />
            <Route path="/analysis" element={<PrivateRoute><AnalysisPage /></PrivateRoute>} />
            <Route path="/console" element={<PrivateRoute><KubeConsolePage /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><LogsPage /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
        {/* Toast provider from shadcn/ui */}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
