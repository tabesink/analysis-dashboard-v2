/**
 * Hook for file upload with progress tracking
 * Single responsibility: Upload orchestration
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadApi } from '@/lib/api/upload';
import type {
  UploadResponse,
  UploadMetadata,
  UploadTaskEvent,
  UploadProgressPhase,
} from '@/types/upload';
import { useUIStore } from '@/stores/ui-store';

const FOLDER_UPLOAD_TASK_KIND = 'folder_upload';
const PHASE_ORDER: UploadProgressPhase[] = ['upload_received', 'converting', 'validating', 'writing'];

interface UploadProgressState {
  progress: number;
  progressPhase: UploadProgressPhase;
  message: string;
}

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
  cancel: () => Promise<void>;
  /** Resume polling an already-started task */
  recover: (taskId: string) => Promise<UploadResponse>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
  /** Coarse phase for operation modal stepper */
  progressPhase: UploadProgressPhase;
  /** Whether server-side cancellation is in progress */
  isCancelling: boolean;
}

export class UploadTaskCancelledError extends Error {
  constructor(message = 'Upload cancelled safely by server request.') {
    super(message);
    this.name = 'UploadTaskCancelledError';
  }
}

const phaseRank = (phase: UploadProgressPhase): number => PHASE_ORDER.indexOf(phase);

function toKnownProgressPhase(phase: string): UploadProgressPhase | null {
  if (phase === 'upload_received') return 'upload_received';
  if (phase === 'converting') return 'converting';
  if (phase === 'validating') return 'validating';
  if (phase === 'writing') return 'writing';
  return null;
}

function estimatedProgress(phase: UploadProgressPhase, ratio: number): number {
  if (phase === 'upload_received') return 5;
  if (phase === 'converting') return Math.round(10 + ratio * 25);
  if (phase === 'validating') return Math.round(35 + ratio * 30);
  return Math.round(65 + ratio * 34);
}

function defaultProgressMessage(
  phase: UploadProgressPhase,
  completedEvents: number,
  totalEvents: number,
  currentEvent: string | undefined,
): string {
  if (phase === 'upload_received') {
    return 'Upload received by server...';
  }
  if (phase === 'converting') {
    return 'Converting source files...';
  }
  if (phase === 'validating') {
    return 'Validating files...';
  }
  if (currentEvent) {
    return `Processed ${completedEvents}/${totalEvents}: ${currentEvent}`;
  }
  return `Processing events: ${completedEvents}/${totalEvents}`;
}

export function applyUploadTaskProgress(
  data: UploadTaskEvent,
  previous: UploadProgressState,
): UploadProgressState {
  if (data.task_kind && data.task_kind !== FOLDER_UPLOAD_TASK_KIND) {
    return {
      ...previous,
      message: 'Waiting for folder upload status...',
    };
  }

  if (data.status === 'cancelling') {
    return {
      ...previous,
      message: data.progress_message || 'Cancelling safely...',
    };
  }

  const incomingPhase = toKnownProgressPhase(data.phase);
  if (!incomingPhase) {
    return previous;
  }

  const totalEvents = Math.max(1, data.total_events || 0);
  const completedEvents = Math.max(0, data.completed_events || 0);
  const ratio = completedEvents / totalEvents;
  const stabilizedPhase =
    phaseRank(previous.progressPhase) > phaseRank(incomingPhase)
      ? previous.progressPhase
      : incomingPhase;
  const progress = Math.min(99, Math.max(previous.progress, estimatedProgress(stabilizedPhase, ratio)));
  const message =
    data.progress_message ??
    defaultProgressMessage(stabilizedPhase, completedEvents, totalEvents, data.current_event);

  return {
    progress,
    progressPhase: stabilizedPhase,
    message,
  };
}

