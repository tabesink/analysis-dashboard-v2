/**
 * Export/Import API — Parquet + ZIP portability (admin-only on server).
 */

import { APIError, getApiBaseUrl, postFormDataWithProgress } from './client';

export interface SchemaCompatibility {
  is_compatible: boolean;
  is_legacy: boolean;
  imported_schema_version: number | null;
  current_schema_version: number;
  schema_version_match: boolean;
  missing_columns: string[];
  extra_columns: string[];
}

export interface DatabaseValidationResponse {
  valid: boolean;
  event_count: number;
  size_mb: number;
  tables: string[];
  schema_compatibility: SchemaCompatibility;
  warnings: string[];
}

export interface UploadAndValidateResponse {
  upload_id: string;
  validation: DatabaseValidationResponse;
}

export interface StartTaskResponse {
  task_id: string;
}

export interface TaskStatusResponse {
  task_id: string;
  kind: string;
  status: string;
  progress: string;
  /** Server-reported phase: exporting, compressing, pending_download, downloading, extracting, importing, completed, failed, cancelled */
  phase: string;
  /** Stable import sub-phase: backing_up, clearing, loading, finalizing */
  sub_phase?: string;
  current: number;
  total: number;
  current_table: string | null;
  events_loaded: number | null;
  error: string | null;
  result: Record<string, unknown> | null;
  /** Server-side timestamp for the last task update, in Unix seconds. */
  updated_at?: number;
}

export interface DatabaseInfoResponse {
  path: string;
  size_mb: number;
  event_count: number;
  program_count: number;
  /** Server max size for database import ZIP (MB) */
  max_upload_size_mb: number;
}

export interface DatabaseCatalogResponse {
  current_database: string;
  current_path: string;
  databases: string[];
}

export interface CreateDatabaseResponse {
  created_database: string;
  created_path: string;
  current_database: string;
  current_path: string;
  databases: string[];
}

export interface DeleteDatabaseResponse {
  deleted_database: string;
  current_database: string;
  current_path: string;
  databases: string[];
}

export interface SwitchDatabaseResponse {
  active_database: string;
  active_path: string;
  previous_database: string;
  previous_path: string;
  databases: string[];
}

async function fetchWithCredentials(
  path: string,
  options: RequestInit,
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? (body as { detail?: unknown }).detail : undefined;
    if (typeof detail === 'string') {
      throw new Error(detail);
    }
    throw new APIError(response.status, response.statusText, body);
  }

  return response;
}

const POLL_MS = 2000;
const RETRYABLE_POLL_STATUSES = new Set([502, 503, 504]);
const TASK_POLL_RETRY_WINDOW_MS = 15 * 60 * 1000;
const TASK_POLL_MAX_BACKOFF_MS = 30_000;
/** Large DB ZIP imports (multi-GB) */
const PARQUET_ZIP_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface TaskPollConnectionState {
  connectionLost: boolean;
  message?: string;
}

interface RetryablePollError {
  retryable: boolean;
  message: string;
}

function classifyTaskPollError(error: unknown): RetryablePollError {
  if (error instanceof APIError) {
    if (error.status === 404) {
      return {
        retryable: false,
        message:
          'Import task state is no longer available. The server may have restarted; check server logs for Database imported, Import task failed, OOM, or killed before retrying.',
      };
    }
    if (RETRYABLE_POLL_STATUSES.has(error.status)) {
      return {
        retryable: true,
        message: 'Waiting for server… import may still be running.',
      };
    }
    return { retryable: false, message: error.message };
  }

  if (error instanceof TypeError) {
    return {
      retryable: true,
      message: 'Waiting for server… import may still be running.',
    };
  }

  return {
    retryable: false,
    message: error instanceof Error ? error.message : 'Failed to poll task status',
  };
}

function nextPollBackoff(previousMs: number): number {
  if (previousMs <= 0) return POLL_MS;
  return Math.min(previousMs * 2, TASK_POLL_MAX_BACKOFF_MS);
}

export interface InferredImportOutcome {
  likelySucceeded: boolean;
  message: string;
  eventCount?: number;
}

