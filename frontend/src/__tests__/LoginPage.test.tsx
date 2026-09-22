import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/LoginPage";
import { authService } from "@/services/auth.service";
import { renderWithProviders, makeUser } from "@/test/utils";

vi.mock("@/services/auth.service", () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const mockedLogin = vi.mocked(authService.login);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in form", () => {
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("refuses to submit when a field is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /enter both your username and password/i,
    );
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("submits the credentials and passes remember-me through", async () => {
    const user = userEvent.setup();
    mockedLogin.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: makeUser(),
    });

    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.type(screen.getByLabelText(/username/i), "tina.tpm");
    await user.type(screen.getByLabelText(/^password$/i), "Password@123");
    await user.click(screen.getByLabelText(/remember me/i));
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith({
        username: "tina.tpm",
        password: "Password@123",
        remember_me: true,
      }),
    );
  });

  it("shows the server's message when sign-in fails", async () => {
    const user = userEvent.setup();
    mockedLogin.mockRejectedValue(new Error("Invalid username or password"));

    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.type(screen.getByLabelText(/username/i), "tina.tpm");
    await user.type(screen.getByLabelText(/^password$/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid username or password/i);
    // The password field is cleared so the next attempt starts fresh.
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("");
  });
});
