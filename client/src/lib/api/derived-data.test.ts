import { afterEach, describe, expect, it, vi } from 'vitest';

import { derivedDataApi } from '@/lib/api/derived-data';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();

  return {
    ...actual,
    getApiBaseUrl: () => 'http://localhost:8000',
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
});
