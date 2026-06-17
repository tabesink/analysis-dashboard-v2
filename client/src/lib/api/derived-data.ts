/**
 * Derived-data task API functions.
 */

import { APIError, fetchJsonGet, getApiBaseUrl, post } from './client';
import {
  waitForTaskStatus,
  type TaskPollConnectionState,
} from '@/lib/api/task-polling';
import type { DerivedTaskStatusEvent } from '@/types/api';
import type { UploadTaskCancelResponse } from '@/types/upload';

const POLL_MS = 2000;
const TASK_POLL_RETRY_WINDOW_MS = 3_600_000;
const TASK_POLL_MAX_BACKOFF_MS = 30_000;

function classifyDerivedTaskPollError(error: unknown): {
  retryable: boolean;
  message: string;
} {
  if (error instanceof APIError) {
    if (error.status >= 500 || error.status === 429 || error.status === 408) {
      return {
        retryable: true,
        message: 'Lost contact with the server. Retrying…',
      };
    }
    return { retryable: false, message: error.statusText };
  }
  if (error instanceof TypeError) {
    return {
      retryable: true,
      message: 'Lost contact with the server. Retrying…',
    };
  }
  return {
    retryable: false,
    message: error instanceof Error ? error.message : 'Task polling failed',
  };
}

export type DerivedTaskPollConnectionState = TaskPollConnectionState;

export const derivedDataApi = {
  getDerivedDataTaskStatus: async (taskId: string): Promise<DerivedTaskStatusEvent> =>
    fetchJsonGet(`${getApiBaseUrl()}/api/v1/dashboard/derived-data/task/${taskId}`),

  cancelDerivedDataTask: (taskId: string): Promise<UploadTaskCancelResponse> =>
    post<UploadTaskCancelResponse>(`/api/v1/dashboard/derived-data/task/${taskId}/cancel`, {}),

  waitForDerivedDataTask: async (
    taskId: string,
    onUpdate?: (event: DerivedTaskStatusEvent) => void,
    onConnectionStateChange?: (state: DerivedTaskPollConnectionState) => void,
  ): Promise<DerivedTaskStatusEvent> => {
    return waitForTaskStatus({
      fetchStatus: () => derivedDataApi.getDerivedDataTaskStatus(taskId),
      isTerminal: (event) =>
        event.status === 'failed' ||
        event.status === 'completed' ||
        event.status === 'cancelled',
      onUpdate,
      onConnectionStateChange,
      pollMs: POLL_MS,
      retryWindowMs: TASK_POLL_RETRY_WINDOW_MS,
      retryMaxBackoffMs: TASK_POLL_MAX_BACKOFF_MS,
      classifyError: classifyDerivedTaskPollError,
      timeoutMessage:
        'Lost contact with the server during processing. Check server logs before retrying.',
    });
  },
};
