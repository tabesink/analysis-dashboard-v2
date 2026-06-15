import { describe, expect, it } from 'vitest';
import type { DamageComparisonAggregateOutput } from '@/features/inspect-damage/lib/build-damage-comparison-aggregates';
import { buildDamage2DPlotSpec, computeSharedAbsoluteDamageYDomain } from '../lib/build-damage-2d-plot-spec';

const aggregates: DamageComparisonAggregateOutput = {
  program_version: [],
  event_channel: [],
  channel: [
    {
      dataset: 'reference',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 10,
      normalized_damage: 0.5,
      selected_value: 10,
    },
    {
      dataset: 'target',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 30,
      normalized_damage: 0.6,
      selected_value: 30,
    },
    {
      dataset: 'reference',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 4,
      normalized_damage: 0.2,
      selected_value: 4,
    },
    {
      dataset: 'target',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 8,
      normalized_damage: 0.16,
      selected_value: 8,
    },
  ],
  channel_delta: [],
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
};

const eventAggregates: DamageComparisonAggregateOutput = {
  ...aggregates,
  event_channel: [
    {
      dataset: 'reference',
      event_id: 'ref-event-1',
      program_id: 'Program-A',
      version: 'v1',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 5,
      normalized_damage: 0.1,
      selected_value: 5,
    },
    {
      dataset: 'reference',
      event_id: 'ref-event-1',
      program_id: 'Program-A',
      version: 'v1',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 2,
      normalized_damage: 0.04,
      selected_value: 2,
    },
    {
      dataset: 'reference',
      event_id: 'ref-event-2',
      program_id: 'Program-A',
      version: 'v1',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 7,
      normalized_damage: 0.14,
      selected_value: 7,
    },
    {
      dataset: 'reference',
      event_id: 'ref-event-2',
      program_id: 'Program-A',
      version: 'v1',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 3,
      normalized_damage: 0.06,
      selected_value: 3,
    },
    {
      dataset: 'target',
      event_id: 'target-event-1',
      program_id: 'Program-B',
      version: 'v2',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 11,
      normalized_damage: 0.22,
      selected_value: 11,
    },
    {
      dataset: 'target',
      event_id: 'target-event-1',
      program_id: 'Program-B',
      version: 'v2',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 4,
      normalized_damage: 0.08,
      selected_value: 4,
    },
    {
      dataset: 'target',
      event_id: 'target-event-2',
      program_id: 'Program-B',
      version: 'v2',
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      absolute_damage: 13,
      normalized_damage: 0.26,
      selected_value: 13,
    },
    {
      dataset: 'target',
      event_id: 'target-event-2',
      program_id: 'Program-B',
      version: 'v2',
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      absolute_damage: 6,
      normalized_damage: 0.12,
      selected_value: 6,
    },
  ],
};

const deltaAggregates: DamageComparisonAggregateOutput = {
  ...aggregates,
  channel_delta: [
    {
      channel_key: 'bj_x_force',
      channel_label: 'BJ X Force',
      reference_damage: 10,
      target_damage: 30,
      reference_normalized: 0.5,
      target_normalized: 0.6,
      absolute_delta: 20,
      percent_difference: 200,
      ratio: 3,
      normalized_ratio: 1.2,
      low_reference: false,
      low_reference_reason: null,
      selected_metric: 'absolute_delta',
      selected_value: 20,
    },
    {
      channel_key: 'bj_y_force',
      channel_label: 'BJ Y Force',
      reference_damage: 8,
      target_damage: 4,
      reference_normalized: 0.2,
      target_normalized: 0.16,
      absolute_delta: -4,
      percent_difference: -50,
      ratio: 0.5,
      normalized_ratio: 0.8,
      low_reference: false,
      low_reference_reason: null,
      selected_metric: 'absolute_delta',
      selected_value: -4,
    },
    {
      channel_key: 'bj_z_force',
      channel_label: 'BJ Z Force',
      reference_damage: 0,
      target_damage: 0,
      reference_normalized: 0,
      target_normalized: 0,
      absolute_delta: 0,
      percent_difference: null,
      ratio: null,
      normalized_ratio: null,
      low_reference: true,
      low_reference_reason: 'missing_or_below_threshold',
      selected_metric: 'absolute_delta',
      selected_value: 0,
    },
  ],
};

