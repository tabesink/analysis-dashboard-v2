'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardApi } from '@/lib/api';
import { getStatusBadgeClassName } from '@/lib/status-badge';
import { rollUpStatusFromValues } from '@/lib/status-rollup';
import { cn } from '@/lib/utils';

export interface MetadataDialogHeaderProps {
  programId: string;
  version: string;
  statusDraftValue?: string | null;
}

function MetadataBarItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-4 first:pl-0 last:pr-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function MetadataDialogHeader({
  programId,
  version,
  statusDraftValue = null,
}: MetadataDialogHeaderProps) {
  const eventsQuery = useQuery({
    queryKey: ['program-version-events', programId, version],
    queryFn: () =>
      dashboardApi.getEvents(
        {
          program_ids: [programId],
          versions: [version],
          global_filters: {},
        },
        500,
      ),
    enabled: Boolean(programId && version),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const statusRollup = rollUpStatusFromValues(
    (eventsQuery.data?.events ?? []).map((event) => event.status ?? ''),
  );
  const trimmedStatusDraft = statusDraftValue?.trim() ?? '';
  const displayStatus = trimmedStatusDraft
    ? {
        label: trimmedStatusDraft,
        className: getStatusBadgeClassName(trimmedStatusDraft),
      }
    : statusRollup;
  const isStatusLoading =
    !trimmedStatusDraft && (eventsQuery.isLoading || eventsQuery.isFetching);

  return (
    <header className="mb-5 shrink-0" data-testid="metadata-dialog-header">
      <div className="bg-muted/40 px-4 py-3">
        <div className="flex flex-wrap items-center">
          <MetadataBarItem label="Program ID">
            <span className="truncate text-sm font-medium text-foreground tabular-nums">
              {programId}
            </span>
          </MetadataBarItem>

          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" decorative />

          <MetadataBarItem label="Version">
            <span className="truncate text-sm font-medium text-foreground tabular-nums">
              {version}
            </span>
          </MetadataBarItem>

          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" decorative />

          <MetadataBarItem label="Status">
            {isStatusLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" data-testid="metadata-dialog-status-skeleton" />
            ) : (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  displayStatus.className,
                )}
                data-testid="metadata-dialog-status-badge"
              >
                {displayStatus.label}
              </span>
            )}
          </MetadataBarItem>
        </div>
      </div>
    </header>
  );
}
