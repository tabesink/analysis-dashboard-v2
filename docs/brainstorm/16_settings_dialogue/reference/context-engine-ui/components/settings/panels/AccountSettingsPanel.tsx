"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usersApi } from "@/lib/api/users";
import { errorMessage as getErrorMessage } from "@/lib/utils";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";
import type { AdminUser, CreateUserPayload, UpdateUserPayload, UserRole } from "@/types/user";

interface CreateState {
  open: boolean;
  username: string;
  password: string;
  role: UserRole;
  busy: boolean;
  error: string | null;
}

interface ResetState {
  user: AdminUser | null;
  password: string;
  confirm: string;
  busy: boolean;
  error: string | null;
}

interface DeleteState {
  user: AdminUser | null;
  busy: boolean;
  error: string | null;
}

const initialCreate: CreateState = {
  open: false,
  username: "",
  password: "",
  role: "user",
  busy: false,
  error: null,
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const panelClassName = "rounded-xl border border-[var(--border)] bg-[var(--background)]";
const inputClassName = "rounded-full border-[var(--border)] bg-[var(--background)] shadow-none";
const selectTriggerClassName = "rounded-full border-[var(--border)] bg-[var(--background)] shadow-none";
const pillButtonClassName = "rounded-full shadow-none";

export function AccountSettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const currentUser = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isAdmin = useAuthStore(selectIsAdmin);

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [create, setCreate] = React.useState<CreateState>(initialCreate);
  const [reset, setReset] = React.useState<ResetState>({
    user: null,
    password: "",
    confirm: "",
    busy: false,
    error: null,
  });
  const [del, setDel] = React.useState<DeleteState>({
    user: null,
    busy: false,
    error: null,
  });

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const list = await usersApi.list();
      setUsers(list);
    } catch (error) {
      setListError(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "idle" || status === "loading") return;
    if (!isAdmin) return;
    const task = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(task);
  }, [isAdmin, loadUsers, status]);

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-4">
        <p className="text-sm font-medium text-[var(--foreground)]">Admin access required</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Sign in with an admin account to manage users.
        </p>
      </div>
    );
  }

  const onCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreate((state) => ({ ...state, busy: true, error: null }));
    const payload: CreateUserPayload = {
      username: create.username.trim(),
      password: create.password,
      role: create.role,
    };

    try {
      const newUser = await usersApi.create(payload);
      setUsers((previous) => [...previous, newUser]);
      setCreate(initialCreate);
    } catch (error) {
      setCreate((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to create user"),
      }));
    }
  };

  const onUpdate = async (user: AdminUser, payload: UpdateUserPayload) => {
    setListError(null);
    try {
      const updated = await usersApi.update(user.id, payload);
      setUsers((previous) => previous.map((item) => (item.id === user.id ? updated : item)));
    } catch (error) {
      setListError(getErrorMessage(error, "Failed to update user"));
    }
  };

  const onResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reset.user) return;
    if (reset.password.length < 8) {
      setReset((state) => ({ ...state, error: "Password must be at least 8 characters" }));
      return;
    }
    if (reset.password !== reset.confirm) {
      setReset((state) => ({ ...state, error: "Passwords do not match" }));
      return;
    }

    setReset((state) => ({ ...state, busy: true, error: null }));
    try {
      await usersApi.resetPassword(reset.user.id, { new_password: reset.password });
      setReset({ user: null, password: "", confirm: "", busy: false, error: null });
    } catch (error) {
      setReset((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to reset password"),
      }));
    }
  };

  const onDeleteConfirm = async () => {
    if (!del.user) return;
    setDel((state) => ({ ...state, busy: true, error: null }));
    try {
      await usersApi.remove(del.user.id);
      setUsers((previous) => previous.filter((item) => item.id !== del.user?.id));
      setDel({ user: null, busy: false, error: null });
    } catch (error) {
      setDel((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to delete user"),
      }));
    }
  };

  return (
    <div className={embedded ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Users</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {users.length} {users.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreate({ ...initialCreate, open: true })} className={pillButtonClassName}>
          New user
        </Button>
      </div>

      {listError ? <p className="text-sm text-destructive">{listError}</p> : null}
      <div className={panelClassName}>
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--secondary)]/45">
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[var(--muted-foreground)]">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[var(--muted-foreground)]">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{user.username}</span>
                        {isSelf ? <Badge variant="muted">You</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => onUpdate(user, { role: value as UserRole })}
                        disabled={isSelf}
                      >
                        <SelectTrigger size="sm" className={`w-28 ${selectTriggerClassName}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[var(--border)] shadow-none">
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isSelf} className={pillButtonClassName}>
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              setReset({
                                user,
                                password: "",
                                confirm: "",
                                busy: false,
                                error: null,
                              })
                            }
                          >
                            Reset password
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDel({ user, busy: false, error: null })}
                          >
                            Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={create.open} onOpenChange={(open) => setCreate((state) => (open ? state : initialCreate))}>
        <DialogContent className="rounded-xl border-[var(--border)] shadow-none">
          <DialogHeader>
            <DialogTitle className="font-medium">Create user</DialogTitle>
            <DialogDescription>Add a user account and assign a role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={create.username}
                onChange={(event) => setCreate((state) => ({ ...state, username: event.target.value }))}
                required
                minLength={3}
                maxLength={64}
                autoComplete="off"
                className={inputClassName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                value={create.password}
                onChange={(event) => setCreate((state) => ({ ...state, password: event.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClassName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-user-role">Role</Label>
              <Select value={create.role} onValueChange={(value) => setCreate((state) => ({ ...state, role: value as UserRole }))}>
                <SelectTrigger id="new-user-role" className={selectTriggerClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[var(--border)] shadow-none">
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {create.error ? <p className="text-sm text-destructive">{create.error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreate(initialCreate)} className={pillButtonClassName}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.busy} className={pillButtonClassName}>
                {create.busy ? "Creating..." : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reset.user !== null}
        onOpenChange={(open) =>
          setReset((state) => (open ? state : { user: null, password: "", confirm: "", busy: false, error: null }))
        }
      >
        <DialogContent className="rounded-xl border-[var(--border)] shadow-none">
          <DialogHeader>
            <DialogTitle className="font-medium">Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium text-foreground">{reset.user?.username ?? ""}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onResetSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                value={reset.password}
                onChange={(event) => setReset((state) => ({ ...state, password: event.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClassName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-password-confirm">Confirm new password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={reset.confirm}
                onChange={(event) => setReset((state) => ({ ...state, confirm: event.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClassName}
              />
            </div>
            {reset.error ? <p className="text-sm text-destructive">{reset.error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReset({ user: null, password: "", confirm: "", busy: false, error: null })}
                className={pillButtonClassName}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={reset.busy} className={pillButtonClassName}>
                {reset.busy ? "Saving..." : "Save password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={del.user !== null}
        onOpenChange={(open) => setDel((state) => (open ? state : { user: null, busy: false, error: null }))}
      >
        <AlertDialogContent className="rounded-xl border-[var(--border)] shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium">Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              {del.user ? `Permanently remove "${del.user.username}". This cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {del.error ? <p className="px-6 text-sm text-destructive">{del.error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.busy} className={pillButtonClassName}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onDeleteConfirm();
              }}
              disabled={del.busy}
              className={pillButtonClassName}
            >
              {del.busy ? "Deleting..." : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
