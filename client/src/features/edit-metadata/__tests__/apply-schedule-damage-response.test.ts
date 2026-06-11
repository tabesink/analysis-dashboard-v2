import { describe, expect, it, vi, beforeEach } from 'vitest';

import { applyScheduleDamageResponse } from '@/features/edit-metadata/lib/apply-schedule-damage-response';
import {
  resetDamageCalculationStoreForTests,
} from '@/stores/damage-calculation-store';

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

describe('applyScheduleDamageResponse', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    vi.clearAllMocks();
  });

  it('starts damage progress polling after schedule save returns damage_task_id', () => {
    applyScheduleDamageResponse({
      scope,
      queryClient,
      response: {
        program_id: 'P1',
        version: 'V1',
        schedule_id: 1,
        artifact_uri: 'uri',
        schedule_sha256: 'sha',
        source_filename: 'test.sch',
        damage_task_id: 'damage-task-1',
        parse_preview: {
          schedule_id: 'SCH-1',
          multiplier: 1,
          entry_count: 1,
          entries: [],
          entries_preview: [],
        },
      },
    });

    expect(setScheduleDamageReport).toHaveBeenCalledWith(scope, null);
    expect(trackDamageCalculationTask).toHaveBeenCalledWith({
      scope,
      taskId: 'damage-task-1',
      queryClient,
      origin: 'automatic',
    });
  });

  it('shows prerequisite reports without starting task polling', () => {
    const report = {
      summary: 'Assign channels before calculating damage.',
      issues: [
        {
          field: 'channel' as const,
          code: 'missing_raw_load_histories',
          message: 'Raw load histories are missing.',
        },
      ],
    };

    applyScheduleDamageResponse({
      scope,
      queryClient,
      response: {
        program_id: 'P1',
        version: 'V1',
        schedule_id: 1,
        artifact_uri: 'uri',
        schedule_sha256: 'sha',
        source_filename: 'test.sch',
        damage_prerequisite_report: report,
        parse_preview: {
          schedule_id: 'SCH-1',
          multiplier: 1,
          entry_count: 1,
          entries: [],
          entries_preview: [],
        },
      },
    });

    expect(setScheduleDamageReport).toHaveBeenCalledWith(scope, report);
    expect(emitBlockedPrecomputeToast).toHaveBeenCalledWith({
      programId: 'P1',
      version: 'V1',
      report,
    });
    expect(trackDamageCalculationTask).not.toHaveBeenCalled();
  });

  it('replaces an existing report when a new prerequisite report arrives', () => {
    const firstReport = {
      summary: 'First report',
      issues: [],
    };
    const secondReport = {
      summary: 'Updated report',
      issues: [],
    };

    applyScheduleDamageResponse({
      scope,
      queryClient,
      response: {
        program_id: 'P1',
        version: 'V1',
        schedule_id: 1,
        artifact_uri: 'uri',
        schedule_sha256: 'sha',
        source_filename: 'test.sch',
        damage_prerequisite_report: firstReport,
        parse_preview: {
          schedule_id: 'SCH-1',
          multiplier: 1,
          entry_count: 1,
          entries: [],
          entries_preview: [],
        },
      },
    });
    applyScheduleDamageResponse({
      scope,
      queryClient,
      response: {
        program_id: 'P1',
        version: 'V1',
        schedule_id: 1,
        artifact_uri: 'uri',
        schedule_sha256: 'sha',
        source_filename: 'test.sch',
        damage_prerequisite_report: secondReport,
        parse_preview: {
          schedule_id: 'SCH-1',
          multiplier: 1,
          entry_count: 1,
          entries: [],
          entries_preview: [],
        },
      },
    });

    expect(setScheduleDamageReport).toHaveBeenNthCalledWith(1, scope, firstReport);
    expect(setScheduleDamageReport).toHaveBeenNthCalledWith(2, scope, secondReport);
  });
});
