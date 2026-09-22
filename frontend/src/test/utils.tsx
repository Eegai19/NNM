import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type * as React from "react";
import { MemoryRouter } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/hooks/useToast";
import type { User, UserRole } from "@/types";
import { STORAGE_KEYS } from "@/utils/constants";

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: "Tina TPM",
    username: "tina.tpm",
    mobile_number: "9000000000",
    role: "TPM" as UserRole,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Put a session into storage so components render as an authenticated user. */
export function seedSession(user: User = makeUser(), token = "test-token"): void {
  window.localStorage.setItem(STORAGE_KEYS.remember, "true");
  window.localStorage.setItem(STORAGE_KEYS.token, token);
  window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  window.localStorage.setItem(
    STORAGE_KEYS.expiry,
    String(Date.now() + 60 * 60 * 1000),
  );
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  withAuth?: boolean;
}

/** Render a component inside the providers the app supplies at runtime. */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", withAuth = true, ...options }: Options = {},
): RenderResult {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = (
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider>
            <MemoryRouter
              initialEntries={[route]}
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
              {children}
            </MemoryRouter>
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    );
    return withAuth ? <AuthProvider>{content}</AuthProvider> : content;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
