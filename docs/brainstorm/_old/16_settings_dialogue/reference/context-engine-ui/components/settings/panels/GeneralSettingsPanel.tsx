"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { setSettingsDialogRoute } from "@/stores/settings-dialog-store";

export function GeneralSettingsPanel() {
  const user = useAuthStore((state) => state.user);

  const roleLabel = useMemo(() => {
    if (!user) return "Guest";
    return user.role === "admin" ? "Admin" : "User";
  }, [user]);

  return (
    <div className="space-y-1">
      <div className="rounded-xl bg-[var(--secondary)]/60 p-4">
        <div className="mb-3 flex size-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)]">
          <ShieldCheck className="size-4 text-[var(--foreground)]" />
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">Review your account</p>
        <p className="mt-1 max-w-[34rem] text-sm leading-5 text-[var(--muted-foreground)]">
          {user ? `${user.username} is signed in as ${roleLabel.toLowerCase()}. Manage account access and user settings from the Account panel.` : "Sign in to manage account access and user settings."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSettingsDialogRoute("account")}
          className="mt-3 rounded-full bg-[var(--background)] px-4 shadow-none"
        >
          Open account
        </Button>
      </div>
    </div>
  );
}
