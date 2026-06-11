import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyDamageTaskResponse } from '@/features/edit-metadata/lib/apply-damage-task-response';
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

describe('applyDamageTaskResponse', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
  });

  it('tracks a damage calculation task with the requested origin', () => {
    const result = applyDamageTaskResponse({
      scope,
      queryClient,
      response: {
        damage_task_id: 'damage-task-1',
      },
      origin: 'automatic',
      openModal: true,
    });

    expect(result).toBe('damage_task');
    expect(setScheduleDamageReport).toHaveBeenCalledWith(scope, null);
    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope,
      taskId: 'damage-task-1',
      queryClient,
      origin: 'automatic',
      openModal: true,
    });
  });

  it('stores prerequisite reports and emits blocked feedback without starting a task', () => {
    const report = {
      summary: 'Prerequisites missing',
      issues: [],
    };

    const result = applyDamageTaskResponse({
      scope,
      queryClient,
      response: {
        damage_prerequisite_report: report,
      },
      origin: 'manual',
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
