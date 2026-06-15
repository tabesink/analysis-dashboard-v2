'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PlotCardShellProps = {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children?: ReactNode;
  actionSlot?: ReactNode;
  footerSlot?: ReactNode;
  labelPrefix?: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function PlotCardShell({
  title,
  subtitle,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyTitle = 'No data available',
  emptyDescription,
  children,
  actionSlot,
  footerSlot,
  labelPrefix,
  className,
  onClick,
}: PlotCardShellProps) {
  const state = isLoading ? 'loading' : error ? 'error' : isEmpty ? 'empty' : 'ready';

  return (
    <Card className={className} onClick={onClick}>
      <div className="absolute inset-0">
        {state === 'loading' ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
              <p className="text-caption text-muted-foreground">Loading plot...</p>
            </div>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="flex max-w-[180px] flex-col items-center gap-2 text-center">
              <AlertCircle className="h-5 w-5 text-destructive/70" />
              <p className="text-caption line-clamp-3 text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : null}

        {state === 'empty' ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="max-w-[220px] text-center">
              <h3 className="text-xs font-medium text-foreground">{emptyTitle}</h3>
              {emptyDescription ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{emptyDescription}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {state === 'ready' ? children : null}
      </div>

      {actionSlot ? <div className="absolute right-1 top-1 flex items-center gap-0.5">{actionSlot}</div> : null}
      {footerSlot ? <div className="absolute bottom-1.5 right-2">{footerSlot}</div> : null}

      <div className="absolute bottom-1 left-1 right-1 z-10 max-w-[calc(100%-0.5rem)] pointer-events-none">
        <div className="flex min-w-0 items-center gap-1.5 rounded bg-gray-100/90 px-1.5 py-0.5 backdrop-blur-sm">
          {labelPrefix}
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-xs font-medium leading-none text-black">{title}</span>
            {subtitle ? (
              <span className="hidden min-w-0 truncate text-[10px] leading-none text-black/70 xl:inline">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
