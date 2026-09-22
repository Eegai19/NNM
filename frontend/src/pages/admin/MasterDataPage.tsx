import { Library, Plus, Power, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { catalogService } from "@/services/catalog.service";
import type { ActivityMaster, Circle, Product } from "@/types";

type Entity = Product | Circle | ActivityMaster;

interface ListSectionProps<T extends Entity> {
  title: string;
  description: string;
  items: T[] | null;
  loading: boolean;
  error: string | null;
  nameOf: (item: T) => string;
  descriptionOf?: (item: T) => string | null;
  onCreate: (name: string, description?: string) => Promise<void>;
  onToggle: (item: T) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
  canDelete: boolean;
  withDescription?: boolean;
  placeholder: string;
  onRetry: () => void;
}

function ListSection<T extends Entity>({
  title,
  description,
  items,
  loading,
  error,
  nameOf,
  descriptionOf,
  onCreate,
  onToggle,
  onDelete,
  canDelete,
  withDescription = false,
  placeholder,
  onRetry,
}: ListSectionProps<T>) {
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<T | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), text.trim() || undefined);
      setName("");
      setText("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={placeholder}
              aria-label={`New ${title.toLowerCase()} name`}
            />
            <Button type="submit" loading={saving} className="sm:w-auto">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {withDescription ? (
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Description (optional)"
              rows={2}
              aria-label="Description"
            />
          ) : null}
        </form>

        {loading && !items ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !items?.length ? (
          <EmptyState icon={Library} title={`No ${title.toLowerCase()} yet`} />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nameOf(item)}</p>
                  {descriptionOf?.(item) ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {descriptionOf(item)}
                    </p>
                  ) : null}
                </div>
                <Badge tone={item.is_active ? "success" : "muted"}>
                  {item.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void onToggle(item)}
                  aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${nameOf(item)}`}
                  title={item.is_active ? "Deactivate" : "Activate"}
                >
                  <Power className="h-4 w-4" />
                </Button>
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(item)}
                    aria-label={`Delete ${nameOf(item)}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title={`Delete ${deleting ? nameOf(deleting) : ""}?`}
        description="Records still referenced by a node cannot be deleted -- deactivate them instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await onDelete(deleting);
          setDeleting(null);
        }}
      />
    </Card>
  );
}

export default function MasterDataPage() {
  useDocumentTitle("Master data");
  const toast = useToast();
  const { isTpm } = useAuth();

  const products = useAsync(() => catalogService.products(true), []);
  const circles = useAsync(() => catalogService.circles(true), []);
  const masters = useAsync(() => catalogService.activityMasters(true), []);

  const guard = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error("Action failed", getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master data"
        description="Products, circles and the activity catalogue that nodes are built from."
      />

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Activity catalogue</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="circles">Circles</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <ListSection
            title="Activity catalogue"
            description="Activities that can be attached to any node."
            items={masters.data}
            loading={masters.loading}
            error={masters.error}
            nameOf={(item) => item.activity_name}
            descriptionOf={(item) => item.description}
            withDescription
            placeholder="Acceptance Testing"
            canDelete={isTpm}
            onRetry={() => void masters.reload()}
            onCreate={async (name, description) => {
              await guard(async () => {
                await catalogService.createActivityMaster(name, description ?? null);
                await masters.reload();
              }, "Activity added");
            }}
            onToggle={async (item) => {
              await guard(async () => {
                await catalogService.updateActivityMaster(item.id, {
                  is_active: !item.is_active,
                });
                await masters.reload();
              }, "Activity updated");
            }}
            onDelete={async (item) => {
              await guard(async () => {
                await catalogService.deleteActivityMaster(item.id);
                await masters.reload();
              }, "Activity deleted");
            }}
          />
        </TabsContent>

        <TabsContent value="products">
          <ListSection
            title="Products"
            description="Product lines a node can belong to."
            items={products.data}
            loading={products.loading}
            error={products.error}
            nameOf={(item) => item.product_name}
            placeholder="AirScale 5G"
            canDelete={isTpm}
            onRetry={() => void products.reload()}
            onCreate={async (name) => {
              await guard(async () => {
                await catalogService.createProduct(name);
                await products.reload();
              }, "Product added");
            }}
            onToggle={async (item) => {
              await guard(async () => {
                await catalogService.updateProduct(item.id, { is_active: !item.is_active });
                await products.reload();
              }, "Product updated");
            }}
            onDelete={async (item) => {
              await guard(async () => {
                await catalogService.deleteProduct(item.id);
                await products.reload();
              }, "Product deleted");
            }}
          />
        </TabsContent>

        <TabsContent value="circles">
          <ListSection
            title="Circles"
            description="Telecom circles the deployment covers."
            items={circles.data}
            loading={circles.loading}
            error={circles.error}
            nameOf={(item) => item.circle_name}
            placeholder="TN"
            canDelete={isTpm}
            onRetry={() => void circles.reload()}
            onCreate={async (name) => {
              await guard(async () => {
                await catalogService.createCircle(name);
                await circles.reload();
              }, "Circle added");
            }}
            onToggle={async (item) => {
              await guard(async () => {
                await catalogService.updateCircle(item.id, { is_active: !item.is_active });
                await circles.reload();
              }, "Circle updated");
            }}
            onDelete={async (item) => {
              await guard(async () => {
                await catalogService.deleteCircle(item.id);
                await circles.reload();
              }, "Circle deleted");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
