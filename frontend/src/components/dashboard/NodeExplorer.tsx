import { ChevronDown, ChevronRight, Layers, Loader2, Server } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

import { ActivityProgress, StatusChips } from "@/components/dashboard/StatusChips";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { DeploymentStateBadge, NodeStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/services/api";
import { nodesService } from "@/services/nodes.service";
import type { HierarchyCircle, HierarchyProduct, NodeSummary } from "@/types";
import { cn } from "@/utils/cn";

/** How many nodes one circle loads at a time. */
const NODE_PAGE_SIZE = 100;

interface CircleKey {
  productId: number;
  circleId: number;
}

const keyOf = ({ productId, circleId }: CircleKey) => `${productId}:${circleId}`;

interface NodeBucket {
  loading: boolean;
  error: string | null;
  items: NodeSummary[];
  total: number;
}

interface Props {
  products: HierarchyProduct[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Product -> circle -> node drill-down.
 *
 * The rollup arrives with the dashboard; the node rows under a circle are
 * fetched only when that circle is opened, so the initial payload stays small
 * however many nodes exist.
 */
export function NodeExplorer({ products, loading, error, onRetry }: Props) {
  const [openProducts, setOpenProducts] = React.useState<Set<number>>(new Set());
  const [openCircles, setOpenCircles] = React.useState<Set<string>>(new Set());
  const [nodes, setNodes] = React.useState<Record<string, NodeBucket>>({});

  // Open the first product that actually has nodes, so the panel is never
  // an empty shell on first paint.
  React.useEffect(() => {
    if (!products?.length) return;
    setOpenProducts((current) => {
      if (current.size > 0) return current;
      const first = products.find((product) => product.node_count > 0);
      return first ? new Set([first.product_id]) : current;
    });
  }, [products]);

  const toggleProduct = (productId: number) => {
    setOpenProducts((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const loadNodes = React.useCallback(async (productId: number, circleId: number) => {
    const key = keyOf({ productId, circleId });
    setNodes((current) => ({
      ...current,
      [key]: { loading: true, error: null, items: current[key]?.items ?? [], total: 0 },
    }));
    try {
      const page = await nodesService.list({
        product_id: productId,
        circle_id: circleId,
        page_size: NODE_PAGE_SIZE,
        sort_by: "node_name",
        sort_dir: "asc",
      });
      setNodes((current) => ({
        ...current,
        [key]: { loading: false, error: null, items: page.items, total: page.total },
      }));
    } catch (cause) {
      setNodes((current) => ({
        ...current,
        [key]: {
          loading: false,
          error: getErrorMessage(cause, "Could not load nodes"),
          items: [],
          total: 0,
        },
      }));
    }
  }, []);

  const toggleCircle = (productId: number, circleId: number) => {
    const key = keyOf({ productId, circleId });
    setOpenCircles((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!nodes[key]) void loadNodes(productId, circleId);
      }
      return next;
    });
  };

  if (loading && !products) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (!products?.length) {
    return (
      <EmptyState
        icon={Layers}
        title="No products yet"
        description="Add a product under Master Data to start grouping nodes."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {products.map((product) => {
        const productOpen = openProducts.has(product.product_id);
        return (
          <li key={product.product_id} className="rounded-md border border-border">
            {/* Level 1 — product */}
            <button
              type="button"
              onClick={() => toggleProduct(product.product_id)}
              aria-expanded={productOpen}
              className="flex w-full flex-col gap-2 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {productOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-semibold">{product.product}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {product.node_count} node{product.node_count === 1 ? "" : "s"} ·{" "}
                  {product.circles.length} circle{product.circles.length === 1 ? "" : "s"}
                </span>
              </span>
              <StatusChips status={product.status} />
              <ActivityProgress
                completed={product.completed_activities}
                total={product.total_activities}
              />
            </button>

            {productOpen ? (
              product.circles.length === 0 ? (
                <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  No nodes are assigned to {product.product} yet.
                </p>
              ) : (
                <ul className="space-y-1 border-t border-border p-2">
                  {product.circles.map((circle) => (
                    <CircleRow
                      key={circle.circle_id}
                      productId={product.product_id}
                      circle={circle}
                      open={openCircles.has(
                        keyOf({ productId: product.product_id, circleId: circle.circle_id }),
                      )}
                      bucket={
                        nodes[keyOf({ productId: product.product_id, circleId: circle.circle_id })]
                      }
                      onToggle={() => toggleCircle(product.product_id, circle.circle_id)}
                      onRetry={() => void loadNodes(product.product_id, circle.circle_id)}
                    />
                  ))}
                </ul>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface CircleRowProps {
  productId: number;
  circle: HierarchyCircle;
  open: boolean;
  bucket: NodeBucket | undefined;
  onToggle: () => void;
  onRetry: () => void;
}

function CircleRow({ productId, circle, open, bucket, onToggle, onRetry }: CircleRowProps) {
  return (
    <li className="rounded-md bg-muted/30">
      {/* Level 2 — circle */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{circle.circle}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {circle.node_count} node{circle.node_count === 1 ? "" : "s"}
          </span>
        </span>
        <StatusChips status={circle.status} />
        <ActivityProgress
          completed={circle.completed_activities}
          total={circle.total_activities}
        />
      </button>

      {/* Level 3 — nodes, loaded on expand */}
      {open ? (
        <div className="border-t border-border px-2 pb-2 pt-1">
          {bucket?.loading ? (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading nodes…
            </p>
          ) : bucket?.error ? (
            <div className="flex flex-wrap items-center gap-2 px-2 py-3 text-sm">
              <span className="text-destructive">{bucket.error}</span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : !bucket?.items.length ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No nodes in this circle.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {bucket.items.map((node) => (
                  <li key={node.id}>
                    <Link
                      to={`/nodes/${node.id}`}
                      className={cn(
                        "flex flex-col gap-2 rounded-md px-3 py-2 transition-colors",
                        "hover:bg-accent hover:text-accent-foreground sm:flex-row sm:items-center sm:gap-4",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Server
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate font-mono text-sm">{node.node_name}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <DeploymentStateBadge state={node.deployment_state} />
                        <NodeStatusBadge status={node.overall_status} />
                      </span>
                      <ActivityProgress
                        completed={node.completed_activities}
                        total={node.total_activities}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {bucket.total > bucket.items.length ? (
                <p className="px-3 pt-2 text-xs text-muted-foreground">
                  Showing the first {bucket.items.length} of {bucket.total} nodes.{" "}
                  <Link
                    to={`/nodes?product_id=${productId}&circle_id=${circle.circle_id}`}
                    className="text-primary hover:underline"
                  >
                    Open the full list
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
