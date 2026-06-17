'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { TaskStatusResponse } from '@/lib/api/export';
import {
  OperationProgressMessage,
  OperationProgressPanel,
  PhaseStep,
  type StepTone,
} from '@/components/blocks/dialog/operation-progress-stepper';

export type DatabaseOperationMode = 'export';
export type DatabaseWizardStep = 'progress' | 'summary';

export interface DatabaseCompletionResult {
  success: boolean;
  title: string;
  message: string;
  elapsedSeconds?: number;
  detailLines?: string[];
}

export interface DatabaseOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DatabaseOperationMode;
  wizardStep: DatabaseWizardStep;
  blocking: boolean;
  exportFileName?: string;
  exportSaveMethod?: 'picker' | 'download';
  exportDownloadActive?: boolean;
  taskStatus?: TaskStatusResponse | null;
  taskConnectionLost?: boolean;
  taskConnectionMessage?: string;
  activeTaskId?: string | null;
  isCancelling?: boolean;
  onCancelOperation?: () => void | Promise<void>;
  completionResult?: DatabaseCompletionResult | null;
  onCloseSummary?: () => void;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

function formatPhaseDuration(seconds: number): string {
  if (seconds < 1) return '<1s';
  return formatElapsed(seconds);
}

export function DatabaseOperationModal({
  open,
  onOpenChange,
  wizardStep,
  blocking,
  exportFileName,
  exportSaveMethod = 'download',
  exportDownloadActive = false,
  taskStatus,
  taskConnectionLost = false,
  taskConnectionMessage,
  activeTaskId,
  isCancelling = false,
  onCancelOperation,
  completionResult,
  onCloseSummary,
}: DatabaseOperationModalProps) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [phaseDurationsSec, setPhaseDurationsSec] = useState<Record<string, number>>({});
  const phaseTimingRef = useRef<{ uiPhase: string | null; phaseStartAt: number | null }>({
    uiPhase: null,
    phaseStartAt: null,
  });
  const prevWizardRef = useRef(wizardStep);

  const handleOpenChange = (next: boolean) => {
    if (!next && blocking) return;
    onOpenChange(next);
  };

  const exportUiPhase = useMemo(() => {
    if (wizardStep !== 'progress') return null;
    const phase = taskStatus?.phase ?? '';
    const status = taskStatus?.status ?? '';
    if (exportDownloadActive || phase === 'downloading' || phase === 'pending_download') {
      return 'download';
    }
    if (phase === 'compressing') return 'compress';
    if (phase === 'exporting' || status === 'running') return 'export_tables';
    return 'export_tables';
  }, [wizardStep, taskStatus?.phase, taskStatus?.status, exportDownloadActive]);

  useEffect(() => {
    if (prevWizardRef.current !== 'progress' && wizardStep === 'progress') {
      setPhaseDurationsSec({});
      setElapsedSec(0);
      phaseTimingRef.current = { uiPhase: null, phaseStartAt: null };
    }
    prevWizardRef.current = wizardStep;
  }, [wizardStep]);

  useEffect(() => {
    if (!open || wizardStep !== 'progress') return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec((Date.now() - startedAt) / 1000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, wizardStep]);

  useEffect(() => {
    if (wizardStep !== 'progress' || !exportUiPhase) return;
    const now = Date.now();
    const { uiPhase, phaseStartAt } = phaseTimingRef.current;
    if (uiPhase === exportUiPhase) return;
    if (uiPhase && phaseStartAt) {
      setPhaseDurationsSec((prev) => ({
        ...prev,
        [uiPhase]: (prev[uiPhase] ?? 0) + (now - phaseStartAt) / 1000,
      }));
    }
    phaseTimingRef.current = { uiPhase: exportUiPhase, phaseStartAt: now };
  }, [exportUiPhase, wizardStep]);

  useEffect(() => {
    if (wizardStep !== 'summary') return;
    const { uiPhase, phaseStartAt } = phaseTimingRef.current;
    if (uiPhase && phaseStartAt) {
      const now = Date.now();
      setPhaseDurationsSec((prev) => ({
        ...prev,
        [uiPhase]: (prev[uiPhase] ?? 0) + (now - phaseStartAt) / 1000,
      }));
      phaseTimingRef.current = { uiPhase: null, phaseStartAt: null };
    }
  }, [wizardStep]);

  const title =
    wizardStep === 'summary'
      ? completionResult?.success
        ? 'Export complete'
        : 'Export failed'
      : 'Load data export';
  const subtitle =
    wizardStep === 'progress'
      ? exportSaveMethod === 'picker' && exportFileName
        ? `Saving to chosen location as ${exportFileName}`
        : 'Saving to your Downloads folder as dashboard_export.zip (browser default)'
      : undefined;

  const renderProgress = () => {
    const phase = taskStatus?.phase ?? '';
    const status = taskStatus?.status ?? '';
    const tablesDone =
      ['compressing', 'pending_download', 'downloading'].includes(phase) ||
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled';
    const tablesActive = !tablesDone && (phase === 'exporting' || status === 'running' || !taskStatus);
    const compressDone =
      ['pending_download', 'downloading'].includes(phase) ||
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled';
    const compressActive = phase === 'compressing' && status === 'running';
    const downloadActive =
      exportDownloadActive ||
      (status === 'completed' && ['pending_download', 'downloading'].includes(phase));
    const downloadDone = !downloadActive && compressDone && status === 'completed';

    const tablesTone: StepTone = tablesDone ? 'done' : tablesActive ? 'active' : 'pending';
    const compressTone: StepTone = compressDone ? 'done' : compressActive ? 'active' : 'pending';
    const downloadTone: StepTone =
      status === 'failed' || status === 'cancelled'
        ? 'pending'
        : downloadDone
          ? 'done'
          : downloadActive
            ? 'active'
            : 'pending';

    const tablePercent =
      taskStatus && taskStatus.total > 0
        ? Math.min(100, (100 * taskStatus.current) / taskStatus.total)
        : 0;

    return (
      <OperationProgressPanel
        header={
          <OperationProgressMessage>
            {taskConnectionLost
              ? (taskConnectionMessage ?? 'Waiting for server… export may still be running.')
              : (taskStatus?.progress ?? 'Starting…')}
          </OperationProgressMessage>
        }
      >
        <PhaseStep
          label="Export tables"
          tone={tablesTone}
          isLast={false}
          trailing={
            tablesTone === 'done'
              ? formatPhaseDuration(phaseDurationsSec.export_tables ?? 0)
              : tablesTone === 'active'
                ? `${Math.round(tablePercent)}%`
                : null
          }
        >
          {tablesTone === 'active' && taskStatus?.total ? (
            <div className="space-y-2">
              {taskStatus.current_table ? (
                <p className="text-xs font-mono text-foreground truncate">{taskStatus.current_table}</p>
              ) : null}
              <p className="text-xs text-muted-foreground tabular-nums">
                {taskStatus.current} of {taskStatus.total} tables
              </p>
              <Progress value={tablePercent} className="h-1.5" />
            </div>
          ) : null}
        </PhaseStep>
        <PhaseStep
          label="Compress archive"
          tone={compressTone}
          isLast={false}
          trailing={
            compressTone === 'done'
              ? formatPhaseDuration(phaseDurationsSec.compress ?? 0)
              : compressTone === 'active'
                ? '…'
                : null
          }
        >
          {compressTone === 'active' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{taskStatus?.progress || 'Working…'}</p>
              <Progress value={0} indeterminate className="h-1.5" />
            </div>
          ) : null}
        </PhaseStep>
        <PhaseStep
          label="Download"
          tone={downloadTone}
          isLast
          trailing={
            downloadTone === 'done'
              ? formatPhaseDuration(phaseDurationsSec.download ?? 0)
              : downloadTone === 'active'
                ? '…'
                : null
          }
        >
          {downloadTone === 'active' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {exportDownloadActive ? 'Saving file in your browser…' : taskStatus?.progress || 'Preparing download…'}
              </p>
              <Progress value={0} indeterminate className="h-1.5" />
            </div>
          ) : null}
        </PhaseStep>
      </OperationProgressPanel>
    );
  };

  const renderSummary = () => {
    if (!completionResult) return null;
    const phaseLabels: Array<{ key: string; label: string }> = [
      { key: 'export_tables', label: 'Export tables' },
      { key: 'compress', label: 'Compress archive' },
      { key: 'download', label: 'Download' },
    ];
    return (
      <div className="px-6 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
            {completionResult.success ? (
              <CheckCircle2 className="size-4 text-foreground" aria-hidden />
            ) : (
              <XCircle className="size-4 text-destructive" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">{completionResult.message}</p>
            {typeof completionResult.elapsedSeconds === 'number' ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                Total time: {formatElapsed(completionResult.elapsedSeconds)}
              </p>
            ) : null}
            <div className="pt-2 space-y-1 border-t border-border mt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phase times</p>
              {phaseLabels.map(({ key, label }) => {
                const sec = phaseDurationsSec[key] ?? 0;
                if (sec <= 0) return null;
                return (
                  <div key={key} className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span className="tabular-nums shrink-0">{formatPhaseDuration(sec)}</span>
                  </div>
                );
              })}
            </div>
            {completionResult.detailLines?.map((line, idx) => (
              <p key={idx} className="text-xs text-muted-foreground break-all">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange} backdropClassName="bg-transparent backdrop-blur-none">
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {wizardStep !== 'summary' ? (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Download className="size-4 text-muted-foreground" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <AlertDialogTitle className="text-lg flex-1">{title}</AlertDialogTitle>
                {wizardStep === 'progress' ? (
                  <span className="tabular-nums text-sm text-muted-foreground shrink-0 pt-0.5" aria-live="polite">
                    {formatElapsed(elapsedSec)}
                  </span>
                ) : null}
              </div>
              {subtitle ? <p className="text-sm text-muted-foreground break-all">{subtitle}</p> : null}
            </div>
          </div>
        </AlertDialogHeader>

        {wizardStep === 'summary' ? renderSummary() : renderProgress()}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          {wizardStep === 'progress' && (taskStatus?.status === 'running' || isCancelling) && activeTaskId ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isCancelling}
              onClick={() => void onCancelOperation?.()}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling…
                </>
              ) : (
                'Cancel operation'
              )}
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
