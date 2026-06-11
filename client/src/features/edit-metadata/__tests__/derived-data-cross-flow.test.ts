import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dismissChannelReprocessModal,
  getChannelReprocessScopeState,
  isChannelReprocessActive,
  resetChannelReprocessStoreForTests,
  trackChannelReprocessTask,
} from '@/stores/channel-reprocess-store';
import {
  dismissDamageCalculationModal,
  getDamageCalculationScopeState,
  isDamageCalculationActive,
  resetDamageCalculationStoreForTests,
  trackDamageCalculationTask,
} from '@/stores/damage-calculation-store';

const waitForDerivedDataTask = vi.fn();

vi.mock('@/lib/api/derived-data', () => ({
  derivedDataApi: {
    waitForDerivedDataTask: (...args: unknown[]) => waitForDerivedDataTask(...args),
  },
}));

describe('derived-data cross-flow hardening', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetChannelReprocessStoreForTests();
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));
  });

  it('keeps channel reprocess polling after modal close', () => {
    trackChannelReprocessTask({ scope, taskId: 'shared-task', queryClient });
    dismissChannelReprocessModal(scope);

    expect(getChannelReprocessScopeState(scope)?.modalOpen).toBe(false);
    expect(isChannelReprocessActive(scope)).toBe(true);
  });

  it('keeps damage calculation polling after modal close', () => {
    trackDamageCalculationTask({ scope, taskId: 'damage-task', queryClient });
    dismissDamageCalculationModal(scope);

    expect(getDamageCalculationScopeState(scope)?.modalOpen).toBe(false);
    expect(isDamageCalculationActive(scope)).toBe(true);
  });

  it('does not start duplicate polls when reopening the same task id', () => {
    trackChannelReprocessTask({ scope, taskId: 'shared-task', queryClient });
    trackChannelReprocessTask({
      scope,
      taskId: 'shared-task',
      queryClient,
      reopenExisting: true,
    });

    expect(waitForDerivedDataTask).toHaveBeenCalledTimes(1);
    expect(getChannelReprocessScopeState(scope)?.modalOpen).toBe(true);
  });
});
