import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyChannelReprocessPrecomputeFollowUp } from '@/features/edit-metadata/lib/channel-reprocess-follow-up';
import {
  resetDamageCalculationStoreForTests,
} from '@/stores/damage-calculation-store';

const trackDamageCalculationTask = vi.fn();
const emitBlockedPrecomputeToast = vi.fn();

vi.mock('@/stores/damage-calculation-store', async () => {
  const actual = await vi.importActual<typeof import('@/stores/damage-calculation-store')>(
    '@/stores/damage-calculation-store',
  );
  return {
    ...actual,
    trackDamageCalculationTask: (...args: unknown[]) => trackDamageCalculationTask(...args),
  };
});

vi.mock('@/features/edit-metadata/lib/blocked-precompute-feedback', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/edit-metadata/lib/blocked-precompute-feedback')
  >('@/features/edit-metadata/lib/blocked-precompute-feedback');
  return {
    ...actual,
    emitBlockedPrecomputeToast: (...args: unknown[]) => emitBlockedPrecomputeToast(...args),
  };
});

describe('applyChannelReprocessPrecomputeFollowUp', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
  });

  it('tracks automatic damage calculation when channel reprocess exposes a follow-up task id', () => {
    applyChannelReprocessPrecomputeFollowUp({
      scope,
      queryClient,
      result: {
        processed_count: 1,
        failed_count: 0,
        precompute_follow_up: {
          damage_task_id: 'damage-task-1',
        },
      },
    });

    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope,
      taskId: 'damage-task-1',
      queryClient,
      origin: 'automatic',
      openModal: true,
    });
  });

  it('emits blocked toast feedback when channel reprocess precompute is blocked', () => {
    applyChannelReprocessPrecomputeFollowUp({
      scope,
      queryClient,
      result: {
        processed_count: 1,
        failed_count: 0,
        precompute_follow_up: {
          damage_prerequisite_report: {
            summary: 'Damage calculation prerequisites are not met',
            issues: [
              {
                field: 'event_id',
                code: 'missing_raw_load_histories',
                message: 'Raw load histories are missing.',
              },
            ],
          },
        },
      },
    });

    expect(emitBlockedPrecomputeToast).toHaveBeenCalledWith({
      programId: 'P1',
      version: 'V1',
      report: {
        summary: 'Damage calculation prerequisites are not met',
        issues: [
          {
            field: 'event_id',
            code: 'missing_raw_load_histories',
            message: 'Raw load histories are missing.',
          },
        ],
      },
    });
    expect(trackDamageCalculationTask).not.toHaveBeenCalled();
  });
});
