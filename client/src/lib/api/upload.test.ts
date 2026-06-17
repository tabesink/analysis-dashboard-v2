import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadApi } from './upload';
import { del, get, post } from './client';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();

  return {
    ...actual,
    getApiBaseUrl: () => 'http://localhost:8000',
    get: vi.fn(),
    del: vi.fn(),
    post: vi.fn(),
    postFormDataWithProgress: vi.fn(),
  };
});

describe('upload api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waitForUploadTask resolves when task completes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            status: 'running',
            phase: 'writing',
            completed_events: 1,
            total_events: 2,
            current_event: 'event_a',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            status: 'completed',
            phase: 'completed',
            completed_events: 2,
            total_events: 2,
            result: {
              success: true,
              files: [],
              event_ids: ['event_a', 'event_b'],
              total_rows: 20,
              pending_channel_map: false,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const task = uploadApi.waitForUploadTask('task-1');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);

    await expect(task).resolves.toMatchObject({
      status: 'completed',
      result: { success: true, event_ids: ['event_a', 'event_b'] },
    });
  });

  it('waitForUploadTask resolves when task is cancelled by server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            task_id: 'task-cancelled',
            status: 'cancelled',
            phase: 'cancelled',
            completed_events: 0,
            total_events: 1,
            progress_message: 'Upload cancelled safely.',
            result: {
              success: false,
              files: [],
              event_ids: [],
              total_rows: 0,
              pending_channel_map: false,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(uploadApi.waitForUploadTask('task-cancelled')).resolves.toMatchObject({
      status: 'cancelled',
      phase: 'cancelled',
    });
  });

  it('retries transient upload task poll gateway failures', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            status: 'completed',
            phase: 'completed',
            completed_events: 1,
            total_events: 1,
            result: {
              success: true,
              files: [],
              event_ids: ['event_a'],
              total_rows: 5,
              pending_channel_map: false,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const states: Array<{ connectionLost: boolean; message?: string }> = [];

    const task = uploadApi.waitForUploadTask(
      'task-1',
      undefined,
      (state) => states.push(state),
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);

    await expect(task).resolves.toMatchObject({ status: 'completed' });
    expect(states).toContainEqual({
      connectionLost: true,
      message: 'Waiting for server… upload may still be running.',
    });
    expect(states.at(-1)).toEqual({ connectionLost: false });
  });

  it('includes cleanup guidance when failed task exposes retry instructions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            task_id: 'task-2',
            status: 'failed',
            phase: 'failed',
            completed_events: 1,
            total_events: 3,
            error: 'Validation failed after partial commit.',
            error_details: {
              cleanup_required: true,
              cleanup_candidate_event_count: 1,
              retry_guidance:
                'Run failed-upload cleanup before retrying the same files.',
              cleanup_endpoint: '/api/v1/upload/folder/task/task-2/cleanup',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(uploadApi.waitForUploadTask('task-2')).rejects.toThrow(
      'Validation failed after partial commit. Run failed-upload cleanup before retrying the same files.',
    );
  });

  it('posts cleanup request for failed folder task', async () => {
    vi.mocked(post).mockResolvedValue({
      deleted: true,
      task_id: 'task-cleanup',
      deleted_event_ids: ['event-1'],
      deleted_event_count: 1,
      deleted_artifact_count: 1,
      skipped_artifact_paths: [],
    });

    const result = await uploadApi.cleanupFailedFolderUploadTask('task-cleanup');

    expect(post).toHaveBeenCalledWith('/api/v1/upload/folder/task/task-cleanup/cleanup', {});
    expect(result.deleted_event_ids).toEqual(['event-1']);
  });

  it('posts cancel request for upload task and returns typed acknowledgement', async () => {
    vi.mocked(post).mockResolvedValue({
      task_id: 'task-cancel',
      status: 'cancelling',
      terminal_state: null,
      task_kind: 'folder_upload',
      cancel_requested_at: '2026-01-01T00:00:00',
    });

    const result = await uploadApi.cancelUploadTask('task-cancel');

    expect(post).toHaveBeenCalledWith('/api/v1/upload/tasks/task-cancel/cancel', {});
    expect(result.task_id).toBe('task-cancel');
    expect(result.status).toBe('cancelling');
    expect(result.cancel_requested_at).toBe('2026-01-01T00:00:00');
  });

  it('uses extended timeout for single dataset deletes', async () => {
    vi.mocked(del).mockResolvedValue({
      deleted: true,
      event_id: 'event-1',
    });

    await uploadApi.deleteDataset('event-1');

    expect(del).toHaveBeenCalledWith('/api/v1/upload/events/event-1', 300_000);
  });

  it('uses extended timeout for bulk dataset deletes', async () => {
    vi.mocked(post).mockResolvedValue({
      deleted_count: 2,
      event_ids: ['event-1', 'event-2'],
    });

    await uploadApi.deleteDatasets(['event-1', 'event-2']);

    expect(post).toHaveBeenCalledWith(
      '/api/v1/upload/events/delete',
      { event_ids: ['event-1', 'event-2'] },
      300_000,
    );
  });

  it('uses extended timeout for program/version scope deletes', async () => {
    vi.mocked(post).mockResolvedValue({
      deleted: true,
      program_id: 'P1',
      version: 'v1',
      event_count: 5,
      raw_rows: 1000,
      lttb_rows: 400,
      event_custom_field_rows: 0,
      artifact_count: 2,
      channel_map_rows: 1,
      deleted_files: 2,
      skipped_files: [],
      owner_user_ids: ['user-1'],
    });

    await uploadApi.deleteProgramVersionScope({ program_id: 'P1', version: 'v1' });

    expect(post).toHaveBeenCalledWith(
      '/api/v1/upload/program-version/delete',
      { program_id: 'P1', version: 'v1' },
      300_000,
    );
  });

  it('fetches reconnect discovery payload for active and terminal upload tasks', async () => {
    vi.mocked(get).mockResolvedValue({
      active_tasks: [
        {
          task_id: 'task-active',
          status: 'running',
          phase: 'writing',
          completed_events: 1,
          total_events: 3,
          task_kind: 'folder_upload',
        },
      ],
      recent_terminal_tasks: [
        {
          task_id: 'task-terminal',
          status: 'failed',
          terminal_state: 'failed',
          phase: 'failed',
          completed_events: 1,
          total_events: 3,
          task_kind: 'folder_upload',
          error_details: {
            retry_guidance: 'Run failed-upload cleanup before retrying.',
          },
        },
      ],
    });

    const payload = await uploadApi.getActiveUploadTasks();

    expect(get).toHaveBeenCalledWith('/api/v1/upload/tasks/active');
    expect(payload.active_tasks[0]?.task_id).toBe('task-active');
    expect(payload.recent_terminal_tasks[0]?.task_id).toBe('task-terminal');
  });
});
