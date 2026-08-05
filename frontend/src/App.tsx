import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './features/auth/AuthPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { FacultyDashboardPage } from './features/faculty/FacultyDashboardPage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { HodDashboardPage } from './features/hod/HodDashboardPage';
import { CodingAnalyticsPage } from './features/coding/CodingAnalyticsPage';
import { PlatformStatsRedirect } from './features/coding/PlatformStatsRedirect';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const RoleDashboardRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (role === 'faculty') {
    return <Navigate to="/faculty/dashboard" replace />;
  }
  if (role === 'hod') {
    return <Navigate to="/hod/dashboard" replace />;
  }
  return <DashboardPage />;
};

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-textSecondary font-medium">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col lg:pl-[260px] min-w-0">
        <TopBar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<RoleDashboardRedirect />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/coding-profiles/:platform" element={<PlatformStatsRedirect />} />
              <Route path="/program-stats/:platform" element={<PlatformStatsRedirect />} />
              <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/hod/dashboard" element={<HodDashboardPage />} />
              <Route path="/coding-analytics" element={<CodingAnalyticsPage />} />
              <Route path="*" element={<RoleDashboardRedirect />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
