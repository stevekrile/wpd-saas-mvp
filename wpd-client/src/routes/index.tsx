import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import PublicLayout from '../components/layout/PublicLayout';
import AppLayout from '../components/layout/AppLayout';
import HomePage from '../pages/public/HomePage';
import WhatIsWpdPage from '../pages/public/WhatIsWpdPage';
import PricingPage from '../pages/public/PricingPage';
import DashboardPage from '../pages/app/DashboardPage';
import CreateProcessPage from '../pages/app/CreateProcessPage';
import ProcessDetailPage from '../pages/app/ProcessDetailPage';
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

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/what-is-wpd" element={<WhatIsWpdPage />} />
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
          <Route path="/processes/create" element={<CreateProcessPage />} />
          <Route path="/processes/:id" element={<ProcessDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

