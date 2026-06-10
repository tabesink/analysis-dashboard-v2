'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ScopeDeleteCompletionResult } from '@/features/database-scope-delete/scope-delete-operation-types';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export interface ScopeDeleteSummaryPanelProps {
  result: ScopeDeleteCompletionResult;
}

/** Summary body aligned with DatabaseOperationModal completion styling. */
export function ScopeDeleteSummaryPanel({ result }: ScopeDeleteSummaryPanelProps) {
  const ok = result.success;

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
          {ok ? (
            <CheckCircle2 className="size-4 text-foreground" aria-hidden />
          ) : (
            <XCircle className="size-4 text-destructive" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">{result.message}</p>
          {typeof result.elapsedSeconds === 'number' ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Total time: {formatElapsed(result.elapsedSeconds)}
            </p>
          ) : null}
          {result.detailLines?.map((line) => (
            <p key={line} className="text-xs text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
