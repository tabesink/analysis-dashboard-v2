"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { openSettingsDialog, useSettingsDialogStore } from "@/stores/settings-dialog-store";

function railButtonClassName(active = false) {
  return cn(
    "inline-flex size-9 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
    "hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
    active && "bg-[var(--background)] text-[var(--foreground)]",
  );
}

export function AppSideRail() {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);
  const settingsOpen = useSettingsDialogStore((state) => state.isOpen);
  const authenticated = status === "authenticated";

  return (
    <aside className="flex h-full min-h-0 w-14 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--muted)]/60 py-3">
      <div className="flex size-9 items-center justify-center rounded-md" aria-label="Knowledge Graph">
        <Image
          src="/logo.svg"
          alt=""
          width={28}
          height={28}
          priority
          className="size-7 object-contain"
        />
      </div>

      <div className="my-3 h-px w-7 bg-[var(--border)]" />

      <nav className="flex flex-col items-center gap-2" aria-label="Application actions">
        <Link href="/chat" aria-label="Chat" className={railButtonClassName(pathname.startsWith("/chat"))}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4.5"
            aria-hidden
          >
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </Link>

        <Link
          href="/documents"
          aria-label="Documents"
          className={railButtonClassName(pathname.startsWith("/documents"))}
        >
          <FileText className="size-4.5" aria-hidden />
        </Link>

        <Link
          href="/database-visualize"
          aria-label="Knowledge graph"
          className={railButtonClassName(pathname.startsWith("/database-visualize"))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4.5"
            aria-hidden
          >
            <path d="M21 11.693V5" />
            <path d="m22 22-1.875-1.875" />
            <path d="M3 12a9 3 0 0 0 8.697 2.998" />
            <path d="M3 5v14a9 3 0 0 0 9.28 2.999" />
            <circle cx="18" cy="18" r="3" />
            <ellipse cx="12" cy="5" rx="9" ry="3" />
          </svg>
        </Link>

        <button
          type="button"
          onClick={() => openSettingsDialog("general")}
          aria-label="Settings"
          className={railButtonClassName(settingsOpen || pathname.startsWith("/settings"))}
        >
          <Settings className="size-4.5" aria-hidden />
        </button>
      </nav>

      {authenticated ? (
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Logout"
          className={cn(railButtonClassName(), "mt-auto")}
        >
          <LogOut className="size-4.5" aria-hidden />
        </button>
      ) : null}
    </aside>
  );
}