export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [progressPhase, setProgressPhase] = useState<UploadProgressPhase>('upload_received');
  const abortRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const progressStateRef = useRef<UploadProgressState>({
    progress: 0,
    progressPhase: 'upload_received',
    message: '',
  });

  const setProgressState = useCallback((next: UploadProgressState) => {
    progressStateRef.current = next;
    setProgress(next.progress);
    setProgressPhase(next.progressPhase);
    setMessage(next.message);
  }, []);

  const awaitTaskResult = useCallback(
    async (taskId: string): Promise<UploadResponse> => {
      taskIdRef.current = taskId;
      const finalEvent = await uploadApi.waitForUploadTask(
        taskId,
        (data) => {
          setProgressState(applyUploadTaskProgress(data, progressStateRef.current));
          setIsCancelling(data.status === 'cancelling');
        },
        (state) => {
          if (state.connectionLost && state.message) {
            setProgressState({
              ...progressStateRef.current,
              message: state.message,
            });
          }
        },
      );

      const response = finalEvent.result;
      if (finalEvent.status === 'cancelled') {
        throw new UploadTaskCancelledError(finalEvent.progress_message || undefined);
      }
      if (!response) {
        throw new Error('Upload completed without result');
      }

      setProgressState({
        progress: 100,
        progressPhase: 'writing',
        message: response.pending_channel_map
          ? `Complete: ${response.files.length} files pending channel map`
          : `Complete: ${response.files.length} files processed`,
      });
      options.onComplete?.(response);
      return response;
    },
    [options, setProgressState],
  );

  const upload = useCallback(
    async (
      dataFiles: File[],
      channelMapFile: File | undefined,
      metadata: UploadMetadata
    ): Promise<UploadResponse> => {
      taskIdRef.current = null;
      abortRef.current = new AbortController();
      const { setFolderUploadInProgress } = useUIStore.getState();
      setFolderUploadInProgress(true);
      setIsUploading(true);
      setIsCancelling(false);
      setProgressState({
        progress: 0,
        progressPhase: 'upload_received',
        message: 'Uploading files...',
      });

      try {
        const start = await uploadApi.startFolderUpload(
          dataFiles,
          channelMapFile,
          metadata,
          (percent, isProcessing) => {
            if (isProcessing) {
              setProgressState({
                progress: 10,
                progressPhase: 'upload_received',
                message: 'Processing on server (this may take a few minutes)...',
              });
            } else {
              setProgressState({
                progress: Math.round(percent * 0.1),
                progressPhase: 'upload_received',
                message: 'Uploading files...',
              });
            }
          },
          abortRef.current.signal,
        );
        taskIdRef.current = start.task_id;

        setProgressState({
          progress: Math.max(progressStateRef.current.progress, 10),
          progressPhase: 'upload_received',
          message: 'Upload received by server...',
        });

        return await awaitTaskResult(start.task_id);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setProgressState({
            ...progressStateRef.current,
            message: 'Upload cancelled',
          });
          throw error;
        }
        if (error instanceof UploadTaskCancelledError) {
          setProgressState({
            ...progressStateRef.current,
            message: 'Upload cancelled safely.',
          });
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        setProgressState({
          ...progressStateRef.current,
          message: errorMessage,
        });
        options.onError?.(errorMessage);
        throw error;
      } finally {
        taskIdRef.current = null;
        abortRef.current = null;
        setIsCancelling(false);
        setFolderUploadInProgress(false);
        setIsUploading(false);
      }
    },
    [awaitTaskResult, options, setProgressState]
  );

  const recover = useCallback(
    async (taskId: string): Promise<UploadResponse> => {
      const { setFolderUploadInProgress } = useUIStore.getState();
      setFolderUploadInProgress(true);
      setIsUploading(true);
      setIsCancelling(false);
      setProgressState({
        progress: Math.max(progressStateRef.current.progress, 5),
        progressPhase: 'upload_received',
        message: 'Reconnecting to upload task...',
      });

      try {
        return await awaitTaskResult(taskId);
      } catch (error) {
        if (error instanceof UploadTaskCancelledError) {
          setProgressState({
            ...progressStateRef.current,
            message: 'Upload cancelled safely.',
          });
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Upload recovery failed';
        setProgressState({
          ...progressStateRef.current,
          message: errorMessage,
        });
        options.onError?.(errorMessage);
        throw error;
      } finally {
        taskIdRef.current = null;
        abortRef.current = null;
        setIsCancelling(false);
        setFolderUploadInProgress(false);
        setIsUploading(false);
      }
    },
    [awaitTaskResult, options, setProgressState],
  );

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current;
    if (!taskId) {
      abortRef.current?.abort();
      useUIStore.getState().setFolderUploadInProgress(false);
      setIsUploading(false);
      setProgressState({
        progress: 0,
        progressPhase: 'upload_received',
        message: '',
      });
      return;
    }

    setIsCancelling(true);
    setProgressState({
      ...progressStateRef.current,
      message: 'Cancelling safely...',
    });
    await uploadApi.cancelUploadTask(taskId);
  }, [setProgressState]);

  return {
    upload,
    recover,
    cancel,
    isUploading,
    isCancelling,
    progress,
    message,
    progressPhase,
  };
}
