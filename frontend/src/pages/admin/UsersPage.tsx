import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { RoleBadge } from "@/components/common/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { UserFormDialog } from "@/pages/admin/UserFormDialog";
import { getErrorMessage } from "@/services/api";
import { usersService } from "@/services/users.service";
import type { User, UserRole } from "@/types";
import { ROLE_LABELS, USER_ROLES } from "@/utils/constants";
import { formatDate, initials } from "@/utils/format";
import { validatePassword } from "@/utils/validation";

const ALL = "__all__";

export default function UsersPage() {
  useDocumentTitle("Users");
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [role, setRole] = React.useState(ALL);
  const [activeFilter, setActiveFilter] = React.useState(ALL);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const users = useAsync(
    () =>
      usersService.list({
        search: debouncedSearch.trim() || undefined,
        role: role === ALL ? undefined : (role as UserRole),
        is_active: activeFilter === ALL ? undefined : activeFilter === "active",
        page,
        page_size: pageSize,
      }),
    [debouncedSearch, role, activeFilter, page, pageSize],
  );

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [deleting, setDeleting] = React.useState<User | null>(null);
  const [resetting, setResetting] = React.useState<User | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetSaving, setResetSaving] = React.useState(false);

  const toggleStatus = async (user: User) => {
    try {
      await usersService.setStatus(user.id, !user.is_active);
      toast.success(
        user.is_active ? "User deactivated" : "User activated",
        `${user.name} ${user.is_active ? "can no longer sign in." : "can sign in again."}`,
      );
      void users.reload();
    } catch (error) {
      toast.error("Could not change the account status", getErrorMessage(error));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await usersService.remove(deleting.id);
      toast.success("User deleted", `${deleting.name} has been removed.`);
      setDeleting(null);
      void users.reload();
    } catch (error) {
      toast.error("Could not delete the user", getErrorMessage(error));
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetting) return;

    const problem = validatePassword(newPassword);
    if (problem) {
      setResetError(problem);
      return;
    }

    setResetSaving(true);
    setResetError(null);
    try {
      await usersService.resetPassword(resetting.id, newPassword);
      toast.success("Password reset", `Share the new password with ${resetting.name} securely.`);
      setResetting(null);
      setNewPassword("");
    } catch (error) {
      setResetError(getErrorMessage(error, "Could not reset the password"));
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Create accounts, set roles and control who can sign in."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New user
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, username or mobile"
              aria-label="Search users"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {USER_ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activeFilter}
              onValueChange={(value) => {
                setActiveFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {users.loading && !users.data ? (
          <TableSkeleton rows={8} columns={5} />
        ) : users.error ? (
          <ErrorState message={users.error} onRetry={() => void users.reload()} />
        ) : !users.data?.items.length ? (
          <EmptyState
            icon={Users}
            title="No users match"
            description="Try a different search or filter."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Mobile</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{initials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {user.name}
                              {isSelf ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {user.mobile_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        <Badge tone={user.is_active ? "success" : "muted"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${user.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(user);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil />
                              Edit user
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setResetting(user);
                                setNewPassword("");
                                setResetError(null);
                              }}
                            >
                              <KeyRound />
                              Reset password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isSelf}
                              onSelect={() => void toggleStatus(user)}
                            >
                              {user.is_active ? <UserX /> : <UserCheck />}
                              {user.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              disabled={isSelf}
                              onSelect={() => setDeleting(user)}
                            >
                              <Trash2 />
                              Delete user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Pagination
              page={users.data.page}
              pageSize={users.data.page_size}
              total={users.data.total}
              pages={users.data.pages}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        onSaved={() => void users.reload()}
      />

      {/* Reset password */}
      <Dialog
        open={Boolean(resetting)}
        onOpenChange={(value) => (value ? undefined : setResetting(null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetting?.name}. They should change it after signing in.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="off"
                invalid={Boolean(resetError)}
              />
              {resetError ? <p className="text-xs text-destructive">{resetError}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetting(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={resetSaving}>
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.name}?`}
        description="Deactivating the account is usually safer -- deletion is permanent and is blocked while the user still owns nodes."
        confirmLabel="Delete user"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
