'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UploadProgressPanel } from '@/components/blocks/dialog/upload-progress-panel';
import { ScopeDeleteSummaryPanel } from '@/components/blocks/dialog/scope-delete-summary-panel';
import type { UploadOperationModalProps } from '@/features/database-upload/upload-operation-types';

export type {
  UploadCompletionResult,
  UploadOperationModalProps,
  UploadProgressPhase,
  UploadWizardStep,
} from '@/features/database-upload/upload-operation-types';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Folder upload flow — shell matches ScopeDeleteOperationModal / DatabaseOperationModal. */
export function UploadOperationModal({
  open,
  onOpenChange,
  wizardStep,
  blocking,
  progress,
  progressPhase,
  progressMessage,
  completionResult,
  onCancelUpload,
  onCloseSummary,
}: UploadOperationModalProps) {
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

  const title =
    wizardStep === 'summary'
      ? (completionResult?.title ?? 'Import complete')
      : 'Importing data…';

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
      backdropClassName="bg-transparent backdrop-blur-none"
    >
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {wizardStep === 'progress' ? (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Loader2 className="size-4 text-muted-foreground animate-spin" />
              </div>
            ) : wizardStep === 'summary' && completionResult?.success ? (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
                <Upload className="size-4 text-foreground" />
              </div>
            ) : null}
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
            </div>
          </div>
        </AlertDialogHeader>

        {wizardStep === 'progress' ? (
          <UploadProgressPanel
            progress={progress}
            progressMessage={progressMessage}
            progressPhase={progressPhase}
          />
        ) : null}

        {wizardStep === 'summary' && completionResult ? (
          <ScopeDeleteSummaryPanel result={completionResult} />
        ) : null}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          {wizardStep === 'progress' && blocking ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onCancelUpload?.()}
            >
              Cancel import
            </Button>
          ) : (
            <span className="hidden sm:block sm:flex-1" />
          )}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
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
            ) : null}
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
