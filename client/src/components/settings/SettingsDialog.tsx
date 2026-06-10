"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { Database, Info, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangelogSettingsPanel } from "@/components/settings/panels/ChangelogSettingsPanel";
import { DatabaseSettingsPanel } from "@/components/settings/panels/DatabaseSettingsPanel";
import { UserManagementSettingsPanel } from "@/components/settings/panels/UserManagementSettingsPanel";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";
import {
  closeSettingsDialog,
  setSettingsDialogOpen,
  setSettingsDialogRoute,
  useSettingsDialogStore,
  type SettingsRoute,
} from "@/stores/settings-dialog-store";
import type { ComponentType } from "react";

const ROUTES: Array<{ id: SettingsRoute; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "user-management", label: "Users", icon: UserRound },
  { id: "database", label: "Database", icon: Database },
  { id: "changelog", label: "Changelog", icon: Info },
];

export function SettingsDialog() {
  const isOpen = useSettingsDialogStore((state) => state.isOpen);
  const route = useSettingsDialogStore((state) => state.route);
  const isAdmin = useAuthStore(selectIsAdmin);
  const allowedRoutes = React.useMemo(
    () => (isAdmin ? ROUTES : []),
    [isAdmin],
  );
  const activeRouteLabel =
    allowedRoutes.find((item) => item.id === route)?.label ?? "Users";

  if (!isOpen || !isAdmin) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-white/70 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/45" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 h-[min(720px,calc(100vh-96px))] w-[min(980px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-0 shadow-sm outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          <div className="grid h-full min-h-0 grid-cols-[180px_1fr]">
            <aside className="border-r border-[var(--border)] bg-[var(--background)] px-3 py-4">
              <div className="mb-4 flex items-center gap-2 px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close settings"
                  onClick={closeSettingsDialog}
                  className="rounded-full text-[var(--foreground)] hover:bg-[var(--secondary)]"
                >
                  <X className="size-4" />
                </Button>
                <p className="sr-only">Settings</p>
              </div>
              <nav className="space-y-1" aria-label="Settings sections">
                {allowedRoutes.map((item) => {
                  const Icon = item.icon;
                  const active = route === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSettingsDialogRoute(item.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-normal transition-colors ${
                        active
                          ? "bg-[var(--secondary)] text-[var(--foreground)]"
                          : "text-[var(--foreground)] hover:bg-[var(--secondary)]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="min-h-0 overflow-y-auto px-6 py-4">
              <header className="mb-5 border-b border-[var(--border)] pb-4">
                <h2 className="text-base font-medium text-[var(--foreground)]">{activeRouteLabel}</h2>
              </header>
              {route === "user-management" ? <UserManagementSettingsPanel /> : null}
              {route === "database" ? <DatabaseSettingsPanel /> : null}
              {route === "changelog" ? <ChangelogSettingsPanel /> : null}
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
