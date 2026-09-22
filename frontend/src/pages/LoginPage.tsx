import { AlertCircle, Eye, EyeOff, Lock, User as UserIcon } from "lucide-react";
import * as React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getErrorMessage } from "@/services/api";
import { STORAGE_KEYS } from "@/utils/constants";

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  useDocumentTitle("Sign in");

  const { login, isAuthenticated, initialising, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = React.useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.lastUsername) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.remember) === "true";
    } catch {
      return false;
    }
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const target = (location.state as LocationState | null)?.from?.pathname ?? "/dashboard";

  if (!initialising && isAuthenticated) {
    return <Navigate to={target} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter both your username and password");
      return;
    }

    setSubmitting(true);
    setError(null);
    clearSessionMessage();
    try {
      await login({ username: username.trim(), password, remember_me: remember });
      navigate(target, { replace: true });
    } catch (cause) {
      setError(getErrorMessage(cause, "Sign in failed"));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-bold">
            N
          </span>
          <div>
            <p className="text-lg font-semibold tracking-wide">NNM</p>
            <p className="text-sm text-sidebar-foreground/60">Nokia Node Manager</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight">
            Every node, every activity, one operations portal.
          </h2>
          <p className="mt-4 text-sidebar-foreground/70">
            Track deployment progress across circles, assign engineers, capture evidence against
            each activity and export the reports your programme reviews need.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground/70">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/50" />
              Role-based access for TPMs, Leads and Engineers
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/50" />
              Evidence-backed activity completion
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/50" />
              Full audit trail of every change
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/40">
          Authorised users only. Activity on this portal is recorded.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              N
            </span>
            <div>
              <p className="text-lg font-semibold">NNM</p>
              <p className="text-sm text-muted-foreground">Nokia Node Manager</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the credentials issued by your TPM.
          </p>

          {sessionMessage ? (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{sessionMessage}</span>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <UserIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="your.username"
                  autoComplete="username"
                  autoFocus
                  className="pl-9"
                  invalid={Boolean(error)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="px-9"
                  invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Switch
                id="remember"
                checked={remember}
                onCheckedChange={setRemember}
                aria-label="Remember me on this device"
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                Remember me on this device
              </Label>
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Forgot your password? Ask your TPM to reset it from the Users page.
          </p>
        </div>
      </div>
    </div>
  );
}
