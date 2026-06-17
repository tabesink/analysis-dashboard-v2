'use client';

/**
 * Providers Component
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for wrapping app with required providers
 * - Dependency Inversion: Uses QueryClient abstraction
 * 
 * Design: Minimal provider setup with QueryClient and Toaster.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, useEffect, useRef } from 'react';
import ClientLayout from '@/components/layout/ClientLayout';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useDataVersionSync } from '@/hooks/use-data-version-sync';
import { registerSessionQueryInvalidator, registerSessionQueryClient } from '@/lib/session/session-identity';
import { useAuthStore } from '@/stores/auth-store';

const MAX_CACHED_QUERIES = 100;
const EVICT_COUNT = 20;
const CACHE_CHECK_INTERVAL_MS = 30_000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return makeQueryClient();
  }
  // Browser: reuse the same query client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
    registerSessionQueryClient(browserQueryClient);
    registerSessionQueryInvalidator(() => {
      browserQueryClient?.removeQueries({ queryKey: ['session'] });
    });
  }
  return browserQueryClient;
}

interface ProvidersProps {
  children: React.ReactNode;
}

function DataVersionSyncBridge() {
  useDataVersionSync();
  return null;
}

function trimQueryCache(client: QueryClient) {
  const all = client.getQueryCache().getAll();
  if (all.length <= MAX_CACHED_QUERIES) return;
  all
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
    .slice(0, EVICT_COUNT)
    .forEach((q) => client.removeQueries({ queryKey: q.queryKey, exact: true }));
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => getQueryClient());
  const bootstrapAuth = useAuthStore((s) => s.bootstrap);
  const authStatus = useAuthStore((s) => s.status);
  const bootstrapRetryAttemptRef = useRef(0);
  const previousAuthStatusRef = useRef(authStatus);

  useEffect(() => {
    const id = setInterval(() => trimQueryCache(queryClient), CACHE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [queryClient]);

  useEffect(() => {
    const previousStatus = previousAuthStatusRef.current;
    previousAuthStatusRef.current = authStatus;
    if (authStatus === 'authenticated' || authStatus === 'unauthenticated') {
      bootstrapRetryAttemptRef.current = 0;
      if (
        process.env.NODE_ENV !== 'production' &&
        previousStatus !== authStatus
      ) {
        console.debug(`[AUTH-BOOTSTRAP] settled with status=${authStatus}`);
      }
      return;
    }
    if (authStatus !== 'idle') {
      return;
    }
    const attempt = bootstrapRetryAttemptRef.current;
    const delayMs = attempt === 0 ? 0 : Math.min(1000 * 2 ** attempt, 5000);
    const timerId = window.setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        const retryCount = attempt + 1;
        console.debug(
          `[AUTH-BOOTSTRAP] retry #${retryCount} after ${delayMs}ms (status=${authStatus})`,
        );
      }
      bootstrapRetryAttemptRef.current += 1;
      void bootstrapAuth();
    }, delayMs);
    return () => window.clearTimeout(timerId);
  }, [authStatus, bootstrapAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <DataVersionSyncBridge />
      <ClientLayout>
        {children}
      </ClientLayout>
      <SettingsDialog />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
