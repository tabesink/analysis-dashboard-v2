'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { showShortInfoToast } from '@/lib/feedback/short-info-toast';
import { exportApi } from '@/lib/api';
import type { TaskStatusResponse } from '@/lib/api/export';
import type {
  DatabaseCompletionResult,
  DatabaseOperationMode,
  DatabaseWizardStep,
  DatabaseOperationModalProps,
} from '@/features/database/portability/types';

function estimateDownloadTime(sizeMb: number): string | null {
  const connection = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  const downlinkMbps = connection?.downlink;
  if (!downlinkMbps || downlinkMbps <= 0) return null;

  const bytesPerSecond = (downlinkMbps * 1_000_000) / 8;
  const totalBytes = sizeMb * 1024 * 1024;
  const seconds = totalBytes / bytesPerSecond;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return `${Math.round(seconds / 60)}m`;
}

export interface UseDatabaseOperationOptions {
}

export interface UseDatabaseOperationReturn {
  isExporting: boolean;
  exportProgress: string;
  startExport: () => Promise<void>;
  modalProps: DatabaseOperationModalProps;
}

export function useDatabaseOperation({}: UseDatabaseOperationOptions = {}): UseDatabaseOperationReturn {
  const [modalOpen, setModalOpen] = useState(false);
  const mode: DatabaseOperationMode = 'export';
  const [wizardStep, setWizardStep] = useState<DatabaseWizardStep>('progress');

  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskConnectionLost, setTaskConnectionLost] = useState(false);
  const [taskConnectionMessage, setTaskConnectionMessage] = useState<string | undefined>();
  const [isCancelling, setIsCancelling] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const [exportDownloadActive, setExportDownloadActive] = useState(false);
  const [exportFileName, setExportFileName] = useState('dashboard_export.zip');
  const [exportSaveMethod, setExportSaveMethod] = useState<'picker' | 'download'>('download');

  const [completionResult, setCompletionResult] = useState<DatabaseCompletionResult | null>(null);

  const resetModal = useCallback(() => {
    setWizardStep('progress');
    setTaskStatus(null);
    setActiveTaskId(null);
    setTaskConnectionLost(false);
    setTaskConnectionMessage(undefined);
    setIsCancelling(false);
    setCompletionResult(null);
    setExportDownloadActive(false);
  }, []);

  const closeModal = useCallback(() => {
    resetModal();
    setModalOpen(false);
  }, [resetModal]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeModal();
      } else {
        setModalOpen(true);
      }
    },
    [closeModal],
  );

  const cancelOperation = useCallback(async () => {
    if (!activeTaskId) return;
    setIsCancelling(true);
    try {
      await exportApi.cancelParquetTask(activeTaskId);
    } catch {
      setIsCancelling(false);
      toast.error('Could not cancel the operation.');
    }
  }, [activeTaskId]);

  const startExport = useCallback(async () => {
    const runExport = async (
      writeBlob: (blob: Blob) => Promise<void>,
      fileName: string,
      saveMethod: 'picker' | 'download',
    ) => {
      setModalOpen(true);
      setWizardStep('progress');
      setCompletionResult(null);
      setTaskStatus(null);
      setActiveTaskId(null);
      setTaskConnectionLost(false);
      setTaskConnectionMessage(undefined);
      setIsCancelling(false);
      setExportDownloadActive(false);
      setExportFileName(fileName);
      setExportSaveMethod(saveMethod);

      const started = Date.now();
      setIsExporting(true);
      setExportProgress('Starting…');

      try {
        try {
          const info = await exportApi.getDatabaseInfo();
          const estimated = estimateDownloadTime(info.size_mb);
          const estimateLabel = estimated ? ` (~${estimated})` : '';
          showShortInfoToast(
            `Live DB ~${info.size_mb.toFixed(1)} MB on disk${estimateLabel}. Building compressed export…`,
          );
        } catch {
          // Continue if info fails
        }

        const { task_id } = await exportApi.startParquetExport();
        setActiveTaskId(task_id);
        showShortInfoToast('Database export started');

        const final = await exportApi.waitForParquetTask(task_id, (s) => {
          setTaskStatus(s);
          setExportProgress(s.progress);
        });

        setActiveTaskId(null);
        setIsCancelling(false);

        if (final.status === 'cancelled') {
          setCompletionResult({
            success: false,
            title: 'Export cancelled',
            message: 'The export was stopped before completion.',
            elapsedSeconds: (Date.now() - started) / 1000,
          });
          setWizardStep('summary');
          showShortInfoToast('Database export cancelled');
          return;
        }

        if (final.status === 'failed') {
          setCompletionResult({
            success: false,
            title: 'Export failed',
            message: final.error || 'Export failed',
            elapsedSeconds: (Date.now() - started) / 1000,
          });
          setWizardStep('summary');
          toast.error(`Load-data export failed: ${final.error || 'Export failed'}`);
          return;
        }

        setTaskStatus(final);
        setExportDownloadActive(true);
        const blob = await exportApi.downloadParquetExport(task_id);
        setExportDownloadActive(false);
        await writeBlob(blob);

        const sizeMb = (final.result as { size_mb?: number } | null)?.size_mb;
        setCompletionResult({
          success: true,
          title: 'Export complete',
          message: 'Load-data archive saved successfully.',
          elapsedSeconds: (Date.now() - started) / 1000,
          detailLines: [
            `File: ${fileName}`,
            saveMethod === 'picker'
              ? 'Saved to the location you chose in the save dialog.'
              : 'Saved to your Downloads folder (browser default).',
            typeof sizeMb === 'number' ? `Archive size: ~${sizeMb.toFixed(2)} MB` : '',
          ].filter(Boolean),
        });
        setWizardStep('summary');
        toast.success('Load data exported successfully');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to export load data';
        setCompletionResult({
          success: false,
          title: 'Export failed',
          message,
          elapsedSeconds: (Date.now() - started) / 1000,
        });
        setWizardStep('summary');
        toast.error(`Load-data export failed: ${message}`);
      } finally {
        setIsExporting(false);
        setExportProgress('');
        setActiveTaskId(null);
        setExportDownloadActive(false);
        setIsCancelling(false);
      }
    };

    const canUseSavePicker = 'showSaveFilePicker' in window;

    if (!canUseSavePicker) {
      await runExport(async (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dashboard_export.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'dashboard_export.zip', 'download');
      return;
    }

    let fileHandle: FileSystemFileHandle | null = null;
    try {
      fileHandle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName: 'dashboard_export.zip',
        types: [
          {
            description: 'Compressed load-data export',
            accept: { 'application/zip': ['.zip'] },
          },
        ],
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to open save dialog';
      toast.error(`Export failed: ${message}`);
      return;
    }

    const pickedName = fileHandle?.name ?? 'dashboard_export.zip';
    await runExport(async (blob) => {
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
    }, pickedName, 'picker');
  }, []);

  const blocking = mode === 'export' && wizardStep === 'progress' && isExporting;

  const modalProps: DatabaseOperationModalProps = {
    open: modalOpen,
    onOpenChange: handleOpenChange,
    mode,
    wizardStep,
    blocking,
    exportFileName,
    exportSaveMethod,
    exportDownloadActive,
    taskStatus,
    taskConnectionLost,
    taskConnectionMessage,
    activeTaskId,
    isCancelling,
    onCancelOperation: cancelOperation,
    completionResult,
    onCloseSummary: resetModal,
  };

  return {
    isExporting,
    exportProgress,
    startExport,
    modalProps,
  };
}
