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
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [progressPhase, setProgressPhase] = useState<UploadProgressPhase>('upload_received');
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
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

        setProgressState({
          progress: Math.max(progressStateRef.current.progress, 10),
          progressPhase: 'upload_received',
          message: 'Upload received by server...',
        });

        const finalEvent = await uploadApi.waitForUploadTask(
          start.task_id,
          (data) => {
            if (cancelledRef.current) return;
            setProgressState(applyUploadTaskProgress(data, progressStateRef.current));
          },
          (state) => {
            if (cancelledRef.current) return;
            if (state.connectionLost && state.message) {
              setProgressState({
                ...progressStateRef.current,
                message: state.message,
              });
            }
          },
        );

        const response = finalEvent.result;
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
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setProgressState({
            ...progressStateRef.current,
            message: 'Upload cancelled',
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
        abortRef.current = null;
        setFolderUploadInProgress(false);
        setIsUploading(false);
      }
    },
    [options, setProgressState]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    useUIStore.getState().setFolderUploadInProgress(false);
    setIsUploading(false);
    setProgressState({
      progress: 0,
      progressPhase: 'upload_received',
      message: '',
    });
  }, [setProgressState]);

  return {
    upload,
    cancel,
    isUploading,
    progress,
    message,
    progressPhase,
  };
}
