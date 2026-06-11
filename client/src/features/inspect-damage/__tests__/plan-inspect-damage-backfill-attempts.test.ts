import { describe, expect, it } from 'vitest';

import { planInspectDamageBackfillAttempts } from '@/features/inspect-damage/lib/plan-inspect-damage-backfill-attempts';
import type { DamageInspectResponse } from '@/types/api';

const missingScope = {
  program_id: 'P1',
  version: 'V1',
  has_current_results: false,
  has_stale_results: false,
  has_active_schedule: true,
  can_start_calculation: true,
};

const baseResponse: DamageInspectResponse = {
  channels: [],
  rows: [],
  has_stale_values: false,
  scopes: [missingScope],
};

describe('planInspectDamageBackfillAttempts', () => {
  it('returns missing scopes that have not been attempted yet', () => {
    const scopes = planInspectDamageBackfillAttempts({
      response: baseResponse,
      canWrite: true,
      attemptedScopeKeys: new Set(),
      isScopeActive: () => false,
    });

    expect(scopes).toHaveLength(1);
  });

  it('skips scopes that already have an active tracked calculation', () => {
    const scopes = planInspectDamageBackfillAttempts({
      response: baseResponse,
      canWrite: true,
      attemptedScopeKeys: new Set(),
      isScopeActive: () => true,
    });

    expect(scopes).toEqual([]);
  });

  it('skips repeated attempts for the same scope in one session', () => {
    const scopes = planInspectDamageBackfillAttempts({
      response: baseResponse,
      canWrite: true,
      attemptedScopeKeys: new Set(['P1::V1']),
      isScopeActive: () => false,
    });

    expect(scopes).toEqual([]);
  });

  it('still reuses active server tasks after an earlier attempt', () => {
    const scopes = planInspectDamageBackfillAttempts({
      response: {
        ...baseResponse,
        scopes: [{ ...missingScope, active_damage_task_id: 'task-active' }],
      },
      canWrite: true,
      attemptedScopeKeys: new Set(['P1::V1']),
      isScopeActive: () => false,
    });

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.active_damage_task_id).toBe('task-active');
  });
});
