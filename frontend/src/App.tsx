import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './features/auth/AuthPage';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { DashboardSkeleton } from './components/layout/DashboardSkeleton';
import { Footer } from './components/layout/Footer';

// Lazy load feature dashboard pages on-demand for fast initial page load
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const FacultyDashboardPage = lazy(() => import('./features/faculty/FacultyDashboardPage').then(m => ({ default: m.FacultyDashboardPage })));
const AdminDashboardPage = lazy(() => import('./features/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const HodDashboardPage = lazy(() => import('./features/hod/HodDashboardPage').then(m => ({ default: m.HodDashboardPage })));
const CodingAnalyticsPage = lazy(() => import('./features/coding/CodingAnalyticsPage').then(m => ({ default: m.CodingAnalyticsPage })));
const PlatformStatsRedirect = lazy(() => import('./features/coding/PlatformStatsRedirect').then(m => ({ default: m.PlatformStatsRedirect })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

/**
 * CacheClearer — watches user identity and clears ALL React Query cache
 * whenever the logged-in user changes (login, logout, or role switch).
 * This prevents data from one role (HOD / Admin / Student) leaking into
 * another role's view after a session change.
 */
const CacheClearer: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentId = user?.id;
    if (prevUserIdRef.current !== currentId) {
      // User changed — nuke stale cache immediately
      qc.clear();
      prevUserIdRef.current = currentId;
    }
  }, [user?.id, qc]);

  return null;
};

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
      <div className="flex-1 flex flex-col lg:pl-[260px] min-w-0 min-h-screen">
        <TopBar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Clears React Query cache on every user/role change — prevents HOD data leaking into student view */}
        <CacheClearer />
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
