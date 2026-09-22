import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { nodesService, type NodePayload } from "@/services/nodes.service";
import type { Circle, DeploymentState, NodeRecord, NodeStatus, Product, UserBrief } from "@/types";
import { DEPLOYMENT_STATES, NODE_STATUSES } from "@/utils/constants";
import { humanize } from "@/utils/format";

const UNASSIGNED = "__none__";

interface NodeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; omitted when creating. */
  node?: NodeRecord | null;
  products: Product[];
  circles: Circle[];
  people: UserBrief[];
  onSaved: () => void;
}

interface FormState {
  node_name: string;
  product_id: string;
  circle_id: string;
  owner_id: string;
  lead_id: string;
  tpm_id: string;
  deployment_state: DeploymentState;
  overall_status: NodeStatus;
}

function initialState(node: NodeRecord | null | undefined): FormState {
  return {
    node_name: node?.node_name ?? "",
    product_id: node ? String(node.product_id) : "",
    circle_id: node ? String(node.circle_id) : "",
    owner_id: node?.owner_id ? String(node.owner_id) : UNASSIGNED,
    lead_id: node?.lead_id ? String(node.lead_id) : UNASSIGNED,
    tpm_id: node?.tpm_id ? String(node.tpm_id) : UNASSIGNED,
    deployment_state: node?.deployment_state ?? "PLANNED",
    overall_status: node?.overall_status ?? "NOT_STARTED",
  };
}

export function NodeFormDialog({
  open,
  onOpenChange,
  node,
  products,
  circles,
  people,
  onSaved,
}: NodeFormDialogProps) {
  const toast = useToast();
  const editing = Boolean(node);

  const [form, setForm] = React.useState<FormState>(() => initialState(node));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Reset the form whenever the dialog opens for a different node.
  React.useEffect(() => {
    if (open) {
      setForm(initialState(node));
      setErrors({});
      setFormError(null);
    }
  }, [open, node]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.node_name.trim()) next.node_name = "Node name is required";
    else if (form.node_name.trim().length < 2) next.node_name = "Use at least 2 characters";
    if (!form.product_id) next.product_id = "Select a product";
    if (!form.circle_id) next.circle_id = "Select a circle";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const toId = (value: string) => (value === UNASSIGNED || !value ? null : Number(value));
    const payload: NodePayload = {
      node_name: form.node_name.trim(),
      product_id: Number(form.product_id),
      circle_id: Number(form.circle_id),
      owner_id: toId(form.owner_id),
      lead_id: toId(form.lead_id),
      tpm_id: toId(form.tpm_id),
      deployment_state: form.deployment_state,
      overall_status: form.overall_status,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing && node) {
        await nodesService.update(node.id, payload);
        toast.success("Node updated", `${payload.node_name} has been saved.`);
      } else {
        await nodesService.create(payload);
        toast.success("Node created", `${payload.node_name} is now being tracked.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Could not save the node"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (saving ? undefined : onOpenChange(value))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit node" : "Create node"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this node's details. Changes are recorded in the audit trail."
              : "Register a new node and place it in the right circle and product line."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="node-name">
              Node name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="node-name"
              value={form.node_name}
              onChange={(event) => update("node_name", event.target.value)}
              placeholder="TN-NOK-1001"
              invalid={Boolean(errors.node_name)}
            />
            {errors.node_name ? (
              <p className="text-xs text-destructive">{errors.node_name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Node names are unique across the whole portal.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="node-product">
                Product <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.product_id}
                onValueChange={(value) => update("product_id", value)}
              >
                <SelectTrigger id="node-product" aria-invalid={Boolean(errors.product_id)}>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product_id ? (
                <p className="text-xs text-destructive">{errors.product_id}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="node-circle">
                Circle <span className="text-destructive">*</span>
              </Label>
              <Select value={form.circle_id} onValueChange={(value) => update("circle_id", value)}>
                <SelectTrigger id="node-circle" aria-invalid={Boolean(errors.circle_id)}>
                  <SelectValue placeholder="Select a circle" />
                </SelectTrigger>
                <SelectContent>
                  {circles.map((circle) => (
                    <SelectItem key={circle.id} value={String(circle.id)}>
                      {circle.circle_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.circle_id ? (
                <p className="text-xs text-destructive">{errors.circle_id}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["owner_id", "Owner", "node-owner"],
                ["lead_id", "Lead", "node-lead"],
                ["tpm_id", "TPM", "node-tpm"],
              ] as const
            ).map(([key, label, id]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Select value={form[key]} onValueChange={(value) => update(key, value)}>
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="node-state">Deployment state</Label>
              <Select
                value={form.deployment_state}
                onValueChange={(value) => update("deployment_state", value as DeploymentState)}
              >
                <SelectTrigger id="node-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPLOYMENT_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {humanize(state)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="node-status">Overall status</Label>
              <Select
                value={form.overall_status}
                onValueChange={(value) => update("overall_status", value as NodeStatus)}
              >
                <SelectTrigger id="node-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {humanize(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recalculated from the node's activities unless set to Blocked.
              </p>
            </div>
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create node"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
