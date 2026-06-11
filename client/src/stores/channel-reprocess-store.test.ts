import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeChannelReprocessSummary,
  dismissChannelReprocessModal,
  getChannelReprocessScopeState,
  isChannelReprocessActive,
  reopenChannelReprocessModal,
  resetChannelReprocessStoreForTests,
  trackChannelReprocessTask,
} from '@/stores/channel-reprocess-store';

const waitForDerivedDataTask = vi.fn();

vi.mock('@/lib/api/derived-data', () => ({
  derivedDataApi: {
    waitForDerivedDataTask: (...args: unknown[]) => waitForDerivedDataTask(...args),
  },
}));

vi.mock('@/lib/channel-map-save-cache', () => ({
  invalidateQueriesAfterChannelMapSave: vi.fn(),
}));

describe('channelReprocessStore', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetChannelReprocessStoreForTests();
    vi.clearAllMocks();
  });

  it('tracks an active task and opens the progress modal', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));

    trackChannelReprocessTask({
      scope,
      taskId: 'task-1',
      queryClient,
    });

    const scoped = getChannelReprocessScopeState(scope);
    expect(scoped?.taskId).toBe('task-1');
    expect(scoped?.modalOpen).toBe(true);
    expect(scoped?.wizardStep).toBe('progress');
    expect(isChannelReprocessActive(scope)).toBe(true);
  });

  it('keeps polling when the modal is dismissed', async () => {
    let resolvePoll: ((value: unknown) => void) | undefined;
    waitForDerivedDataTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );

    trackChannelReprocessTask({ scope, taskId: 'task-1', queryClient });
    dismissChannelReprocessModal(scope);

    expect(getChannelReprocessScopeState(scope)?.modalOpen).toBe(false);
    expect(isChannelReprocessActive(scope)).toBe(true);

    resolvePoll?.({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      status: 'completed',
      phase: 'completed',
      completed_events: 2,
      total_events: 2,
      result: { processed_count: 2, failed_count: 0 },
    });

    await vi.waitFor(() => {
      expect(getChannelReprocessScopeState(scope)?.wizardStep).toBe('summary');
    });
  });

  it('reopens the existing task instead of starting duplicate polling', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));

    trackChannelReprocessTask({ scope, taskId: 'task-1', queryClient });
    dismissChannelReprocessModal(scope);
    trackChannelReprocessTask({
      scope,
      taskId: 'task-1',
      queryClient,
      reopenExisting: true,
    });

    expect(waitForDerivedDataTask).toHaveBeenCalledTimes(1);
    expect(getChannelReprocessScopeState(scope)?.modalOpen).toBe(true);
  });

  it('can reopen the modal from the inline banner', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));

    trackChannelReprocessTask({ scope, taskId: 'task-1', queryClient });
    dismissChannelReprocessModal(scope);
    reopenChannelReprocessModal(scope);

    expect(getChannelReprocessScopeState(scope)?.modalOpen).toBe(true);
  });

  it('clears scoped state after closing the completion summary', async () => {
    waitForDerivedDataTask.mockResolvedValue({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      status: 'completed',
      phase: 'completed',
      completed_events: 1,
      total_events: 1,
      result: { processed_count: 1, failed_count: 0 },
    });

    trackChannelReprocessTask({ scope, taskId: 'task-1', queryClient });
    await vi.waitFor(() => {
      expect(getChannelReprocessScopeState(scope)?.wizardStep).toBe('summary');
    });
    closeChannelReprocessSummary(scope);

    expect(getChannelReprocessScopeState(scope)).toBeNull();
    expect(isChannelReprocessActive(scope)).toBe(false);
  });
});
