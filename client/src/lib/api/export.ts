/**
 * Export API — Parquet + ZIP portability (admin-only on server).
 */

import { APIError, fetchJsonGet, getApiBaseUrl } from './client';

export interface StartTaskResponse {
  task_id: string;
}

export interface TaskStatusResponse {
  task_id: string;
  kind: string;
  status: string;
  progress: string;
  /** Server-reported phase: exporting, compressing, pending_download, downloading, completed, failed, cancelled */
  phase: string;
  /** Reserved for compatibility; export currently does not use sub-phases. */
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
  /** Server max size for large upload payloads (MB) */
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
        message: 'Export task state is no longer available.',
      };
    }
    if (RETRYABLE_POLL_STATUSES.has(error.status)) {
      return {
        retryable: true,
        message: 'Waiting for server… export may still be running.',
      };
    }
    return { retryable: false, message: error.message };
  }

  if (error instanceof TypeError) {
    return {
      retryable: true,
      message: 'Waiting for server… export may still be running.',
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

  getParquetTaskStatus: async (taskId: string): Promise<TaskStatusResponse> =>
    fetchJsonGet(`${getApiBaseUrl()}/api/v1/export/database/parquet/task/${taskId}`),

  downloadParquetExport: async (taskId: string): Promise<Blob> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/download/${taskId}`,
      { method: 'GET' },
    );
    return response.blob();
  },

  /** Cancel a running export background task (best-effort). */
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
            'Lost contact with the server during export. Check server logs before retrying.',
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
