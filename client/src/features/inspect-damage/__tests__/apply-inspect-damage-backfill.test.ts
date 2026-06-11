import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyInspectDamageBackfill } from '@/features/inspect-damage/lib/apply-inspect-damage-backfill';
import { resetDamageCalculationStoreForTests } from '@/stores/damage-calculation-store';

const trackDamageCalculationTask = vi.fn();
const backfill = vi.fn();

vi.mock('@/stores/damage-calculation-store', async () => {
  const actual = await vi.importActual<typeof import('@/stores/damage-calculation-store')>(
    '@/stores/damage-calculation-store',
  );
  return {
    ...actual,
    trackDamageCalculationTask: (...args: unknown[]) => trackDamageCalculationTask(...args),
  };
});

vi.mock('@/lib/api/damage', () => ({
  damageApi: {
    backfill: (...args: unknown[]) => backfill(...args),
  },
}));

describe('applyInspectDamageBackfill', () => {
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
  });

  it('reuses an active damage task without calling the backfill endpoint', async () => {
    const result = await applyInspectDamageBackfill({
      scope: {
        program_id: 'P1',
        version: 'V1',
        has_current_results: false,
        has_stale_results: false,
        has_active_schedule: true,
        can_start_calculation: true,
        active_damage_task_id: 'task-active',
      },
      queryClient,
    });

    expect(result).toBe('reused_active_task');
    expect(backfill).not.toHaveBeenCalled();
    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope: { programId: 'P1', version: 'V1' },
      taskId: 'task-active',
      queryClient,
      reopenExisting: true,
      origin: 'automatic',
    });
  });

  it('starts damage calculation through the backfill endpoint', async () => {
    backfill.mockResolvedValue({
      damage_task_id: 'task-1',
      task_kind: 'damage_calculation',
    });

    const result = await applyInspectDamageBackfill({
      scope: {
        program_id: 'P1',
        version: 'V1',
        has_current_results: false,
        has_stale_results: false,
        has_active_schedule: true,
        can_start_calculation: true,
      },
      queryClient,
    });

    expect(result).toBe('damage_task');
    expect(backfill).toHaveBeenCalledWith('P1', 'V1');
    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope: { programId: 'P1', version: 'V1' },
      taskId: 'task-1',
      queryClient,
      origin: 'automatic',
    });
  });

  it('returns prerequisite feedback without tracking a task', async () => {
    backfill.mockResolvedValue({
      damage_prerequisite_report: {
        summary: 'Prerequisites missing',
        issues: [],
      },
    });

    const result = await applyInspectDamageBackfill({
      scope: {
        program_id: 'P1',
        version: 'V1',
        has_current_results: false,
        has_stale_results: false,
        has_active_schedule: true,
        can_start_calculation: true,
      },
      queryClient,
    });

    expect(result).toBe('prerequisite_report');
    expect(trackDamageCalculationTask).not.toHaveBeenCalled();
  });
});
