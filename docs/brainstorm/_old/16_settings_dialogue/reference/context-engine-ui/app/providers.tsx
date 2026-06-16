"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useAuthStore } from "@/stores/auth-store";

export function Providers({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <AppLayout>
      {children}
      <SettingsDialog />
      <Toaster richColors closeButton />
    </AppLayout>
  );
}
