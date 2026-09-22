import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Pagination } from "@/components/common/Pagination";
import { RoleGate } from "@/components/common/RoleGate";
import {
  ActivityStatusBadge,
  AssignmentRoleBadge,
  DeploymentStateBadge,
  NodeStatusBadge,
} from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { renderWithProviders, makeUser, seedSession } from "@/test/utils";

describe("Button", () => {
  it("shows a spinner and blocks clicks while loading", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button loading onClick={onClick}>
        Save
      </Button>,
      { withAuth: false },
    );

    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("status badges", () => {
  it("renders readable labels", () => {
    renderWithProviders(
      <>
        <DeploymentStateBadge state="IN_PROGRESS" />
        <NodeStatusBadge status="NOT_STARTED" />
        <ActivityStatusBadge status="Completed" />
        <AssignmentRoleBadge role="PRIMARY_OWNER" />
      </>,
      { withAuth: false },
    );

    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Primary Owner")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders its title, description and action", () => {
    renderWithProviders(
      <EmptyState
        title="No nodes"
        description="Create one to get started"
        action={<Button>New node</Button>}
      />,
      { withAuth: false },
    );

    expect(screen.getByText("No nodes")).toBeInTheDocument();
    expect(screen.getByText("Create one to get started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new node/i })).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("summarises the visible range", () => {
    renderWithProviders(
      <Pagination page={2} pageSize={20} total={45} pages={3} onPageChange={vi.fn()} />,
      { withAuth: false },
    );

    expect(screen.getByText("Showing 21-40 of 45")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = renderWithProviders(
      <Pagination page={1} pageSize={20} total={45} pages={3} onPageChange={vi.fn()} />,
      { withAuth: false },
    );
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled();

    rerender(
      <Pagination page={3} pageSize={20} total={45} pages={3} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("reports the page the user asked for", async () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <Pagination page={2} pageSize={20} total={45} pages={3} onPageChange={onPageChange} />,
      { withAuth: false },
    );

    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe("RoleGate", () => {
  it("renders children for an allowed role", async () => {
    seedSession(makeUser({ role: "TPM" }));
    renderWithProviders(
      <RoleGate allow={["TPM"]}>
        <p>Danger zone</p>
      </RoleGate>,
    );
    await waitFor(() => expect(screen.getByText("Danger zone")).toBeInTheDocument());
  });

  it("renders the fallback for a disallowed role", async () => {
    seedSession(makeUser({ role: "ENGINEER" }));
    renderWithProviders(
      <RoleGate allow={["TPM"]} fallback={<p>Read only</p>}>
        <p>Danger zone</p>
      </RoleGate>,
    );
    await waitFor(() => expect(screen.getByText("Read only")).toBeInTheDocument());
    expect(screen.queryByText("Danger zone")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm only when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete TN-NOK-1001?"
        description="This cannot be undone."
        confirmLabel="Delete node"
        destructive
        onConfirm={onConfirm}
      />,
      { withAuth: false },
    );

    expect(screen.getByText("Delete TN-NOK-1001?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /delete node/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});

describe("ErrorBoundary", () => {
  it("catches a render error instead of blanking the app", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Boom(): never {
      throw new Error("kaboom");
    }

    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
      { withAuth: false },
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    spy.mockRestore();
  });
});
