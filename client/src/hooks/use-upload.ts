/**
 * Hook for file upload with progress tracking
 * Single responsibility: Upload orchestration
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadApi } from '@/lib/api/upload';
import type { UploadResponse, UploadMetadata, UploadTaskEvent } from '@/types/upload';
import { useUIStore } from '@/stores/ui-store';

interface UseUploadOptions {
  /** Callback when upload completes successfully */
  onComplete?: (response: UploadResponse) => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
}

interface UseUploadReturn {
  /** Upload files with metadata */
  upload: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata
  ) => Promise<UploadResponse>;
  /** Cancel the current upload */
  cancel: () => void;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
  /** Coarse phase for operation modal stepper */
  progressPhase: UploadProgressPhase;
}

export type UploadProgressPhase = 'uploading' | 'validating' | 'processing';

function applyUploadTaskProgress(
  data: UploadTaskEvent,
  setProgress: (value: number) => void,
  setMessage: (value: string) => void,
  setProgressPhase: (value: UploadProgressPhase) => void,
): void {
  const totalEvents = Math.max(1, data.total_events || 0);
  const completedEvents = Math.max(0, data.completed_events || 0);
  const ratio = completedEvents / totalEvents;

  if (data.phase === 'converting' || data.phase === 'validating') {
    setProgress(Math.min(30, Math.round(10 + ratio * 20)));
    setMessage(
      data.progress_message ??
        (data.phase === 'converting'
          ? 'Converting RSP files...'
          : 'Validating files...'),
    );
    setProgressPhase('validating');
    return;
  }

  const progressMessage =
    data.progress_message ??
    (data.current_event
      ? `Processed ${completedEvents}/${totalEvents}: ${data.current_event}`
      : `Processing events: ${completedEvents}/${totalEvents}`);

  setProgress(Math.min(99, Math.round(30 + ratio * 69)));
  setMessage(progressMessage);
  setProgressPhase('processing');
}

export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [progressPhase, setProgressPhase] = useState<UploadProgressPhase>('uploading');
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const upload = useCallback(
    async (
      dataFiles: File[],
      channelMapFile: File | undefined,
      metadata: UploadMetadata
    ): Promise<UploadResponse> => {
      cancelledRef.current = false;
      abortRef.current = new AbortController();
      const { setFolderUploadInProgress } = useUIStore.getState();
      setFolderUploadInProgress(true);
      setIsUploading(true);
      setProgress(0);
      setMessage('Uploading files...');
      setProgressPhase('uploading');

      try {
        const start = await uploadApi.startFolderUpload(
          dataFiles,
          channelMapFile,
          metadata,
          (percent, isProcessing) => {
            if (isProcessing) {
              setProgress(10);
              setMessage('Processing on server (this may take a few minutes)...');
              setProgressPhase('uploading');
            } else {
              setProgress(Math.round(percent * 0.1));
              setMessage('Uploading files...');
              setProgressPhase('uploading');
            }
          },
          abortRef.current.signal,
        );

        setProgress(10);
        setMessage('Validating files...');
        setProgressPhase('validating');

        const finalEvent = await uploadApi.waitForUploadTask(
          start.task_id,
          (data) => {
            if (cancelledRef.current) return;
            applyUploadTaskProgress(data, setProgress, setMessage, setProgressPhase);
          },
          (state) => {
            if (cancelledRef.current) return;
            if (state.connectionLost && state.message) {
              setMessage(state.message);
            }
          },
        );

        const response = finalEvent.result;
        if (!response) {
          throw new Error('Upload completed without result');
        }

        setProgress(100);
        setMessage(
          response.pending_channel_map
            ? `Complete: ${response.files.length} files pending channel map`
            : `Complete: ${response.files.length} files processed`
        );
        setProgressPhase('processing');

        options.onComplete?.(response);
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessage('Upload cancelled');
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        setMessage(errorMessage);
        options.onError?.(errorMessage);
        throw error;
      } finally {
        abortRef.current = null;
        setFolderUploadInProgress(false);
        setIsUploading(false);
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    useUIStore.getState().setFolderUploadInProgress(false);
    setIsUploading(false);
    setProgress(0);
    setMessage('');
    setProgressPhase('uploading');
  }, []);

  return {
    upload,
    cancel,
    isUploading,
    progress,
    message,
    progressPhase,
  };
}
