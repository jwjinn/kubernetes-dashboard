import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContainerMapPage from '@/pages/ContainerMapPage';
import WorkloadPage from '@/pages/WorkloadPage';
import AnalysisPage from '@/pages/AnalysisPage';
import GpuDashboardPage from '@/pages/GpuDashboardPage';
import GpuTrendPage from '@/pages/GpuTrendPage';
import NpuDashboardPage from '@/pages/NpuDashboardPage';
import NpuTrendPage from '@/pages/NpuTrendPage';
import LogsPage from '@/pages/LogsPage';
import { Toaster } from '@/components/ui/toaster';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/containers" element={<ContainerMapPage />} />
          <Route path="/workloads" element={<WorkloadPage />} />
          <Route path="/gpu" element={<GpuDashboardPage />} />
          <Route path="/gpu-trend" element={<GpuTrendPage />} />
          <Route path="/npu" element={<NpuDashboardPage />} />
          <Route path="/npu-trend" element={<NpuTrendPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </BrowserRouter>
      {/* Toast provider from shadcn/ui */}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
