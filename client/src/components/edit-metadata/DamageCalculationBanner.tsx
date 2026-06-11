'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DamageCalculationBannerProps {
  progressMessage: string;
  onReopen: () => void;
}

export function DamageCalculationBanner({
  progressMessage,
  onReopen,
}: DamageCalculationBannerProps) {
  return (
    <div
      data-testid="damage-calculation-banner"
      className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">Damage calculation in progress</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{progressMessage}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        data-testid="damage-calculation-reopen"
        onClick={onReopen}
      >
        Reopen progress
      </Button>
    </div>
  );
}
