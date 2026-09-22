import * as React from "react";

import { SESSION_EXPIRED_EVENT, getErrorMessage } from "@/services/api";
import { authService, type LoginPayload } from "@/services/auth.service";
import type { AuthSession, User, UserRole } from "@/types";
import { STORAGE_KEYS } from "@/utils/constants";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  initialising: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  logout: (reason?: string) => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  isTpm: boolean;
  isAdmin: boolean;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Read the session from whichever storage the user's "remember me" chose. */
function readStored(): { token: string | null; user: User | null; expiry: number | null } {
  try {
    const remembered = window.localStorage.getItem(STORAGE_KEYS.remember) === "true";
    const store = remembered ? window.localStorage : window.sessionStorage;
    const token = store.getItem(STORAGE_KEYS.token);
    const rawUser = store.getItem(STORAGE_KEYS.user);
    const rawExpiry = store.getItem(STORAGE_KEYS.expiry);
    return {
      token,
      user: rawUser ? (JSON.parse(rawUser) as User) : null,
      expiry: rawExpiry ? Number(rawExpiry) : null,
    };
  } catch {
    return { token: null, user: null, expiry: null };
  }
}

function clearStored(): void {
  try {
    [window.localStorage, window.sessionStorage].forEach((store) => {
      store.removeItem(STORAGE_KEYS.token);
      store.removeItem(STORAGE_KEYS.user);
      store.removeItem(STORAGE_KEYS.expiry);
    });
    window.localStorage.removeItem(STORAGE_KEYS.remember);
  } catch {
    /* nothing to clear */
  }
}

function persist(session: AuthSession, remember: boolean): number {
  const expiresAt = Date.now() + session.expires_in * 1000;
  try {
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(STORAGE_KEYS.token, session.access_token);
    store.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
    store.setItem(STORAGE_KEYS.expiry, String(expiresAt));
    window.localStorage.setItem(STORAGE_KEYS.remember, String(remember));
    if (remember) window.localStorage.setItem(STORAGE_KEYS.lastUsername, session.user.username);
  } catch {
    /* session still works in memory for this tab */
  }
  return expiresAt;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = React.useRef(readStored());
  const [user, setUser] = React.useState<User | null>(stored.current.user);
  const [token, setToken] = React.useState<string | null>(stored.current.token);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(stored.current.expiry);
  const [initialising, setInitialising] = React.useState(Boolean(stored.current.token));
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null);

  const logout = React.useCallback((reason?: string) => {
    clearStored();
    setUser(null);
    setToken(null);
    setExpiresAt(null);
    if (reason) setSessionMessage(reason);
  }, []);

  // Validate a restored token once on start-up.
  React.useEffect(() => {
    let cancelled = false;
    if (!stored.current.token) {
      setInitialising(false);
      return;
    }

    void (async () => {
      try {
        const current = await authService.me();
        if (!cancelled) setUser(current);
      } catch (error) {
        if (!cancelled) {
          logout(getErrorMessage(error, "Your session has ended. Please sign in again."));
        }
      } finally {
        if (!cancelled) setInitialising(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from the API means the token is no longer usable.
  React.useEffect(() => {
    const handler = () => {
      if (token) logout("Your session has expired. Please sign in again.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, [token, logout]);

  // Auto-logout the moment the JWT reaches its expiry, without waiting for a
  // failed request to reveal it.
  React.useEffect(() => {
    if (!expiresAt || !token) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      logout("Your session has expired. Please sign in again.");
      return;
    }
    const timer = setTimeout(
      () => logout("Your session has expired. Please sign in again."),
      Math.min(remaining, 2_147_483_000),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, token, logout]);

  // Keep multiple tabs in sync: signing out in one signs out the others.
  React.useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.token && event.newValue === null) {
        logout();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [logout]);

  const login = React.useCallback(async (payload: LoginPayload) => {
    const session = await authService.login(payload);
    const expiry = persist(session, Boolean(payload.remember_me));
    setToken(session.access_token);
    setUser(session.user);
    setExpiresAt(expiry);
    setSessionMessage(null);
    return session.user;
  }, []);

  const refreshUser = React.useCallback(async () => {
    const current = await authService.me();
    setUser(current);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initialising,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      refreshUser,
      hasRole: (...roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
      isTpm: user?.role === "TPM",
      isAdmin: user?.role === "TPM" || user?.role === "LEAD",
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
    }),
    [user, token, initialising, login, logout, refreshUser, sessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
