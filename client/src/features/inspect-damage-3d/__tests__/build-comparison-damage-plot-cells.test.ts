import { describe, expect, it } from 'vitest';
import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import { DAMAGE_CHANNELS } from '../lib/damage-channel-axis';
import { buildComparisonDamagePlotCells } from '../lib/build-comparison-damage-plot-cells';

const viewModel: DamageComparisonViewModel = {
  inspectEventIds: ['ref-1', 'target-1'],
  emptyState: null,
  selectionSummary: {
    referenceEventCount: 1,
    targetEventCount: 1,
    channelCount: 2,
    valueMode: 'absolute',
  },
  subtitleText: 'Reference 1 events · Target 1 events · 2 channels',
  legendText: 'Absolute mode',
  aggregates: {
    program_version: [
      {
        dataset: 'reference',
        program_id: 'P1',
        version: 'v01',
        absolute_damage: 10,
        normalized_damage: 1,
        selected_value: 10,
      },
      {
        dataset: 'target',
        program_id: 'P1',
        version: 'v01',
        absolute_damage: 4,
        normalized_damage: 1,
        selected_value: 4,
      },
    ],
    event_channel: [
      {
        dataset: 'reference',
        event_id: 'ref-1',
        program_id: 'P1',
        version: 'v01',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 3,
        normalized_damage: 0.3,
        selected_value: 3,
      },
      {
        dataset: 'target',
        event_id: 'target-1',
        program_id: 'P1',
        version: 'v01',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 5,
        normalized_damage: 0.5,
        selected_value: 5,
      },
      {
        dataset: 'target',
        event_id: 'target-1',
        program_id: 'P1',
        version: 'v02',
        channel_key: 'bj_y_force',
        channel_label: 'BJ Y Force',
        absolute_damage: 7,
        normalized_damage: 0.7,
        selected_value: 7,
      },
    ],
    channel: [],
    channel_delta: [
      {
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        reference_damage: 8,
        target_damage: 3,
        reference_normalized: 0.8,
        target_normalized: 0.3,
        absolute_delta: -5,
        percent_difference: -62.5,
        ratio: 0.375,
        normalized_ratio: 0.375,
        low_reference: false,
        low_reference_reason: null,
        selected_metric: 'absolute_delta',
        selected_value: -5,
      },
    ],
    meta: {
      value_mode: 'absolute',
      low_reference_threshold: 1e-12,
      program_version: {
        normalized_denominator: 'dataset_total_damage',
      },
      event_channel: {
        normalized_denominator: 'dataset_total_damage',
      },
      channel: {
        normalized_denominator: 'dataset_total_damage',
      },
      channel_delta: {
        normalized_denominator: 'target_channel_share_over_reference_channel_share',
      },
    },
  },
};

describe('buildComparisonDamagePlotCells', () => {
  it('builds per-event channel cells for all selected channels', () => {
    const result = buildComparisonDamagePlotCells({
      viewModel,
      plotType: 'cumulative_by_channel',
      selectedChannelKeys: ['bj_x_force', 'bj_y_force'],
      version: undefined,
      channels: DAMAGE_CHANNELS,
      eventNameByEventId: new Map([
        ['ref-1', 'ref_event'],
        ['target-1', 'target_event'],
      ]),
    });

    expect(result.cells.map((cell) => [cell.eventLabel, cell.channelKey, cell.damage])).toEqual([
      ['ref_event', 'bj_x_force', 3],
      ['target_event', 'bj_x_force', 5],
      ['target_event', 'bj_y_force', 7],
    ]);
  });

  it('filters cumulative channel cells by version slice', () => {
    const result = buildComparisonDamagePlotCells({
      viewModel,
      plotType: 'cumulative_by_channel',
      selectedChannelKeys: ['bj_x_force'],
      version: 'v01',
      channels: DAMAGE_CHANNELS,
      eventNameByEventId: new Map([
        ['ref-1', 'ref_event'],
        ['target-1', 'target_event'],
      ]),
    });

    expect(result.cells.map((cell) => [cell.eventLabel, cell.channelKey, cell.damage])).toEqual([
      ['ref_event', 'bj_x_force', 3],
      ['target_event', 'bj_x_force', 5],
    ]);
  });

  it('keeps target-lower deltas renderable as positive bar magnitudes', () => {
    const result = buildComparisonDamagePlotCells({
      viewModel,
      plotType: 'target_delta_vs_reference',
      selectedChannelKeys: ['bj_x_force'],
      version: undefined,
      channels: DAMAGE_CHANNELS,
    });

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({
      eventLabel: 'Target lower',
      channelKey: 'bj_x_force',
      damage: 5,
    });
  });
});
