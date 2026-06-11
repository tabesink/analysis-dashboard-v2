import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyInspectDamageCalculateResponse } from '@/features/inspect-damage/lib/apply-inspect-damage-calculate';
import { resetDamageCalculationStoreForTests } from '@/stores/damage-calculation-store';

const trackDamageCalculationTask = vi.fn();
const setScheduleDamageReport = vi.fn();
const emitBlockedPrecomputeToast = vi.fn();

vi.mock('@/features/edit-metadata/lib/blocked-precompute-feedback', () => ({
  emitBlockedPrecomputeToast: (...args: unknown[]) => emitBlockedPrecomputeToast(...args),
}));

vi.mock('@/stores/damage-calculation-store', async () => {
  const actual = await vi.importActual<typeof import('@/stores/damage-calculation-store')>(
    '@/stores/damage-calculation-store',
  );
  return {
    ...actual,
    trackDamageCalculationTask: (...args: unknown[]) => trackDamageCalculationTask(...args),
    setScheduleDamageReport: (...args: unknown[]) => setScheduleDamageReport(...args),
  };
});

describe('applyInspectDamageCalculateResponse', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
  });

  it('tracks damage calculation tasks from inspect damage calculate responses', () => {
    const result = applyInspectDamageCalculateResponse({
      scope,
      response: {
        damage_task_id: 'task-1',
        task_kind: 'damage_calculation',
      },
      queryClient,
    });

    expect(result).toBe('damage_task');
    expect(setScheduleDamageReport).toHaveBeenCalledWith(scope, null);
    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope,
      taskId: 'task-1',
      queryClient,
      origin: 'manual',
    });
  });

  it('stores prerequisite reports without creating a task', () => {
    const report = {
      summary: 'Prerequisites missing',
      issues: [],
    };
    const result = applyInspectDamageCalculateResponse({
      scope,
      response: {
        damage_prerequisite_report: report,
      },
      queryClient,
    });

    expect(result).toBe('prerequisite_report');
    expect(setScheduleDamageReport).toHaveBeenCalledWith(scope, report);
    expect(emitBlockedPrecomputeToast).toHaveBeenCalledWith({
      programId: 'P1',
      version: 'V1',
      report,
    });
    expect(trackDamageCalculationTask).not.toHaveBeenCalled();
  });
});
