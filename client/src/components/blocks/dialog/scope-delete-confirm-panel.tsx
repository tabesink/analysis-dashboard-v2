'use client';

import type { ScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';

export interface ScopeDeleteConfirmPanelProps {
  plan: ScopeDeletePlan;
}

/** Confirm body aligned with DatabaseOperationModal import confirm styling. */
export function ScopeDeleteConfirmPanel({ plan }: ScopeDeleteConfirmPanelProps) {
  const { summary } = plan;

  return (
    <div className="px-6 py-4">
      <div className="rounded-lg bg-muted/60 border border-border p-3 space-y-3">
        {summary.detailLines.map((line, index) => (
          <p
            key={line}
            className={index === 0 ? 'text-sm font-medium text-foreground' : 'text-sm text-foreground'}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
