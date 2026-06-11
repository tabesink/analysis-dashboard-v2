'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DatabaseChannelReprocessBannerEntry } from '@/features/edit-metadata/lib/database-channel-reprocess-banner';

export interface DatabaseChannelReprocessBannerProps {
  entry: DatabaseChannelReprocessBannerEntry;
  onReopen: () => void;
}

export function DatabaseChannelReprocessBanner({
  entry,
  onReopen,
}: DatabaseChannelReprocessBannerProps) {
  const scopeLabel = `${entry.scope.programId} · ${entry.scope.version}`;

  return (
    <div
      data-testid="database-channel-reprocess-banner"
      className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Channel reprocess in progress
            <span className="font-normal text-muted-foreground"> · {scopeLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.progressMessage}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        data-testid="database-channel-reprocess-reopen"
        onClick={onReopen}
      >
        Reopen progress
      </Button>
    </div>
  );
}
