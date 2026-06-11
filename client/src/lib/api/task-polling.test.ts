import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForTaskStatus } from '@/lib/api/task-polling';

describe('waitForTaskStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a terminal completed task through the supplied status fetcher', async () => {
    vi.useFakeTimers();
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: 'running', message: 'Working' })
      .mockResolvedValueOnce({ status: 'completed', message: 'Done' });
    const updates: string[] = [];

    const task = waitForTaskStatus({
      fetchStatus,
      isTerminal: (event) => event.status === 'completed',
      onUpdate: (event) => updates.push(event.message),
      pollMs: 2000,
      retryWindowMs: 60_000,
      retryMaxBackoffMs: 30_000,
      classifyError: () => ({ retryable: false, message: 'failed' }),
      timeoutMessage: 'Timed out',
    });

    await vi.waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);

    await expect(task).resolves.toEqual({ status: 'completed', message: 'Done' });
    expect(updates).toEqual(['Working', 'Done']);
  });

  it('reports retryable connection loss and recovers when polling succeeds again', async () => {
    vi.useFakeTimers();
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network lost'))
      .mockResolvedValueOnce({ status: 'completed', message: 'Done' });
    const states: Array<{ connectionLost: boolean; message?: string }> = [];

    const task = waitForTaskStatus({
      fetchStatus,
      isTerminal: (event) => event.status === 'completed',
      onConnectionStateChange: (state) => states.push(state),
      pollMs: 2000,
      retryWindowMs: 60_000,
      retryMaxBackoffMs: 30_000,
      classifyError: () => ({ retryable: true, message: 'Waiting for server' }),
      timeoutMessage: 'Timed out',
    });

    await vi.waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1000);

    await expect(task).resolves.toEqual({ status: 'completed', message: 'Done' });
    expect(states).toEqual([
      { connectionLost: true, message: 'Waiting for server' },
      { connectionLost: false },
    ]);
  });
});
