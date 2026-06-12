import { describe, expect, it } from 'vitest';

import { buildDamageComparisonRawFacts } from '@/features/inspect-damage/lib/build-damage-comparison-raw-facts';
import type { DamageComparisonState } from '@/types/damage-comparison';
import type { DamageInspectResponse } from '@/types/api';

const response: DamageInspectResponse = {
  channels: [
    { channel_key: 'bj_x_force', channel_name: 'BJ X Force' },
    { channel_key: 'shock_y_force', channel_name: 'Shock Y Force' },
  ],
  rows: [
    {
      event_id: 'evt-overlap',
      program_id: 'P1',
      damages: {
        bj_x_force: { status: 'current', damage: 10 },
        shock_y_force: { status: 'ok', damage: 8 },
      },
    },
    {
      event_id: 'evt-reference-only',
      program_id: 'P2',
      damages: {
        bj_x_force: { status: 'stale', damage: 3, stale_reason: 'schedule_changed' },
        shock_y_force: { status: 'error', damage: null, error: 'calc failed' },
      },
    },
    {
      event_id: 'evt-target-only',
      program_id: 'P3',
      damages: {
        bj_x_force: { status: 'current', damage: null },
      },
    },
  ],
};

function makeComparisonState(): DamageComparisonState {
  return {
    reference: {
      selected_event_ids: ['evt-overlap', 'evt-reference-only'],
    },
    target: {
      selected_event_ids: ['evt-overlap', 'evt-target-only'],
    },
    selected_channel_keys: ['bj_x_force', 'work_order'],
    value_mode: 'absolute',
    aggregation_event_scope: 'selected_only',
  };
}

describe('buildDamageComparisonRawFacts', () => {
  it('duplicates overlap events into both dataset memberships', () => {
    const result = buildDamageComparisonRawFacts({
      response,
      comparison: makeComparisonState(),
    });

    const overlapFacts = result.facts.filter((fact) => fact.event_id === 'evt-overlap');
    expect(overlapFacts).toHaveLength(2);
    expect(overlapFacts.map((fact) => fact.dataset).sort()).toEqual(['reference', 'target']);
  });

  it('filters facts to selected canonical channel keys and excludes metadata keys', () => {
    const result = buildDamageComparisonRawFacts({
      response,
      comparison: makeComparisonState(),
    });

    expect(new Set(result.facts.map((fact) => fact.channel_key))).toEqual(new Set(['bj_x_force']));
  });

  it('keeps stale values as surfaced facts and excludes missing/null/error cells with explicit reasons', () => {
    const result = buildDamageComparisonRawFacts({
      response,
      comparison: makeComparisonState(),
    });

    expect(
      result.facts.find(
        (fact) => fact.dataset === 'reference' && fact.event_id === 'evt-reference-only',
      ),
    ).toMatchObject({
      dataset: 'reference',
      event_id: 'evt-reference-only',
      channel_key: 'bj_x_force',
      damage: 3,
      value_status: 'stale',
      stale_reason: 'schedule_changed',
    });

    expect(
      result.excluded.filter(
        (entry) =>
          entry.dataset === 'target' &&
          entry.event_id === 'evt-target-only' &&
          entry.channel_key === 'bj_x_force',
      ),
    ).toEqual([
      expect.objectContaining({
        reason: 'missing_damage',
        source_status: 'current',
      }),
    ]);
  });
});