export async function inferImportOutcomeAfterTaskLost(
  validation: DatabaseValidationResponse | null,
): Promise<InferredImportOutcome> {
  if (!validation?.valid) {
    return {
      likelySucceeded: false,
      message:
        'Import task status was lost before completion. Check server logs before retrying.',
    };
  }

  try {
    const info = await exportApi.getDatabaseInfo();
    const archiveEvents = validation.event_count;
    if (info.event_count === archiveEvents) {
      return {
        likelySucceeded: true,
        message: `The live database now has ${info.event_count.toLocaleString()} events, matching the import archive. The import may have finished before task status was lost (for example, a server restart). Verify dashboards before importing again.`,
        eventCount: info.event_count,
      };
    }
    return {
      likelySucceeded: false,
      message: `Task status was lost. The live database has ${info.event_count.toLocaleString()} events; the archive had ${archiveEvents.toLocaleString()}. The import likely did not finish cleanly — check server logs before retrying.`,
      eventCount: info.event_count,
    };
  } catch {
    return {
      likelySucceeded: false,
      message:
        'Import task status was lost and the database could not be checked. See server logs for Database imported or Import task failed before retrying.',
    };
  }
}

export const exportApi = {
  listDatabases: async (): Promise<DatabaseCatalogResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/list', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  createNewDatabase: async (name: string): Promise<CreateDatabaseResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/create-new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  connectDatabase: async (databaseName: string): Promise<SwitchDatabaseResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database_name: databaseName,
      }),
    });
    return response.json();
  },

  deleteDatabase: async (
    databaseName: string,
    confirmation: string,
  ): Promise<DeleteDatabaseResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database_name: databaseName,
        confirmation,
      }),
    });
    return response.json();
  },

  getDatabaseInfo: async (): Promise<DatabaseInfoResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/info', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  /** Start background Parquet export; poll task then download. */
  startParquetExport: async (): Promise<StartTaskResponse> => {
    const response = await fetchWithCredentials(
      '/api/v1/export/database/parquet/export/start',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.json();
  },

  getParquetTaskStatus: async (taskId: string): Promise<TaskStatusResponse> => {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/export/database/parquet/task/${taskId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new APIError(response.status, response.statusText, body);
    }

    return response.json();
  },

  downloadParquetExport: async (taskId: string): Promise<Blob> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/download/${taskId}`,
      { method: 'GET' },
    );
    return response.blob();
  },

  /**
   * Stream ZIP to server once; returns upload_id + validation for the modal.
   * Uses XHR for upload progress events and a long timeout for multi-GB files.
   */
  uploadParquetZip: async (
    file: File,
    options?: {
      onProgress?: (percent: number, isProcessing: boolean) => void;
      signal?: AbortSignal;
    },
  ): Promise<UploadAndValidateResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return postFormDataWithProgress<UploadAndValidateResponse>(
      '/api/v1/export/database/parquet/upload',
      formData,
      options?.onProgress,
      PARQUET_ZIP_UPLOAD_TIMEOUT_MS,
      options?.signal,
    );
  },

  startParquetImport: async (uploadId: string): Promise<StartTaskResponse> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/import/${uploadId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.json();
  },

  cancelParquetUpload: async (uploadId: string): Promise<void> => {
    await fetchWithCredentials(`/api/v1/export/database/parquet/upload/${uploadId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /** Cancel a running export/import background task (best-effort). */
  cancelParquetTask: async (taskId: string): Promise<void> => {
    await fetchWithCredentials(`/api/v1/export/database/parquet/task/${taskId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /**
   * Poll until task completes, fails, or is cancelled. Invokes onUpdate between polls.
   */
  waitForParquetTask: async (
    taskId: string,
    onUpdate?: (s: TaskStatusResponse) => void,
    onConnectionStateChange?: (state: TaskPollConnectionState) => void,
  ): Promise<TaskStatusResponse> => {
    const retryStartedAt = { current: 0 };
    let backoffMs = 0;

    for (;;) {
      try {
        const s = await exportApi.getParquetTaskStatus(taskId);
        retryStartedAt.current = 0;
        backoffMs = 0;
        onConnectionStateChange?.({ connectionLost: false });
        onUpdate?.(s);
        if (
          s.status === 'completed' ||
          s.status === 'failed' ||
          s.status === 'cancelled'
        ) {
          return s;
        }
        await sleep(POLL_MS);
      } catch (error) {
        const classified = classifyTaskPollError(error);
        if (!classified.retryable) {
          throw new Error(classified.message);
        }

        const now = Date.now();
        if (retryStartedAt.current === 0) {
          retryStartedAt.current = now;
        }
        if (now - retryStartedAt.current > TASK_POLL_RETRY_WINDOW_MS) {
          throw new Error(
            'Lost contact with the server during import. Check server logs for Database imported, Import task failed, OOM, or killed before retrying.',
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
};
