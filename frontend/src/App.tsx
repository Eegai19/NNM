import { Loader2 } from "lucide-react";
import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/hooks/useToast";
import { AppLayout } from "@/layouts/AppLayout";
// Imported eagerly: both are tiny and must render even if a lazy chunk fails.
import { ForbiddenPage, NotFoundPage } from "@/pages/ErrorPages";

// Route-level code splitting keeps the initial bundle small.
const LoginPage = React.lazy(() => import("@/pages/LoginPage"));
const DashboardPage = React.lazy(() => import("@/pages/DashboardPage"));
const NodesPage = React.lazy(() => import("@/pages/nodes/NodesPage"));
const NodeDetailsPage = React.lazy(() => import("@/pages/nodes/NodeDetailsPage"));
const ActivitiesPage = React.lazy(() => import("@/pages/activities/ActivitiesPage"));
const AssignmentsPage = React.lazy(() => import("@/pages/AssignmentsPage"));
const ReportsPage = React.lazy(() => import("@/pages/ReportsPage"));
const UsersPage = React.lazy(() => import("@/pages/admin/UsersPage"));
const MasterDataPage = React.lazy(() => import("@/pages/admin/MasterDataPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading page" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <React.Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Everything below requires a valid session. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/nodes/:nodeId" element={<NodeDetailsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            {/* TPM and LEAD only */}
            <Route element={<ProtectedRoute roles={["TPM", "LEAD"]} />}>
              <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/master-data" element={<MasterDataPage />} />
            </Route>

            {/* TPM only */}
            <Route element={<ProtectedRoute roles={["TPM"]} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>

            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider delayDuration={300}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
