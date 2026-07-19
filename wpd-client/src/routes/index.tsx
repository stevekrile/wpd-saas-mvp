import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Suspense, lazy, type ReactNode } from 'react';
import PublicLayout from '../components/layout/PublicLayout';
import AppLayout from '../components/layout/AppLayout';
import { useWpdAuth } from '../features/auth/AuthContext';

const HomePage = lazy(() => import('../pages/public/HomePage'));
const WhatIsWpdPage = lazy(() => import('../pages/public/WhatIsWpdPage'));
const PricingPage = lazy(() => import('../pages/public/PricingPage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const DashboardPage = lazy(() => import('../pages/app/DashboardPage'));
const CreateProcessPage = lazy(() => import('../pages/app/CreateProcessPage'));
const ProcessDetailPage = lazy(() => import('../pages/app/ProcessDetailPage'));
const DiagnosticWizardPage = lazy(() => import('../pages/app/DiagnosticWizardPage'));
const AdminConsolePage = lazy(() => import('../pages/app/AdminConsolePage'));
const AgencyProfilePage = lazy(() => import('../pages/app/AgencyProfilePage'));
const SettingsAiAccountsPage = lazy(() => import('../pages/app/SettingsAiAccountsPage'));
const RogueBrickPage = lazy(() => import('../pages/app/RogueBrickPage'));

function RouteLoadingFallback() {
  return <div className="loading">Loading...</div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="loading">Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { wpdUser, isLoading } = useWpdAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (wpdUser?.role !== 'Admin' && wpdUser?.role !== 'SystemAdmin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/what-is-wpd" element={<WhatIsWpdPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/vault/rogue-brick" element={<RogueBrickPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/agency" element={<AgencyProfilePage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminConsolePage />
                </AdminRoute>
              }
            />
            <Route path="/processes/create" element={<CreateProcessPage />} />
            <Route path="/processes/:id" element={<ProcessDetailPage />} />
            <Route path="/processes/:id/diagnostic" element={<DiagnosticWizardPage />} />
            <Route path="/settings/ai-accounts" element={<SettingsAiAccountsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
