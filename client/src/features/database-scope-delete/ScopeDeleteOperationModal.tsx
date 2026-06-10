'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScopeDeleteConfirmPanel } from '@/components/blocks/dialog/scope-delete-confirm-panel';
import { ScopeDeleteProgressPanel } from '@/components/blocks/dialog/scope-delete-progress-panel';
import { ScopeDeleteSummaryPanel } from '@/components/blocks/dialog/scope-delete-summary-panel';
import type { ScopeDeleteOperationModalProps } from '@/features/database-scope-delete/scope-delete-operation-types';

export type {
  ScopeDeleteCompletionResult,
  ScopeDeleteOperationModalProps,
  ScopeDeleteProgressPhase,
  ScopeDeleteWizardStep,
} from '@/features/database-scope-delete/scope-delete-operation-types';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Scope delete flow — shell and typography match DatabaseOperationModal. */
export function ScopeDeleteOperationModal({
  open,
  onOpenChange,
  wizardStep,
  blocking,
  plan,
  progressPhase,
  progressMessage,
  completionResult,
  onConfirmDelete,
  onCloseSummary,
}: ScopeDeleteOperationModalProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next && blocking) return;
    onOpenChange(next);
  };

  const [elapsedSec, setElapsedSec] = useState(0);
  const prevWizardRef = useRef(wizardStep);

  useEffect(() => {
    let resetId: number | null = null;
    if (prevWizardRef.current !== 'progress' && wizardStep === 'progress') {
      resetId = window.setTimeout(() => {
        setElapsedSec(0);
      }, 0);
    }
    prevWizardRef.current = wizardStep;
    return () => {
      if (resetId != null) {
        window.clearTimeout(resetId);
      }
    };
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep !== 'progress' || !open) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec((Date.now() - startedAt) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [open, wizardStep]);

  const title = (() => {
    if (wizardStep === 'summary') {
      return completionResult?.title ?? 'Delete complete';
    }
    if (wizardStep === 'progress') {
      return 'Deleting data…';
    }
    return 'Delete program/version data?';
  })();

  const subtitle =
    wizardStep === 'confirm'
      ? 'This permanently removes processed events, measurements, channel maps, and retained artifacts.'
      : null;

  const headerIcon =
    wizardStep === 'progress' ? (
      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Loader2 className="size-4 text-muted-foreground animate-spin" />
      </div>
    ) : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
      backdropClassName="bg-transparent backdrop-blur-none"
    >
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {wizardStep !== 'summary' ? headerIcon : null}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <AlertDialogTitle className="text-lg flex-1">{title}</AlertDialogTitle>
                {wizardStep === 'progress' ? (
                  <span
                    className="tabular-nums text-sm text-muted-foreground shrink-0 pt-0.5"
                    aria-live="polite"
                  >
                    {formatElapsed(elapsedSec)}
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>

        {wizardStep === 'confirm' && plan ? <ScopeDeleteConfirmPanel plan={plan} /> : null}

        {wizardStep === 'progress' ? (
          <ScopeDeleteProgressPanel
            progressMessage={progressMessage}
            progressPhase={progressPhase}
          />
        ) : null}

        {wizardStep === 'summary' && completionResult ? (
          <ScopeDeleteSummaryPanel result={completionResult} />
        ) : null}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
          {wizardStep === 'summary' ? (
            <Button
              type="button"
              className="min-w-[100px]"
              onClick={() => {
                onCloseSummary?.();
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          ) : wizardStep === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => onConfirmDelete?.()}>
                <Trash2 className="size-4" />
                Permanently delete
              </Button>
            </>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
