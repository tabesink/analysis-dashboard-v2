import { describe, expect, it } from 'vitest';

import {
  buildDamageComparisonViewModel,
  getComparisonInspectEventIds,
} from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamageComparisonState } from '@/types/damage-comparison';
import type { DamageInspectResponse } from '@/types/api';

function makeComparisonState(): DamageComparisonState {
  return {
    reference: { selected_event_ids: ['evt-ref-1', 'evt-overlap'] },
    target: { selected_event_ids: ['evt-overlap', 'evt-tgt-1'] },
    selected_channel_keys: ['ch_a', 'ch_b'],
    value_mode: 'absolute',
    aggregation_event_scope: 'selected_only',
  };
}

function makeResponse(): DamageInspectResponse {
  return {
    channels: [
      { channel_key: 'ch_a', channel_name: 'Channel A' },
      { channel_key: 'ch_b', channel_name: 'Channel B' },
    ],
    rows: [
      {
        event_id: 'evt-ref-1',
        program_id: 'P1',
        damages: {
          ch_a: { status: 'current', damage: 10 },
          ch_b: { status: 'current', damage: 3 },
        },
      },
      {
        event_id: 'evt-overlap',
        program_id: 'P1',
        damages: {
          ch_a: { status: 'current', damage: 6 },
          ch_b: { status: 'current', damage: 2 },
        },
      },
      {
        event_id: 'evt-tgt-1',
        program_id: 'P2',
        damages: {
          ch_a: { status: 'current', damage: 20 },
          ch_b: { status: 'current', damage: 4 },
        },
      },
    ],
  };
}

describe('getComparisonInspectEventIds', () => {
  it('returns a union of reference + target event ids', () => {
    const comparison = makeComparisonState();
    expect(getComparisonInspectEventIds(comparison)).toEqual([
      'evt-ref-1',
      'evt-overlap',
      'evt-tgt-1',
    ]);
  });
});

describe('buildDamageComparisonViewModel', () => {
  it('guides users when required selections are missing', () => {
    expect(
      buildDamageComparisonViewModel({
        comparison: {
          ...makeComparisonState(),
          reference: { selected_event_ids: [] },
        },
        response: null,
      }).emptyState,
    ).toMatchObject({
      code: 'missing_reference_events',
    });

    expect(
      buildDamageComparisonViewModel({
        comparison: {
          ...makeComparisonState(),
          selected_channel_keys: [],
        },
        response: null,
      }).emptyState,
    ).toMatchObject({
      code: 'missing_channels',
    });
  });

  it('builds v1 plot families and comparison context metadata', () => {
    const model = buildDamageComparisonViewModel({
      comparison: makeComparisonState(),
      response: makeResponse(),
    });

    expect(model.emptyState).toBeNull();
    expect(model.inspectEventIds).toEqual(['evt-ref-1', 'evt-overlap', 'evt-tgt-1']);
    expect(model.selectionSummary).toEqual({
      referenceEventCount: 2,
      targetEventCount: 2,
      channelCount: 2,
      valueMode: 'absolute',
    });

    expect(model.legendText).toContain('Absolute mode');
    expect(model.subtitleText).toContain('Reference 2 events');
    expect(model.subtitleText).toContain('Target 2 events');
    expect(model.subtitleText).toContain('2 channels');

    expect(model.aggregates?.program_version.length).toBeGreaterThan(0);
    expect(model.aggregates?.event_channel.length).toBeGreaterThan(0);
    expect(model.aggregates?.channel.length).toBeGreaterThan(0);
    expect(model.aggregates?.channel_delta.length).toBeGreaterThan(0);
  });
});
