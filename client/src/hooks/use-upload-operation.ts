'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { showShortInfoToast } from '@/lib/feedback/short-info-toast';
import type { UploadMetadata, UploadResponse } from '@/types/upload';
import { UploadTaskCancelledError, useUpload } from '@/hooks/use-upload';
import {
  buildUploadCancelledResult,
  buildUploadCompletionResult,
  buildUploadFailedResult,
} from '@/features/database-upload/upload-completion-result';
import type {
  UploadCompletionResult,
  UploadOperationModalProps,
  UploadWizardStep,
} from '@/features/database-upload/upload-operation-types';

export interface UseUploadOperationOptions {
  onComplete?: (response: UploadResponse) => void | Promise<void>;
  onError?: (error: string) => void;
}

export interface UseUploadOperationReturn {
  startUpload: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata,
  ) => Promise<void>;
  modalProps: UploadOperationModalProps;
  isBusy: boolean;
  recoverTask: (taskId: string) => Promise<void>;
}

export function useUploadOperation({
  onComplete,
  onError,
}: UseUploadOperationOptions = {}): UseUploadOperationReturn {
  const [open, setOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<UploadWizardStep>('progress');
  const [blocking, setBlocking] = useState(false);
  const [completionResult, setCompletionResult] = useState<UploadCompletionResult | null>(null);

  const reset = useCallback(() => {
    setWizardStep('progress');
    setBlocking(false);
    setCompletionResult(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && blocking) return;
      if (!next) {
        reset();
      }
      setOpen(next);
    },
    [blocking, reset],
  );

  const finishWithSummary = useCallback((result: UploadCompletionResult) => {
    setCompletionResult(result);
    setWizardStep('summary');
    setBlocking(false);
  }, []);

  const { upload, recover, cancel, isUploading, isCancelling, progress, message, progressPhase } = useUpload({
    onComplete: undefined,
    onError: undefined,
  });

  const startUpload = useCallback(
    async (
      dataFiles: File[],
      channelMapFile: File | undefined,
      metadata: UploadMetadata,
    ) => {
      setOpen(true);
      setWizardStep('progress');
      setBlocking(true);
      setCompletionResult(null);
      showShortInfoToast('Import started');

      const startedAt = Date.now();

      try {
        const response = await upload(dataFiles, channelMapFile, metadata);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        finishWithSummary(buildUploadCompletionResult({ response, elapsedSeconds }));
        toast.success('Import complete');
        await onComplete?.(response);
      } catch (error) {
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        if (error instanceof UploadTaskCancelledError) {
          finishWithSummary(buildUploadCancelledResult(elapsedSeconds));
          showShortInfoToast('Import cancelled');
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          reset();
          setOpen(false);
          return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        finishWithSummary(buildUploadFailedResult({ errorMessage, elapsedSeconds }));
        toast.error('Import failed');
        onError?.(errorMessage);
      }
    },
    [finishWithSummary, onComplete, onError, reset, upload],
  );

  const handleCancelUpload = useCallback(async () => {
    try {
      await cancel();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not request cancellation.';
      toast.error(errorMessage);
    }
  }, [cancel]);

  const closeSummary = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  const recoverTask = useCallback(
    async (taskId: string) => {
      setOpen(true);
      setWizardStep('progress');
      setBlocking(true);
      setCompletionResult(null);
      const startedAt = Date.now();
      try {
        const response = await recover(taskId);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        finishWithSummary(buildUploadCompletionResult({ response, elapsedSeconds }));
      } catch (error) {
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        if (error instanceof UploadTaskCancelledError) {
          finishWithSummary(buildUploadCancelledResult(elapsedSeconds));
          return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Upload recovery failed';
        finishWithSummary(buildUploadFailedResult({ errorMessage, elapsedSeconds }));
      }
    },
    [finishWithSummary, recover],
  );

  return {
    startUpload,
    recoverTask,
    isBusy: isUploading || open,
    modalProps: {
      open,
      onOpenChange: handleOpenChange,
      wizardStep,
      blocking,
      progress,
      progressPhase,
      progressMessage: message,
      isCancelling,
      completionResult,
      onCancelUpload: handleCancelUpload,
      onCloseSummary: closeSummary,
    },
  };
}
