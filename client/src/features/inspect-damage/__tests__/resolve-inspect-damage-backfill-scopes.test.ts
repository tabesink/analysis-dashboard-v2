import { describe, expect, it } from 'vitest';

import { resolveInspectDamageBackfillScopes } from '@/features/inspect-damage/lib/resolve-inspect-damage-backfill-scopes';
import type { DamageInspectResponse } from '@/types/api';

const baseResponse: DamageInspectResponse = {
  channels: [],
  rows: [],
  has_stale_values: false,
  scopes: [],
};

describe('resolveInspectDamageBackfillScopes', () => {
  it('returns missing scopes with ready prerequisites for write users', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.program_id).toBe('P1');
  });

  it('returns no scopes for read-only users', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: false,
    });

    expect(scopes).toEqual([]);
  });

  it('includes scopes with partial current and error damage needing repair', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: true,
            has_stale_results: false,
            needs_damage_repair: true,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(scopes).toHaveLength(1);
  });

  it('skips scopes with stale persisted damage', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: true,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(scopes).toEqual([]);
  });

  it('skips scopes with current persisted damage', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: true,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(scopes).toEqual([]);
  });

  it('includes scopes with an active damage task for reuse', () => {
    const scopes = resolveInspectDamageBackfillScopes({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
            active_damage_task_id: 'task-active',
          },
        ],
      },
      canWrite: true,
    });

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.active_damage_task_id).toBe('task-active');
  });
});
