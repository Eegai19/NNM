import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  /** When given, only these roles may enter the route. */
  roles?: UserRole[];
  redirectTo?: string;
}

/** Route guard: requires a session, and optionally one of several roles. */
export function ProtectedRoute({ roles, redirectTo = "/login" }: ProtectedRouteProps) {
  const { isAuthenticated, initialising, user } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where the user was heading so login can send them back.
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
