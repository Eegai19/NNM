import * as React from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";

interface RoleGateProps {
  allow: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Render children only for the listed roles -- used to hide write controls. */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
