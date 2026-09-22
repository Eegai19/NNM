import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ChangePasswordDialog } from "@/layouts/ChangePasswordDialog";
import { Sidebar } from "@/layouts/Sidebar";
import { Topbar } from "@/layouts/Topbar";

/** Shell shared by every authenticated page. */
export function AppLayout() {
  const [navOpen, setNavOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-full min-h-screen bg-background">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setNavOpen(true)}
          onChangePassword={() => setPasswordOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
