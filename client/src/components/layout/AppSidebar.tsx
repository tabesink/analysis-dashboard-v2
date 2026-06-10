"use client"

/**
 * AppSidebar Component
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for rendering sidebar structure
 * - Open/Closed: Extensible through props and config injection
 * - Dependency Inversion: Depends on abstractions (SidebarConfig) rather than
 *   concrete implementations.
 *
 * Design: Icon-only (64px) fixed sidebar with hover tooltips.
 * Mobile support intentionally removed for clean, bloat-free code.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, Settings } from "lucide-react"
import { NavMain } from "./NavMain"
import { LogoHeader } from "./LogoHeader"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { SidebarConfig } from "@/types/layout"
import { getSidebarConfig } from "@/config/sidebar-config"
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store"
import {
  openSettingsDialog,
  useSettingsDialogStore,
} from "@/stores/settings-dialog-store"
import { usersApi } from "@/lib/api/users"
import { cn } from "@/lib/utils"

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  config?: SidebarConfig;
}

export function AppSidebar({
  config,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = useAuthStore(selectIsAdmin)

  const sidebarConfig = config ?? getSidebarConfig();

  const isAuthed = Boolean(user)
  const isBusy = status === "loading"
  const settingsOpen = useSettingsDialogStore((s) => s.isOpen)

  const [pendingCount, setPendingCount] = React.useState(0)

  const refreshPending = React.useCallback(async () => {
    if (!isAdmin) {
      setPendingCount(0)
      return
    }
    try {
      const result = await usersApi.pendingCount()
      setPendingCount(result.count)
    } catch {
      // Silently swallow; the dot is a best-effort affordance.
    }
  }, [isAdmin])

  React.useEffect(() => {
    void refreshPending()
  }, [refreshPending, pathname])

  const onSettingsClick = () => {
    if (!isAdmin) return
    void usersApi
      .markVisited()
      .catch(() => undefined)
      .finally(() => {
        setPendingCount(0)
      })
    openSettingsDialog("user-management")
  }

  return (
    <Sidebar collapsible="none" {...props}>
      <SidebarHeader className="py-3">
        <LogoHeader />
      </SidebarHeader>
      <SidebarContent className="py-2">
        <NavMain items={sidebarConfig.navMain} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 pt-3">
        <SidebarMenu className="px-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={isAdmin && settingsOpen}
              aria-disabled={!isAdmin}
              aria-label="Settings"
              className={cn(
                "relative",
                !isAdmin && "cursor-not-allowed opacity-50",
              )}
              onClick={isAdmin ? onSettingsClick : undefined}
            >
              <Settings
                className={cn(
                  "size-5 transition-colors",
                  isAdmin && settingsOpen
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70",
                )}
              />
              {isAdmin && pendingCount > 0 && (
                <span
                  className="absolute right-2 top-2 inline-block size-2 rounded-full bg-destructive"
                  aria-label={`${pendingCount} new user${pendingCount === 1 ? "" : "s"}`}
                />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {isAuthed ? (
              <SidebarMenuButton
                tooltip={user ? `${user.username} • Logout` : "Logout"}
                onClick={() => void logout()}
                disabled={isBusy}
                aria-label="Logout"
              >
                <LogOut className="size-5" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                tooltip="Login"
                isActive={pathname === "/login"}
                aria-label="Login"
              >
                <Link href="/login">
                  <LogIn className="size-5" />
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
