/**
 * Upload API functions
 * Single responsibility: HTTP calls only
 */

import { APIError, get, del, post, postFormDataWithProgress, getApiBaseUrl } from './client';
import type {
  UploadResponse,
  UploadTaskStartResponse,
  UploadTaskEvent,
  DatasetInfo,
  DatasetListResponse,
  UploadMetadata,
  DeleteEventResponse,
  DeleteEventsResponse,
  DeleteProgramVersionScopeRequest,
  DeleteProgramVersionScopeResponse,
} from '@/types/upload';

// Re-export types for convenience
export type { UploadResponse, UploadTaskStartResponse, UploadTaskEvent, DatasetInfo, UploadMetadata };

/**
 * Optional metadata fields for upload
 */
const OPTIONAL_METADATA_FIELDS = [
  'job_number',
  'work_order',
  'rfq',
  'dv',
  'pv',
  'post_prod',
  'suspension_component',
  'axle_location',
  'gvw',
  'gross_vehicle_weight_range_lbs',
  'fgawr',
  'fgawr_range_lbs',
  'rgawr',
  'rgawr_range_lbs',
  'drive_type',
  'material_construction',
  'steering_position',
  'damper_type',
  'vehicle_type',
  'status',
] as const;

const DATA_UPLOAD_TIMEOUT_MS = 3_600_000; // 60 minutes for large local-network uploads
const POLL_MS = 2000;
const RETRYABLE_POLL_STATUSES = new Set([502, 503, 504]);
const TASK_POLL_RETRY_WINDOW_MS = DATA_UPLOAD_TIMEOUT_MS;
const TASK_POLL_MAX_BACKOFF_MS = 30_000;

export interface UploadTaskPollConnectionState {
  connectionLost: boolean;
  message?: string;
}

interface RetryablePollError {
  retryable: boolean;
  message: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyUploadTaskPollError(error: unknown): RetryablePollError {
  if (error instanceof APIError) {
    if (error.status === 404) {
      return {
        retryable: false,
        message:
          'Upload task state is no longer available. The server may have restarted; check server logs before retrying.',
      };
    }
    if (RETRYABLE_POLL_STATUSES.has(error.status)) {
      return {
        retryable: true,
        message: 'Waiting for server… upload may still be running.',
      };
    }
    return { retryable: false, message: error.message };
  }

  if (error instanceof TypeError) {
    return {
      retryable: true,
      message: 'Waiting for server… upload may still be running.',
    };
  }

  return {
    retryable: false,
    message: error instanceof Error ? error.message : 'Failed to poll upload task status',
  };
}

function nextPollBackoff(previousMs: number): number {
  if (previousMs <= 0) return POLL_MS;
  return Math.min(previousMs * 2, TASK_POLL_MAX_BACKOFF_MS);
}

export const uploadApi = {
  buildFolderUploadFormData: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata,
  ): FormData => {
    const formData = new FormData();

    dataFiles.forEach((file) => {
      formData.append('files', file);
    });
    if (channelMapFile) {
      formData.append('channel_map', channelMapFile);
    }
    formData.append('program_id', metadata.program_id);
    formData.append('version', metadata.version);

    OPTIONAL_METADATA_FIELDS.forEach((field) => {
      const value = metadata[field];
      if (typeof value === 'boolean') {
        formData.append(field, String(value));
        return;
      }
      if (value) formData.append(field, value);
    });
    return formData;
  },

  /**
   * Start async data upload task
   * Matches: POST /api/v1/upload/folder/start
   */
  startFolderUpload: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata,
    onProgress?: (percent: number, isProcessing: boolean) => void,
    signal?: AbortSignal,
  ): Promise<UploadTaskStartResponse> => {
    const formData = uploadApi.buildFolderUploadFormData(dataFiles, channelMapFile, metadata);
    return postFormDataWithProgress<UploadTaskStartResponse>(
      '/api/v1/upload/folder/start',
      formData,
      onProgress,
      DATA_UPLOAD_TIMEOUT_MS,
      signal,
    );
  },

  /**
   * Build EventSource URL for upload progress stream.
   * @deprecated Client uses GET task polling; SSE retained for backward compatibility.
   */
  getFolderUploadEventsUrl: (taskId: string): string => {
    return `${getApiBaseUrl()}/api/v1/upload/folder/events/${taskId}`;
  },

  /**
   * Poll upload task status.
   * Matches: GET /api/v1/upload/folder/task/{task_id}
   */
  getUploadTaskStatus: async (taskId: string): Promise<UploadTaskEvent> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/v1/upload/folder/task/${taskId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new APIError(response.status, response.statusText, body);
    }

    return response.json();
  },

  /**
   * Poll until upload task completes or fails.
   */
  waitForUploadTask: async (
    taskId: string,
    onUpdate?: (event: UploadTaskEvent) => void,
    onConnectionStateChange?: (state: UploadTaskPollConnectionState) => void,
  ): Promise<UploadTaskEvent> => {
    const retryStartedAt = { current: 0 };
    let backoffMs = 0;

    for (;;) {
      try {
        const event = await uploadApi.getUploadTaskStatus(taskId);
        retryStartedAt.current = 0;
        backoffMs = 0;
        onConnectionStateChange?.({ connectionLost: false });
        onUpdate?.(event);
        if (event.status === 'failed') {
          throw new Error(event.error || 'Upload failed');
        }
        if (event.status === 'completed') {
          return event;
        }
        await sleep(POLL_MS);
      } catch (error) {
        const classified = classifyUploadTaskPollError(error);
        if (!classified.retryable) {
          throw error instanceof Error ? error : new Error(classified.message);
        }

        const now = Date.now();
        if (retryStartedAt.current === 0) {
          retryStartedAt.current = now;
        }
        if (now - retryStartedAt.current > TASK_POLL_RETRY_WINDOW_MS) {
          throw new Error(
            'Lost contact with the server during upload. Check server logs before retrying.',
          );
        }

        onConnectionStateChange?.({
          connectionLost: true,
          message: classified.message,
        });
        backoffMs = nextPollBackoff(backoffMs);
        await sleep(backoffMs);
      }
    }
  },

  /**
   * List every non-deleted uploaded dataset plus global facets.
   * Matches: GET /api/v1/upload/datasets
   */
  listDatasets: (timeoutMs?: number): Promise<DatasetListResponse> =>
    get<DatasetListResponse>(`/api/v1/upload/datasets`, timeoutMs),

  /**
   * Delete a single dataset
   * Matches: DELETE /api/v1/upload/events/{event_id}
   */
  deleteDataset: (eventId: string): Promise<DeleteEventResponse> =>
    del<DeleteEventResponse>(`/api/v1/upload/events/${eventId}`),

  /**
   * Bulk delete datasets
   * Matches: POST /api/v1/upload/events/delete (using POST for body support)
   */
  deleteDatasets: (eventIds: string[]): Promise<DeleteEventsResponse> =>
    post<DeleteEventsResponse>('/api/v1/upload/events/delete', {
      event_ids: eventIds,
    }),

  /**
   * Hard-delete a full program or program/version scope.
   */
  deleteProgramVersionScope: (
    payload: DeleteProgramVersionScopeRequest,
  ): Promise<DeleteProgramVersionScopeResponse> =>
    post<DeleteProgramVersionScopeResponse>(
      '/api/v1/upload/program-version/delete',
      payload,
    ),
};
