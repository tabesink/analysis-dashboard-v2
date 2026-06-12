import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadApi } from './upload';

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
});
