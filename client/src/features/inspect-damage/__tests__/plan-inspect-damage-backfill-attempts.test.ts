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
  it('returns no scopes because inspect damage no longer auto-starts calculations', () => {
    const scopes = planInspectDamageBackfillAttempts({
      response: baseResponse,
      canWrite: true,
      attemptedScopeKeys: new Set(),
      isScopeActive: () => false,
    });

    expect(scopes).toEqual([]);
  });
});
