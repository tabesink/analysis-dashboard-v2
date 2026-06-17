import { afterEach, describe, expect, it, vi } from 'vitest';

import { derivedDataApi } from '@/lib/api/derived-data';
import { post } from '@/lib/api/client';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();

  return {
    ...actual,
    getApiBaseUrl: () => 'http://localhost:8000',
    post: vi.fn(),
  };
});

describe('derivedDataApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waitForDerivedDataTask resolves when task completes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            task_kind: 'channel_reprocess',
            status: 'running',
            phase: 'generating',
            completed_events: 1,
            total_events: 2,
            progress_message: 'Generating cross-plot data: event_a - plot_a (100 points)',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            task_kind: 'channel_reprocess',
            status: 'completed',
            phase: 'completed',
            completed_events: 2,
            total_events: 2,
            result: { processed_count: 2, failed_count: 0 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const updates: string[] = [];
    const task = derivedDataApi.waitForDerivedDataTask('task-1', (event) => {
      if (event.progress_message) {
        updates.push(event.progress_message);
      }
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);

    await expect(task).resolves.toMatchObject({
      status: 'completed',
      result: { processed_count: 2, failed_count: 0 },
    });
    expect(updates).toContain('Generating cross-plot data: event_a - plot_a (100 points)');
  });

  it('keeps retrying transient poll failures for long-running derived-data tasks', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-2',
            task_kind: 'damage_calculation',
            status: 'running',
            phase: 'calculating',
            completed_events: 1,
            total_events: 10,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    for (let i = 0; i < 20; i += 1) {
      fetchMock.mockRejectedValueOnce(new TypeError('network lost'));
    }

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          task_id: 'task-2',
          task_kind: 'damage_calculation',
          status: 'completed',
          phase: 'completed',
          completed_events: 10,
          total_events: 10,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const connectionStates: string[] = [];
    const task = derivedDataApi.waitForDerivedDataTask(
      'task-2',
      undefined,
      (state) => {
        if (state.message) connectionStates.push(state.message);
      },
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(3_600_000);

    await expect(task).resolves.toMatchObject({ status: 'completed' });
    expect(connectionStates).toContain('Lost contact with the server. Retrying…');
  });

  it('posts derived-data cancel request and returns acknowledgement', async () => {
    vi.mocked(post).mockResolvedValue({
      task_id: 'task-cancel-derived',
      status: 'cancelling',
      terminal_state: null,
      task_kind: 'channel_reprocess',
      cancel_requested_at: '2026-01-01T00:00:00',
    });

    const result = await derivedDataApi.cancelDerivedDataTask('task-cancel-derived');

    expect(post).toHaveBeenCalledWith(
      '/api/v1/dashboard/derived-data/task/task-cancel-derived/cancel',
      {},
    );
    expect(result.task_id).toBe('task-cancel-derived');
    expect(result.status).toBe('cancelling');
    expect(result.task_kind).toBe('channel_reprocess');
  });

  it('treats cancelled derived task as terminal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            task_id: 'task-cancelled-derived',
            task_kind: 'damage_calculation',
            status: 'cancelled',
            phase: 'cancelled',
            completed_events: 2,
            total_events: 10,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(derivedDataApi.waitForDerivedDataTask('task-cancelled-derived')).resolves.toMatchObject({
      status: 'cancelled',
    });
  });
});