describe('buildDamage2DPlotSpec', () => {
  it('builds grouped reference/target cumulative-by-channel values', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'cumulative_by_channel',
      aggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.xCategories).toEqual(['BJ Y Force', 'BJ X Force']);
    expect(spec.series).toEqual([
      {
        id: 'reference',
        label: 'Reference',
        color: '#2563eb',
        values: [4, 10],
      },
      {
        id: 'target',
        label: 'Target',
        color: '#dc2626',
        values: [8, 30],
      },
    ]);
    expect(spec.legend).toEqual([
      { label: 'Reference', color: '#2563eb', role: 'reference' },
      { label: 'Target', color: '#dc2626', role: 'target' },
    ]);
    expect(spec.yScale).toMatchObject({
      mode: 'linear',
      domain: [0, 30],
      tickFormat: 'linear',
    });
  });

  it('supports normalized mode and log damage scaling', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'cumulative_by_channel',
      aggregates,
      selectedChannelKeys: ['bj_x_force'],
      valueMode: 'normalized',
      scaleMode: 'log',
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.series[0]?.values[0]).toBeCloseTo(Math.log10(1 + 0.5));
    expect(spec.series[1]?.values[0]).toBeCloseTo(Math.log10(1 + 0.6));
    expect(spec.yScale.domain[1]).toBeCloseTo(Math.log10(1 + 0.6));
    expect(spec.yScale.tickFormat).toBe('log');
    expect(spec.subtitle).toContain('Normalized');
    expect(spec.subtitle).toContain('Log');
  });

  it('builds cumulative-by-channel values from selected events when provided', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'cumulative_by_channel',
      aggregates: eventAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
      selectedEventIds: ['ref-event-1'],
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.subtitle).toContain('Selected events');
    expect(spec.series[0]?.values).toEqual([2, 5]);
    expect(spec.series[1]?.values).toEqual([0, 0]);
    expect(spec.yScale.domain).toEqual([0, 5]);
  });

  it('builds reference absolute-by-event stacked channel values from event aggregates', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'reference_absolute_by_event',
      aggregates: eventAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
      referenceEventIds: ['ref-event-1', 'ref-event-2'],
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.chartKind).toBe('stacked-bar');
    expect(spec.title).toBe('Reference absolute damage by event');
    expect(spec.xCategories).toEqual(['BJ Y Force', 'BJ X Force']);
    expect(spec.series).toEqual([
      {
        id: 'reference_event-0',
        label: 'ref-event-2',
        color: '#2563eb',
        values: [3, 7],
        percentages: [60, (100 * 7) / 12],
      },
      {
        id: 'reference_event-1',
        label: 'ref-event-1',
        color: '#60a5fa',
        values: [2, 5],
        percentages: [40, (100 * 5) / 12],
      },
    ]);
    expect(spec.legend).toEqual([{ label: 'Reference', color: '#2563eb', role: 'reference' }]);
    expect(spec.yScale.domain).toEqual([0, 12]);
  });

  it('builds target absolute-by-event stacked values with scale mode applied', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'target_absolute_by_event',
      aggregates: eventAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'log',
      targetEventIds: ['target-event-1'],
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.title).toBe('Target absolute damage by event');
    expect(spec.chartKind).toBe('stacked-bar');
    expect(spec.xCategories).toEqual(['BJ Y Force', 'BJ X Force']);
    expect(spec.series).toEqual([
      {
        id: 'target_event-0',
        label: 'target-event-1',
        color: '#dc2626',
        values: [Math.log10(1 + 4), Math.log10(1 + 11)],
        percentages: [100, 100],
      },
    ]);
    expect(spec.legend).toEqual([{ label: 'Target', color: '#dc2626', role: 'target' }]);
    expect(spec.yScale.tickFormat).toBe('log');
  });

  it('limits absolute-by-event stacks to the top threshold events plus Other events', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'reference_absolute_by_event',
      aggregates: {
        ...eventAggregates,
        event_channel: [
          ...eventAggregates.event_channel,
          {
            dataset: 'reference',
            event_id: 'ref-event-3',
            program_id: 'Program-A',
            version: 'v1',
            channel_key: 'bj_x_force',
            channel_label: 'BJ X Force',
            absolute_damage: 1,
            normalized_damage: 0.02,
            selected_value: 1,
          },
          {
            dataset: 'reference',
            event_id: 'ref-event-3',
            program_id: 'Program-A',
            version: 'v1',
            channel_key: 'bj_y_force',
            channel_label: 'BJ Y Force',
            absolute_damage: 4,
            normalized_damage: 0.08,
            selected_value: 4,
          },
        ],
      },
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
      referenceEventIds: ['ref-event-1', 'ref-event-2', 'ref-event-3'],
      eventThreshold: 1,
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.subtitle).toContain('1 of 3 events');
    expect(spec.series).toEqual([
      {
        id: 'reference_event-0',
        label: 'ref-event-2',
        color: '#2563eb',
        values: [3, 7],
        percentages: [(100 * 3) / 9, (100 * 7) / 13],
      },
      {
        id: 'reference_event-other',
        label: 'Other events',
        color: '#64748b',
        values: [6, 6],
        percentages: [(100 * 6) / 9, (100 * 6) / 13],
      },
    ]);
    expect(spec.yScale.domain).toEqual([0, 13]);
  });

  it('returns an empty state when target absolute-by-event has no dataset rows', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'target_absolute_by_event',
      aggregates: {
        ...eventAggregates,
        event_channel: eventAggregates.event_channel.filter((row) => row.dataset === 'reference'),
      },
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
      targetEventIds: ['target-event-1'],
    });

    expect(spec.emptyState).toEqual({
      title: 'No target event totals',
      description: 'The current selection does not have renderable target event totals.',
    });
    expect(spec.warnings).toContain('No target event aggregate rows were found for the current filters.');
    expect(spec.series).toEqual([]);
  });

  it('returns a renderable empty state when no channels are selected', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'cumulative_by_channel',
      aggregates,
      selectedChannelKeys: [],
      valueMode: 'absolute',
      scaleMode: 'linear',
    });

    expect(spec.emptyState).toEqual({
      title: 'Select plotted channels',
      description: 'Choose one or more channels to render cumulative comparison damage.',
    });
    expect(spec.series).toEqual([]);
    expect(spec.xCategories).toEqual([]);
    expect(spec.warnings).toContain('No selected channels were provided.');
  });

  it('returns a renderable empty state when aggregates are missing', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'cumulative_by_channel',
      aggregates: null,
      selectedChannelKeys: ['bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
    });

    expect(spec.emptyState).toEqual({
      title: 'No comparison data available',
      description: 'Cumulative comparison values appear once comparison aggregates are available.',
    });
    expect(spec.warnings).toContain('Comparison aggregates are unavailable.');
  });

  it('builds signed target-delta values around a zero baseline', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'target_delta_vs_reference',
      aggregates: deltaAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force', 'bj_missing'],
      valueMode: 'absolute',
      scaleMode: 'log',
    });

    expect(spec.chartKind).toBe('diverging-bar');
    expect(spec.title).toBe('Target Δ vs Reference by channel');
    expect(spec.xCategories).toEqual(['BJ Y Force', 'BJ X Force']);
    expect(spec.series).toEqual([
      {
        id: 'target_delta',
        label: 'Signed delta (Target - Reference)',
        color: '#7c3aed',
        values: [-4, 20],
        flags: [undefined, undefined],
      },
    ]);
    expect(spec.legend).toEqual([{ label: 'Target - Reference Δ', color: '#7c3aed', role: 'delta' }]);
    expect(spec.yScale.mode).toBe('linear');
    expect(spec.yScale.domain).toEqual([-20, 20]);
    expect(spec.yScale.tickFormat).toBe('linear');
    expect(spec.emptyState).toBeNull();
  });

  it('builds target-delta values from selected events with a missing side treated as zero', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'target_delta_vs_reference',
      aggregates: eventAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
      selectedEventIds: ['target-event-1'],
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.subtitle).toContain('Selected events');
    expect(spec.series[0]?.values).toEqual([4, 11]);
    expect(spec.series[0]?.flags).toEqual(['low_reference', 'low_reference']);
    expect(spec.deltaRows).toMatchObject([
      {
        channelKey: 'bj_y_force',
        referenceDamage: 0,
        targetDamage: 4,
        signedDelta: 4,
      },
      {
        channelKey: 'bj_x_force',
        referenceDamage: 0,
        targetDamage: 11,
        signedDelta: 11,
      },
    ]);
    expect(spec.yScale.domain).toEqual([-11, 11]);
  });

  it('flags low-reference channels and keeps zero-only channels renderable', () => {
    const spec = buildDamage2DPlotSpec({
      plotType: 'target_delta_vs_reference',
      aggregates: deltaAggregates,
      selectedChannelKeys: ['bj_z_force'],
      valueMode: 'absolute',
      scaleMode: 'linear',
    });

    expect(spec.emptyState).toBeNull();
    expect(spec.xCategories).toEqual(['BJ Z Force']);
    expect(spec.series[0]?.values).toEqual([0]);
    expect(spec.series[0]?.flags).toEqual(['low_reference']);
    expect(spec.warnings.join(' ')).toContain('Low-reference channels');
  });

  it('computes a shared y-axis domain from cumulative and absolute-by-event maxima', () => {
    const baseInput = {
      aggregates: eventAggregates,
      selectedChannelKeys: ['bj_y_force', 'bj_x_force'],
      valueMode: 'absolute' as const,
      scaleMode: 'linear' as const,
      referenceEventIds: ['ref-event-1', 'ref-event-2'],
      targetEventIds: ['target-event-1'],
      selectedEventIds: [] as string[],
    };

    expect(computeSharedAbsoluteDamageYDomain(baseInput)).toEqual([0, 30]);

    const sharedYDomain = computeSharedAbsoluteDamageYDomain(baseInput);
    const cumulative = buildDamage2DPlotSpec({
      ...baseInput,
      plotType: 'cumulative_by_channel',
      sharedYDomain,
    });
    const reference = buildDamage2DPlotSpec({
      ...baseInput,
      plotType: 'reference_absolute_by_event',
      sharedYDomain,
    });
    const target = buildDamage2DPlotSpec({
      ...baseInput,
      plotType: 'target_absolute_by_event',
      sharedYDomain,
    });

    expect(cumulative.yScale.domain).toEqual([0, 30]);
    expect(reference.yScale.domain).toEqual([0, 30]);
    expect(target.yScale.domain).toEqual([0, 30]);
  });
});
