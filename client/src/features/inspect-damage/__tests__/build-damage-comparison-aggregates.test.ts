import { describe, expect, it } from 'vitest';

import {
  buildDamageComparisonAggregates,
  type DamageComparisonAggregateInput,
} from '@/features/inspect-damage/lib/build-damage-comparison-aggregates';
import type { DamageComparisonRawFact } from '@/features/inspect-damage/lib/build-damage-comparison-raw-facts';
import type { DamageComparisonState } from '@/types/damage-comparison';

function makeComparison(valueMode: DamageComparisonState['value_mode']): DamageComparisonState {
  return {
    reference: { selected_event_ids: ['evt-r1', 'evt-r2'] },
    target: { selected_event_ids: ['evt-t1', 'evt-t2'] },
    selected_channel_keys: ['ch_a', 'ch_b', 'ch_c', 'ch_d'],
    value_mode: valueMode,
    aggregation_event_scope: 'selected_only',
  };
}

function makeFacts(): DamageComparisonRawFact[] {
  return [
    {
      dataset: 'reference',
      event_id: 'evt-r1',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_a',
      channel_label: 'Channel A',
      damage: 10,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'reference',
      event_id: 'evt-r1',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_b',
      channel_label: 'Channel B',
      damage: 5,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'reference',
      event_id: 'evt-r2',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_a',
      channel_label: 'Channel A',
      damage: 5,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'reference',
      event_id: 'evt-r2',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_b',
      channel_label: 'Channel B',
      damage: 15,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'reference',
      event_id: 'evt-r2',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_d',
      channel_label: 'Channel D',
      damage: 0,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t1',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_a',
      channel_label: 'Channel A',
      damage: 20,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t1',
      program_id: 'P1',
      version: 'V1',
      channel_key: 'ch_b',
      channel_label: 'Channel B',
      damage: 5,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t2',
      program_id: 'P2',
      version: 'V2',
      channel_key: 'ch_a',
      channel_label: 'Channel A',
      damage: 10,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t2',
      program_id: 'P2',
      version: 'V2',
      channel_key: 'ch_b',
      channel_label: 'Channel B',
      damage: 30,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t2',
      program_id: 'P2',
      version: 'V2',
      channel_key: 'ch_c',
      channel_label: 'Channel C',
      damage: 7,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
    {
      dataset: 'target',
      event_id: 'evt-t2',
      program_id: 'P2',
      version: 'V2',
      channel_key: 'ch_d',
      channel_label: 'Channel D',
      damage: 5,
      value_status: 'current',
      source_status: 'current',
      stale_reason: null,
    },
  ];
}

function runAggregate(valueMode: DamageComparisonState['value_mode']) {
  const input: DamageComparisonAggregateInput = {
    facts: makeFacts(),
    comparison: makeComparison(valueMode),
    low_reference_threshold: 0.0001,
  };
  return buildDamageComparisonAggregates(input);
}

describe('buildDamageComparisonAggregates', () => {
  it('builds cumulative program/version totals by dataset and selected value mode', () => {
    const absolute = runAggregate('absolute');
    const normalized = runAggregate('normalized');

    expect(absolute.program_version).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: 'reference',
          program_id: 'P1',
          version: 'V1',
          absolute_damage: 35,
          normalized_damage: 1,
          selected_value: 35,
        }),
        expect.objectContaining({
          dataset: 'target',
          program_id: 'P1',
          version: 'V1',
          absolute_damage: 25,
          selected_value: 25,
        }),
        expect.objectContaining({
          dataset: 'target',
          program_id: 'P2',
          version: 'V2',
          absolute_damage: 52,
          selected_value: 52,
        }),
      ]),
    );

    expect(normalized.program_version).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: 'target',
          program_id: 'P1',
          version: 'V1',
          normalized_damage: 25 / 77,
          selected_value: 25 / 77,
        }),
        expect.objectContaining({
          dataset: 'target',
          program_id: 'P2',
          version: 'V2',
          normalized_damage: 52 / 77,
          selected_value: 52 / 77,
        }),
      ]),
    );

    expect(normalized.meta.value_mode).toBe('normalized');
    expect(normalized.meta.program_version.normalized_denominator).toBe('dataset_total_damage');
  });

  it('builds event and channel aggregates that support channel-aware bars and selected value mode', () => {
    const absolute = runAggregate('absolute');
    const normalized = runAggregate('normalized');

    expect(absolute.event_channel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: 'reference',
          event_id: 'evt-r2',
          channel_key: 'ch_b',
          absolute_damage: 15,
          selected_value: 15,
        }),
        expect.objectContaining({
          dataset: 'target',
          event_id: 'evt-t2',
          channel_key: 'ch_c',
          absolute_damage: 7,
          selected_value: 7,
        }),
      ]),
    );

    expect(normalized.channel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: 'reference',
          channel_key: 'ch_a',
          absolute_damage: 15,
          normalized_damage: 15 / 35,
          selected_value: 15 / 35,
        }),
        expect.objectContaining({
          dataset: 'target',
          channel_key: 'ch_b',
          absolute_damage: 35,
          normalized_damage: 35 / 77,
          selected_value: 35 / 77,
        }),
      ]),
    );

    expect(normalized.meta.event_channel.normalized_denominator).toBe('dataset_total_damage');
    expect(normalized.meta.channel.normalized_denominator).toBe('dataset_total_damage');
  });

  it('computes signed deltas, ratio metrics, normalized ratio, and low-reference guards', () => {
    const result = runAggregate('normalized');

    const deltaA = result.channel_delta.find((row) => row.channel_key === 'ch_a');
    expect(deltaA).toMatchObject({
      channel_key: 'ch_a',
      reference_damage: 15,
      target_damage: 30,
      absolute_delta: 15,
      percent_difference: 100,
      ratio: 2,
      low_reference: false,
      selected_metric: 'normalized_ratio',
      selected_value: (30 / 77) / (15 / 35),
    });
    expect(deltaA?.normalized_ratio).toBeCloseTo((30 / 77) / (15 / 35), 8);

    const deltaC = result.channel_delta.find((row) => row.channel_key === 'ch_c');
    expect(deltaC).toMatchObject({
      channel_key: 'ch_c',
      reference_damage: 0,
      target_damage: 7,
      absolute_delta: 7,
      low_reference: true,
      low_reference_reason: 'missing_or_below_threshold',
      percent_difference: null,
      ratio: null,
      normalized_ratio: null,
      selected_metric: 'normalized_ratio',
      selected_value: null,
    });

    const deltaD = result.channel_delta.find((row) => row.channel_key === 'ch_d');
    expect(deltaD).toMatchObject({
      channel_key: 'ch_d',
      reference_damage: 0,
      target_damage: 5,
      low_reference: true,
      percent_difference: null,
      ratio: null,
      normalized_ratio: null,
    });

    expect(result.meta.channel_delta.normalized_denominator).toBe(
      'target_channel_share_over_reference_channel_share',
    );
    expect(result.meta.low_reference_threshold).toBe(0.0001);
  });
});
