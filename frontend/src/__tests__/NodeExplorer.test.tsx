import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NodeExplorer } from "@/components/dashboard/NodeExplorer";
import { nodesService } from "@/services/nodes.service";
import type { HierarchyProduct, NodeSummary, Page } from "@/types";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/services/nodes.service", () => ({
  nodesService: { list: vi.fn() },
}));

const mockedList = vi.mocked(nodesService.list);

const HIERARCHY: HierarchyProduct[] = [
  {
    product_id: 1,
    product: "CMM",
    node_count: 3,
    status: { not_started: 1, in_progress: 1, completed: 1, blocked: 0 },
    total_activities: 21,
    completed_activities: 7,
    circles: [
      {
        circle_id: 10,
        circle: "PB",
        node_count: 2,
        status: { not_started: 1, in_progress: 0, completed: 1, blocked: 0 },
        total_activities: 14,
        completed_activities: 7,
      },
      {
        circle_id: 11,
        circle: "UPE",
        node_count: 1,
        status: { not_started: 0, in_progress: 1, completed: 0, blocked: 0 },
        total_activities: 7,
        completed_activities: 0,
      },
    ],
  },
  {
    product_id: 2,
    product: "NRD",
    node_count: 0,
    status: { not_started: 0, in_progress: 0, completed: 0, blocked: 0 },
    total_activities: 0,
    completed_activities: 0,
    circles: [],
  },
];

function makeNode(id: number, name: string): NodeSummary {
  return {
    id,
    node_name: name,
    product_id: 1,
    circle_id: 10,
    owner_id: null,
    lead_id: null,
    tpm_id: null,
    deployment_state: "LIVE",
    overall_status: "COMPLETED",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    product: { id: 1, product_name: "CMM", is_active: true },
    circle: { id: 10, circle_name: "PB", is_active: true },
    owner: null,
    lead: null,
    tpm: null,
    total_activities: 7,
    completed_activities: 7,
    pending_activities: 0,
    in_progress_activities: 0,
    assigned_engineers: 3,
  };
}

function pageOf(items: NodeSummary[], total = items.length): Page<NodeSummary> {
  return { items, total, page: 1, page_size: 100, pages: 1 };
}

function render(overrides: Partial<Parameters<typeof NodeExplorer>[0]> = {}) {
  return renderWithProviders(
    <NodeExplorer
      products={HIERARCHY}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      {...overrides}
    />,
    { withAuth: false },
  );
}

describe("NodeExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue(
      pageOf([makeNode(1, "PBLUDCK04NCMM05"), makeNode(2, "PBAMBCK05NCMM07")]),
    );
  });

  it("lists every product, including ones with no nodes", () => {
    render();
    expect(screen.getByText("CMM")).toBeInTheDocument();
    expect(screen.getByText("NRD")).toBeInTheDocument();
  });

  it("shows node counts and status chips for a product", () => {
    render();
    expect(screen.getByText(/3 nodes · 2 circles/)).toBeInTheDocument();
    expect(screen.getAllByText("1 Done").length).toBeGreaterThan(0);
  });

  it("auto-opens the first product that has nodes", async () => {
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());
    expect(screen.getByText("UPE")).toBeInTheDocument();
  });

  it("does not fetch nodes until a circle is opened", async () => {
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("loads that circle's nodes, filtered by product and circle", async () => {
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());

    await user.click(screen.getByText("PB"));

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ product_id: 1, circle_id: 10 }),
      ),
    );
    expect(await screen.findByText("PBLUDCK04NCMM05")).toBeInTheDocument();
    expect(screen.getByText("PBAMBCK05NCMM07")).toBeInTheDocument();
  });

  it("links each node to its detail page", async () => {
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());
    await user.click(screen.getByText("PB"));

    const link = await screen.findByRole("link", { name: /PBLUDCK04NCMM05/ });
    expect(link).toHaveAttribute("href", "/nodes/1");
  });

  it("fetches a circle's nodes only once", async () => {
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());

    await user.click(screen.getByText("PB"));
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText("PB")); // collapse
    await user.click(screen.getByText("PB")); // re-open
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("says so when a product has no nodes", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByText("NRD"));
    expect(
      await screen.findByText(/No nodes are assigned to NRD yet/),
    ).toBeInTheDocument();
  });

  it("offers a retry when loading a circle's nodes fails", async () => {
    const user = userEvent.setup();
    mockedList.mockRejectedValue(new Error("Network is down"));
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());

    await user.click(screen.getByText("PB"));
    expect(await screen.findByText("Network is down")).toBeInTheDocument();

    mockedList.mockResolvedValue(pageOf([makeNode(1, "PBLUDCK04NCMM05")]));
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("PBLUDCK04NCMM05")).toBeInTheDocument();
  });

  it("points at the full list when a circle has more nodes than one page", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(pageOf([makeNode(1, "PBLUDCK04NCMM05")], 250));
    render();
    await waitFor(() => expect(screen.getByText("PB")).toBeInTheDocument());
    await user.click(screen.getByText("PB"));

    expect(await screen.findByText(/Showing the first 1 of 250 nodes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the full list/i })).toHaveAttribute(
      "href",
      "/nodes?product_id=1&circle_id=10",
    );
  });

  it("renders a loading skeleton and an error state", () => {
    const { rerender } = render({ products: null, loading: true });
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);

    rerender(
      <NodeExplorer products={null} loading={false} error="Boom" onRetry={vi.fn()} />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("shows an empty state when there are no products at all", () => {
    render({ products: [] });
    expect(screen.getByText("No products yet")).toBeInTheDocument();
  });

  it("marks disclosure state for assistive technology", async () => {
    const user = userEvent.setup();
    render();
    const nrd = screen.getByText("NRD").closest("button")!;
    expect(nrd).toHaveAttribute("aria-expanded", "false");

    await user.click(nrd);
    expect(nrd).toHaveAttribute("aria-expanded", "true");
  });
});
