import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import PublicLayout from '../components/layout/PublicLayout';
import AppLayout from '../components/layout/AppLayout';
import HomePage from '../pages/public/HomePage';
import WhatIsWpdPage from '../pages/public/WhatIsWpdPage';
import PricingPage from '../pages/public/PricingPage';
import AboutPage from '../pages/public/AboutPage';
import DashboardPage from '../pages/app/DashboardPage';
import CreateProcessPage from '../pages/app/CreateProcessPage';
import ProcessDetailPage from '../pages/app/ProcessDetailPage';
import DiagnosticWizardPage from '../pages/app/DiagnosticWizardPage';
import AdminConsolePage from '../pages/app/AdminConsolePage';
import { useWpdAuth } from '../features/auth/AuthContext';
import type { ReactNode } from 'react';

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
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/what-is-wpd" element={<WhatIsWpdPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
