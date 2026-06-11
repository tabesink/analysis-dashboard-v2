'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DerivedDataProgressPanel } from '@/components/blocks/dialog/derived-data-progress-panel';
import { ScopeDeleteSummaryPanel } from '@/components/blocks/dialog/scope-delete-summary-panel';
import type { ChannelReprocessProgressPhase } from '@/features/edit-metadata/lib/derived-task-progress';
import type { DamageCalculationProgressPhase } from '@/features/edit-metadata/lib/damage-calculation-progress';
import type { DamageCalculationCompletionResult } from '@/features/edit-metadata/lib/damage-calculation-completion';
import type { UploadCompletionResult } from '@/features/database-upload/upload-operation-types';
import type { ChannelReprocessWizardStep } from '@/stores/channel-reprocess-store';
import type { DerivedTaskKind } from '@/types/api';
import { cn } from '@/lib/utils';
import {
  SHELL_OPERATION_MODAL_BACKDROP_CLASS,
  SHELL_OPERATION_MODAL_LAYER_CLASS,
} from '@/lib/shell-operation-modal';

export interface DerivedDataOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskKind?: DerivedTaskKind;
  wizardStep: ChannelReprocessWizardStep;
  progress: number;
  progressPhase: ChannelReprocessProgressPhase | DamageCalculationProgressPhase;
  progressMessage: string;
  completionResult?: UploadCompletionResult | DamageCalculationCompletionResult | null;
  onDismissProgress?: () => void;
  onCloseSummary?: () => void;
  onPrimaryAction?: () => void;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function modalTitle(taskKind: DerivedTaskKind, wizardStep: ChannelReprocessWizardStep, completionTitle?: string): string {
  if (wizardStep === 'summary') {
    return completionTitle ?? 'Processing complete';
  }
  return taskKind === 'damage_calculation'
    ? 'Calculating schedule damage…'
    : 'Processing channel assignment…';
}

/** Derived-data progress — close hides the modal but processing continues. */
export function DerivedDataOperationModal({
  open,
  onOpenChange,
  taskKind = 'channel_reprocess',
  wizardStep,
  progress,
  progressPhase,
  progressMessage,
  completionResult,
  onDismissProgress,
  onCloseSummary,
  onPrimaryAction,
}: DerivedDataOperationModalProps) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const prevWizardRef = useRef(wizardStep);
  const primaryAction =
    completionResult && 'primaryAction' in completionResult
      ? completionResult.primaryAction
      : undefined;

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

  const title = modalTitle(taskKind, wizardStep, completionResult?.title);

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      containerClassName={SHELL_OPERATION_MODAL_LAYER_CLASS}
      backdropClassName={SHELL_OPERATION_MODAL_BACKDROP_CLASS}
    >
      <AlertDialogContent
        className={cn('max-w-lg max-h-[90vh] overflow-y-auto', SHELL_OPERATION_MODAL_LAYER_CLASS)}
        data-testid="derived-data-operation-modal"
        data-task-kind={taskKind}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {wizardStep === 'progress' ? (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Loader2 className="size-4 text-muted-foreground animate-spin" />
              </div>
            ) : wizardStep === 'summary' && completionResult?.success ? (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
                <Workflow className="size-4 text-foreground" />
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
          <DerivedDataProgressPanel
            taskKind={taskKind}
            progress={progress}
            progressPhase={progressPhase}
            progressMessage={progressMessage}
          />
        ) : null}

        {wizardStep === 'summary' && completionResult ? (
          <ScopeDeleteSummaryPanel result={completionResult} />
        ) : null}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          {wizardStep === 'progress' ? (
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:max-w-[60%]">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Closing this dialog does not cancel processing. Work continues in the
                background and can be reopened from Edit Metadata.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                data-testid="derived-data-dismiss-progress"
                onClick={() => onDismissProgress?.()}
              >
                Close and continue in background
              </Button>
            </div>
          ) : (
            <span className="hidden sm:block sm:flex-1" />
          )}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {wizardStep === 'summary' && primaryAction ? (
              <Button
                type="button"
                variant="outline"
                data-testid={primaryAction.testId}
                onClick={() => onPrimaryAction?.()}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {wizardStep === 'summary' ? (
              <Button
                type="button"
                className="min-w-[100px]"
                data-testid="derived-data-close-summary"
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
