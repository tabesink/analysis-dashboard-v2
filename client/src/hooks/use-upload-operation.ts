'use client';

import { useCallback, useState } from 'react';
import type { UploadMetadata, UploadResponse } from '@/types/upload';
import { useUpload } from '@/hooks/use-upload';
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
}

function buildSuccessResult(
  response: UploadResponse,
  elapsedSeconds: number,
): UploadCompletionResult {
  const detailLines = [
    `${response.files.length} file${response.files.length === 1 ? '' : 's'} imported`,
    `${response.event_ids.length} event${response.event_ids.length === 1 ? '' : 's'} created`,
  ];
  if (response.pending_channel_map) {
    detailLines.push('Channel map still required before events can be plotted');
  }

  return {
    success: true,
    title: response.pending_channel_map ? 'Import complete (map pending)' : 'Import complete',
    message: response.pending_channel_map
      ? 'Events were created. Define the channel map in Edit Metadata before plotting.'
      : 'Files were uploaded and processed successfully.',
    elapsedSeconds,
    detailLines,
  };
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

  const { upload, cancel, isUploading, progress, message, progressPhase } = useUpload({
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

      const startedAt = Date.now();

      try {
        const response = await upload(dataFiles, channelMapFile, metadata);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        finishWithSummary(buildSuccessResult(response, elapsedSeconds));
        await onComplete?.(response);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          reset();
          setOpen(false);
          return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        finishWithSummary({
          success: false,
          title: 'Import failed',
          message: errorMessage,
          elapsedSeconds,
        });
        onError?.(errorMessage);
      }
    },
    [finishWithSummary, onComplete, onError, reset, upload],
  );

  const handleCancelUpload = useCallback(() => {
    cancel();
    reset();
    setOpen(false);
  }, [cancel, reset]);

  const closeSummary = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  return {
    startUpload,
    isBusy: isUploading || open,
    modalProps: {
      open,
      onOpenChange: handleOpenChange,
      wizardStep,
      blocking,
      progress,
      progressPhase,
      progressMessage: message,
      completionResult,
      onCancelUpload: handleCancelUpload,
      onCloseSummary: closeSummary,
    },
  };
}
