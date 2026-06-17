'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';

import { APIError } from '@/lib/api/client';
import { usersApi } from '@/lib/api/users';
import { selectIsAdmin, useAuthStore } from '@/stores/auth-store';
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  UserRole,
} from '@/types/user';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DialogCardFooter,
  DialogContentCard,
} from '@/components/shared/dialog-layout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const nestedDialogClassName = 'z-[60]';
const nestedDialogOverlayClassName = 'bg-transparent backdrop-blur-none';

interface CreateState {
  open: boolean;
  username: string;
  password: string;
  role: UserRole;
  can_write: boolean;
  busy: boolean;
  error: string | null;
}

const initialCreate: CreateState = {
  open: false,
  username: '',
  password: '',
  role: 'user',
  can_write: false,
  busy: false,
  error: null,
};

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

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof APIError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === 'string') return body.detail;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function UserManagementSettingsPanel() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore(selectIsAdmin);

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = React.useState<number | null>(null);

  const [create, setCreate] = React.useState<CreateState>(initialCreate);
  const [reset, setReset] = React.useState<ResetState>({
    user: null,
    password: '',
    confirm: '',
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
    } catch (err) {
      setListError(getErrorMessage(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
    setLastVisitAt(Date.now());
    void usersApi.markVisited().catch(() => undefined);
  }, [isAdmin, loadUsers]);

  if (!isAdmin) {
    return (
      <DialogContentCard className="min-h-0 flex-1" bodyClassName="flex min-h-0 flex-1 flex-col">
        <div className="text-sm text-muted-foreground">Admin access required.</div>
      </DialogContentCard>
    );
  }

  const onCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreate((s) => ({ ...s, busy: true, error: null }));
    const payload: CreateUserPayload = {
      username: create.username.trim(),
      password: create.password,
      role: create.role,
      can_write: create.role === 'admin' ? true : create.can_write,
    };
    try {
      const newUser = await usersApi.create(payload);
      setUsers((prev) => [...prev, newUser]);
      setCreate(initialCreate);
    } catch (err) {
      setCreate((s) => ({
        ...s,
        busy: false,
        error: getErrorMessage(err, 'Failed to create user'),
      }));
    }
  };

  const onUpdate = async (user: AdminUser, payload: UpdateUserPayload) => {
    try {
      const updated = await usersApi.update(user.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setListError(getErrorMessage(err, 'Failed to update user'));
    }
  };

  const onResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reset.user) return;
    if (reset.password.length < 8) {
      setReset((s) => ({ ...s, error: 'Password must be at least 8 characters' }));
      return;
    }
    if (reset.password !== reset.confirm) {
      setReset((s) => ({ ...s, error: 'Passwords do not match' }));
      return;
    }
    setReset((s) => ({ ...s, busy: true, error: null }));
    try {
      await usersApi.resetPassword(reset.user.id, { new_password: reset.password });
      setUsers((prev) =>
        prev.map((u) => (u.id === reset.user?.id ? { ...u, has_password: true } : u)),
      );
      setReset({ user: null, password: '', confirm: '', busy: false, error: null });
    } catch (err) {
      setReset((s) => ({
        ...s,
        busy: false,
        error: getErrorMessage(err, 'Failed to reset password'),
      }));
    }
  };

  const onDeleteConfirm = async () => {
    if (!del.user) return;
    setDel((s) => ({ ...s, busy: true, error: null }));
    try {
      await usersApi.remove(del.user.id);
      setUsers((prev) => prev.filter((u) => u.id !== del.user?.id));
      setDel({ user: null, busy: false, error: null });
    } catch (err) {
      setDel((s) => ({
        ...s,
        busy: false,
        error: getErrorMessage(err, 'Failed to delete user'),
      }));
    }
  };

  const isNewUser = (user: AdminUser): boolean => {
    if (!user.created_at || !lastVisitAt) return false;
    const created = new Date(user.created_at).getTime();
    return Number.isFinite(created) && created > lastVisitAt - 60_000;
  };

  return (
    <>
      <DialogContentCard
        className="min-h-0 flex-1"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        footer={
          <DialogCardFooter>
            <Button onClick={() => setCreate({ ...initialCreate, open: true })}>
              New user
            </Button>
          </DialogCardFooter>
        }
      >
        {listError ? (
          <p className="mb-3 text-sm text-destructive">{listError}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Username</TableHead>
                  <TableHead className="text-xs">Password</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Write access</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="w-12 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Loading users…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    const showNew = !isSelf && isNewUser(user);
                    const writeForced = user.role === 'admin';
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{user.username}</span>
                            {isSelf ? (
                              <Badge variant="muted">You</Badge>
                            ) : null}
                            {showNew ? <Badge variant="muted">New</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground">
                              ••••••••
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.has_password ? 'Set' : 'Not set'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setReset({
                                  user,
                                  password: '',
                                  confirm: '',
                                  busy: false,
                                  error: null,
                                })
                              }
                            >
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              onUpdate(user, { role: value as UserRole })
                            }
                            disabled={isSelf}
                          >
                            <SelectTrigger size="sm" className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={writeForced ? true : user.can_write}
                              onCheckedChange={(checked) =>
                                onUpdate(user, { can_write: checked })
                              }
                              disabled={isSelf || writeForced}
                              aria-label={`Toggle write access for ${user.username}`}
                            />
                            {writeForced ? (
                              <span className="text-xs text-muted-foreground">
                                Always on
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isSelf}>
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() =>
                                  setDel({ user, busy: false, error: null })
                                }
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
      </DialogContentCard>

      <Dialog
        open={create.open}
        onOpenChange={(open) =>
          setCreate((s) => (open ? s : initialCreate))
        }
      >
        <DialogContent
          className={nestedDialogClassName}
          overlayClassName={nestedDialogOverlayClassName}
        >
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Set a starting password and choose role and write access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={create.username}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, username: e.target.value }))
                }
                required
                minLength={3}
                maxLength={64}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                value={create.password}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, password: e.target.value }))
                }
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-user-role">Role</Label>
              <Select
                value={create.role}
                onValueChange={(value) =>
                  setCreate((s) => ({ ...s, role: value as UserRole }))
                }
              >
                <SelectTrigger id="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="new-user-write">Write access</Label>
                <p className="text-xs text-muted-foreground">
                  {create.role === 'admin'
                    ? 'Always on for admin accounts.'
                    : 'Allow this user to upload, edit, and delete data.'}
                </p>
              </div>
              <Switch
                id="new-user-write"
                checked={create.role === 'admin' ? true : create.can_write}
                onCheckedChange={(checked) =>
                  setCreate((s) => ({ ...s, can_write: checked }))
                }
                disabled={create.role === 'admin'}
                aria-label="New user write access"
              />
            </div>
            {create.error ? (
              <p className="text-sm text-destructive">{create.error}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreate(initialCreate)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.busy}>
                {create.busy ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reset.user !== null}
        onOpenChange={(open) =>
          setReset((s) =>
            open ? s : { user: null, password: '', confirm: '', busy: false, error: null },
          )
        }
      >
        <DialogContent
          className={nestedDialogClassName}
          overlayClassName={nestedDialogOverlayClassName}
        >
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for{' '}
              <span className="font-medium text-foreground">
                {reset.user?.username ?? ''}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onResetSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                value={reset.password}
                onChange={(e) =>
                  setReset((s) => ({ ...s, password: e.target.value }))
                }
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-password-confirm">Confirm new password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={reset.confirm}
                onChange={(e) =>
                  setReset((s) => ({ ...s, confirm: e.target.value }))
                }
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {reset.error ? (
              <p className="text-sm text-destructive">{reset.error}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setReset({
                    user: null,
                    password: '',
                    confirm: '',
                    busy: false,
                    error: null,
                  })
                }
              >
                Cancel
              </Button>
              <Button type="submit" disabled={reset.busy}>
                {reset.busy ? 'Saving…' : 'Save password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={del.user !== null}
        onOpenChange={(open) =>
          setDel((s) => (open ? s : { user: null, busy: false, error: null }))
        }
        backdropClassName={nestedDialogOverlayClassName}
      >
        <AlertDialogContent className={nestedDialogClassName}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              {del.user
                ? `Permanently remove "${del.user.username}". This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {del.error ? (
            <p className="px-6 text-sm text-destructive">{del.error}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onDeleteConfirm}
              disabled={del.busy}
            >
              {del.busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
