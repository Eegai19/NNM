import { Eye, EyeOff } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { usersService } from "@/services/users.service";
import type { User, UserRole } from "@/types";
import { ROLE_LABELS, USER_ROLES } from "@/utils/constants";
import {
  validateMobile,
  validatePassword,
  validateUsername,
} from "@/utils/validation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSaved: () => void;
}

interface FormState {
  name: string;
  username: string;
  password: string;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
}

function initialState(user: User | null | undefined): FormState {
  return {
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
    mobile_number: user?.mobile_number ?? "",
    role: user?.role ?? "ENGINEER",
    is_active: user?.is_active ?? true,
  };
}

export function UserFormDialog({ open, onOpenChange, user, onSaved }: Props) {
  const toast = useToast();
  const editing = Boolean(user);

  const [form, setForm] = React.useState<FormState>(() => initialState(user));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [reveal, setReveal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(initialState(user));
      setErrors({});
      setFormError(null);
      setReveal(false);
    }
  }, [open, user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Full name is required";
    else if (form.name.trim().length < 2) next.name = "Use at least 2 characters";

    if (!editing) {
      next.username = validateUsername(form.username);
      next.password = validatePassword(form.password);
    }
    next.mobile_number = validateMobile(form.mobile_number);

    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, message]) => Boolean(message)),
    ) as Partial<Record<keyof FormState, string>>;
    setErrors(cleaned);
    return Object.keys(cleaned).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setFormError(null);
    try {
      if (editing && user) {
        await usersService.update(user.id, {
          name: form.name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          role: form.role,
          is_active: form.is_active,
        });
        toast.success("User updated", `${form.name} has been saved.`);
      } else {
        await usersService.create({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          mobile_number: form.mobile_number.trim() || null,
          role: form.role,
          is_active: form.is_active,
        });
        toast.success("User created", `${form.name} can now sign in.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Could not save the user"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (saving ? undefined : onOpenChange(value))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Usernames cannot be changed. Use Reset password to issue new credentials."
              : "New users sign in with the username and password you set here."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="user-name">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Priya Raman"
              invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-username">
                Username {editing ? null : <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="user-username"
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                placeholder="priya.raman"
                disabled={editing}
                invalid={Boolean(errors.username)}
                autoComplete="off"
              />
              {errors.username ? (
                <p className="text-xs text-destructive">{errors.username}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-mobile">Mobile number</Label>
              <Input
                id="user-mobile"
                value={form.mobile_number}
                onChange={(event) => update("mobile_number", event.target.value)}
                placeholder="9840012345"
                invalid={Boolean(errors.mobile_number)}
              />
              {errors.mobile_number ? (
                <p className="text-xs text-destructive">{errors.mobile_number}</p>
              ) : null}
            </div>
          </div>

          {!editing ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">
                Initial password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={reveal ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="At least 8 characters"
                  className="pr-10"
                  invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setReveal((value) => !value)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Share this securely and ask the user to change it after signing in.
                </p>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => update("role", value as UserRole)}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2.5">
                <Switch
                  id="user-active"
                  checked={form.is_active}
                  onCheckedChange={(value) => update("is_active", value)}
                />
                <Label htmlFor="user-active" className="cursor-pointer font-normal">
                  Account active
                </Label>
              </div>
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
              {editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
