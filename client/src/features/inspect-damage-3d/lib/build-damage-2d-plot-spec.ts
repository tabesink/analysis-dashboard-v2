import type {
  ChannelAggregateRow,
  DamageComparisonAggregateOutput,
  EventChannelAggregateRow,
} from '@/features/inspect-damage/lib/build-damage-comparison-aggregates';
import type { DamageComparisonValueMode } from '@/types/damage-comparison';
import { applyDamageScale } from './damage-scale';
import type {
  DamagePlotScaleMode,
  DamagePlotType,
} from './damage-plot-overlay-types';

export type Damage2DChartKind = 'grouped-bar' | 'stacked-bar' | 'diverging-bar';

type Damage2DLegendRole = 'reference' | 'target' | 'delta';
type Damage2DTickFormat = 'linear' | 'log' | 'percent' | 'ratio';

export type Damage2DPlotSpec = {
  plotType: DamagePlotType;
  chartKind: Damage2DChartKind;
  title: string;
  subtitle: string;
  xCategories: string[];
  yScale: {
    mode: DamagePlotScaleMode;
    domain: [number, number];
    tickFormat: Damage2DTickFormat;
  };
  series: Array<{
    id: string;
    label: string;
    color: string;
    values: number[];
    percentages?: number[];
    flags?: Array<'low_reference' | 'excluded' | undefined>;
  }>;
  legend: Array<{
    label: string;
    color: string;
    role: Damage2DLegendRole;
  }>;
  warnings: string[];
  emptyState: { title: string; description: string } | null;
  deltaRows?: Array<{
    channelKey: string;
    channelLabel: string;
    referenceDamage: number;
    targetDamage: number;
    signedDelta: number;
    valueModeLabel: DamageComparisonValueMode;
    lowReference: boolean;
  }>;
};

type BuildDamage2DPlotSpecInput = {
  plotType: DamagePlotType;
  aggregates: DamageComparisonAggregateOutput | null;
  selectedChannelKeys: readonly string[];
  valueMode: DamageComparisonValueMode;
  scaleMode: DamagePlotScaleMode;
  referenceEventIds?: readonly string[];
  targetEventIds?: readonly string[];
  selectedEventIds?: readonly string[];
  referenceScopeKey?: string | null;
  targetScopeKey?: string | null;
  referenceScopeLabel?: string | null;
  targetScopeLabel?: string | null;
  eventNameByEventId?: ReadonlyMap<string, string>;
  /** When set, absolute-by-event plots share this y-domain (reference + target). */
  sharedEventYDomain?: [number, number];
  /** When set, cumulative-by-channel uses this y-domain (independent from event plots). */
  cumulativeYDomain?: [number, number];
  eventThreshold?: number;
};

type SharedDamageDomainInput = Omit<
  BuildDamage2DPlotSpecInput,
  'plotType' | 'sharedEventYDomain' | 'cumulativeYDomain'
>;

const REFERENCE_COLOR = '#2563eb';
const TARGET_COLOR = '#dc2626';
const DELTA_COLOR = '#7c3aed';
const REFERENCE_EVENT_COLORS = [
  '#2563eb',
  '#60a5fa',
  '#93c5fd',
  '#1d4ed8',
  '#38bdf8',
  '#0ea5e9',
];
const TARGET_EVENT_COLORS = [
  '#dc2626',
  '#f87171',
  '#fca5a5',
  '#b91c1c',
  '#fb7185',
  '#e11d48',
];
const OTHER_EVENTS_COLOR = '#64748b';

const EMPTY_DOMAIN: [number, number] = [0, 1];
const DEFAULT_EVENT_THRESHOLD = 5;

function clampEventThreshold(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_EVENT_THRESHOLD;
  return Math.min(5, Math.max(1, Math.trunc(value)));
}

function eventSegmentColor(baseColor: string, index: number): string {
  const palette = baseColor === TARGET_COLOR ? TARGET_EVENT_COLORS : REFERENCE_EVENT_COLORS;
  return palette[index % palette.length];
}

function buildSubtitle(params: {
  valueMode: DamageComparisonValueMode;
  scaleMode: DamagePlotScaleMode;
  channelCount: number;
}): string {
  const valueModeLabel = params.valueMode === 'normalized' ? 'Normalized' : 'Absolute';
  const scaleModeLabel = params.scaleMode === 'log' ? 'Log scale' : 'Linear scale';
  return `${valueModeLabel} mode · ${scaleModeLabel} · ${params.channelCount} channels`;
}

function buildDatasetLegendLabel(params: {
  dataset: 'reference' | 'target';
  eventIds?: readonly string[];
  eventNameByEventId?: ReadonlyMap<string, string>;
}): string {
  const prefix = params.dataset === 'reference' ? 'Reference' : 'Target';
  const eventId = params.eventIds?.[0];
  if (!eventId) return prefix;
  const eventName = params.eventNameByEventId?.get(eventId) ?? eventId;
  return `${prefix} (${eventName})`;
}

function toSelectedValue(
  row: ChannelAggregateRow,
  valueMode: DamageComparisonValueMode,
): number {
  return valueMode === 'normalized' ? row.normalized_damage : row.absolute_damage;
}

function toSelectedEventValue(
  row: EventChannelAggregateRow,
  valueMode: DamageComparisonValueMode,
): number {
  return valueMode === 'normalized' ? row.normalized_damage : row.absolute_damage;
}

function toScaledDomain(maxValue: number): [number, number] {
  return maxValue > 0 ? [0, maxValue] : EMPTY_DOMAIN;
}

function resolveAbsoluteYDomain(
  computedMax: number,
  overrideDomain?: [number, number],
): [number, number] {
  if (overrideDomain) return overrideDomain;
  return toScaledDomain(computedMax);
}

function collectCumulativeAbsoluteByDatasetAndChannel(input: SharedDamageDomainInput): {
  labelByKey: Map<string, string>;
  valuesByDatasetAndChannel: Map<string, number>;
} | null {
  if (!input.aggregates || input.selectedChannelKeys.length === 0) return null;

  const selectedSet = new Set(input.selectedChannelKeys);
  const hasEventSelection = (input.selectedEventIds?.length ?? 0) > 0;
  const selectedEventSet = new Set(input.selectedEventIds ?? []);
  const labelByKey = new Map<string, string>();
  const valuesByDatasetAndChannel = new Map<string, number>();

  if (hasEventSelection) {
    for (const row of input.aggregates.event_channel) {
      if (!selectedSet.has(row.channel_key) || !selectedEventSet.has(row.event_id)) continue;
      labelByKey.set(row.channel_key, row.channel_label || row.channel_key);
      const key = `${row.dataset}::${row.channel_key}`;
      valuesByDatasetAndChannel.set(
        key,
        (valuesByDatasetAndChannel.get(key) ?? 0) + row.absolute_damage,
      );
    }
  } else {
    for (const row of input.aggregates.channel) {
      if (!selectedSet.has(row.channel_key)) continue;
      labelByKey.set(row.channel_key, row.channel_label || row.channel_key);
      valuesByDatasetAndChannel.set(`${row.dataset}::${row.channel_key}`, row.absolute_damage);
    }
  }

  if (labelByKey.size === 0) return null;
  return { labelByKey, valuesByDatasetAndChannel };
}

function toCumulativeDisplayPair(
  referenceAbsolute: number,
  targetAbsolute: number,
  valueMode: DamageComparisonValueMode,
  scaleMode: DamagePlotScaleMode,
): { reference: number; target: number } {
  if (valueMode === 'normalized') {
    const channelMax = Math.max(referenceAbsolute, targetAbsolute);
    const referenceNormalized = channelMax > 0 ? referenceAbsolute / channelMax : 0;
    const targetNormalized = channelMax > 0 ? targetAbsolute / channelMax : 0;
    return {
      reference: applyDamageScale(referenceNormalized, scaleMode),
      target: applyDamageScale(targetNormalized, scaleMode),
    };
  }

  return {
    reference: applyDamageScale(referenceAbsolute, scaleMode),
    target: applyDamageScale(targetAbsolute, scaleMode),
  };
}

function computeCumulativeScaledMax(input: SharedDamageDomainInput): number | null {
  const collected = collectCumulativeAbsoluteByDatasetAndChannel(input);
  if (!collected) return null;

  const channelKeys = input.selectedChannelKeys.filter((channelKey) =>
    collected.labelByKey.has(channelKey),
  );
  const scaledValues = channelKeys.flatMap((channelKey) => {
    const pair = toCumulativeDisplayPair(
      collected.valuesByDatasetAndChannel.get(`reference::${channelKey}`) ?? 0,
      collected.valuesByDatasetAndChannel.get(`target::${channelKey}`) ?? 0,
      input.valueMode,
      input.scaleMode,
    );
    return [pair.reference, pair.target];
  });

  return Math.max(0, ...scaledValues);
}

type EventStackSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
  percentages: number[];
};

function buildThresholdedEventSeries(params: {
  orderedEventIds: string[];
  channelKeys: string[];
  valuesByEventAndChannel: Map<string, number>;
  eventNameByEventId?: ReadonlyMap<string, string>;
  seriesId: string;
  seriesColor: string;
  scaleMode: DamagePlotScaleMode;
  eventThreshold: number | undefined;
}): EventStackSeries[] {
  const {
    orderedEventIds,
    channelKeys,
    valuesByEventAndChannel,
    eventNameByEventId,
    seriesId,
    seriesColor,
    scaleMode,
  } = params;
  const threshold = clampEventThreshold(params.eventThreshold);
  const originalOrder = new Map(orderedEventIds.map((eventId, index) => [eventId, index]));
  const eventTotals = new Map(
    orderedEventIds.map((eventId) => [
      eventId,
      channelKeys.reduce(
        (sum, channelKey) => sum + (valuesByEventAndChannel.get(`${eventId}::${channelKey}`) ?? 0),
        0,
      ),
    ]),
  );
  const visibleEventIds = [...orderedEventIds]
    .sort((left, right) => {
      const totalDiff = (eventTotals.get(right) ?? 0) - (eventTotals.get(left) ?? 0);
      if (totalDiff !== 0) return totalDiff;
      return (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0);
    })
    .slice(0, threshold);
  const otherEventIds = orderedEventIds.filter((eventId) => !visibleEventIds.includes(eventId));
  const channelTotals = channelKeys.map((channelKey) =>
    orderedEventIds.reduce(
      (sum, eventId) => sum + (valuesByEventAndChannel.get(`${eventId}::${channelKey}`) ?? 0),
      0,
    ),
  );

  const toPercentages = (rawValues: number[]) =>
    rawValues.map((value, index) => {
      const total = channelTotals[index] ?? 0;
      return total > 0 ? (100 * value) / total : 0;
    });

  const series = visibleEventIds.map((eventId, eventIndex) => {
    const rawValues = channelKeys.map(
      (channelKey) => valuesByEventAndChannel.get(`${eventId}::${channelKey}`) ?? 0,
    );
    return {
      id: `${seriesId}-${eventIndex}`,
      label: eventNameByEventId?.get(eventId) ?? eventId,
      color: eventSegmentColor(seriesColor, eventIndex),
      values: rawValues.map((value) => applyDamageScale(value, scaleMode)),
      percentages: toPercentages(rawValues),
    };
  });

  if (otherEventIds.length > 0) {
    const rawValues = channelKeys.map((channelKey) =>
      otherEventIds.reduce(
        (sum, eventId) => sum + (valuesByEventAndChannel.get(`${eventId}::${channelKey}`) ?? 0),
        0,
      ),
    );
    series.push({
      id: `${seriesId}-other`,
      label: 'Other events',
      color: OTHER_EVENTS_COLOR,
      values: rawValues.map((value) => applyDamageScale(value, scaleMode)),
      percentages: toPercentages(rawValues),
    });
  }

  return series;
}

function computeEventStackedScaledMax(
  input: SharedDamageDomainInput,
  dataset: 'reference' | 'target',
): number | null {
  if (!input.aggregates || input.selectedChannelKeys.length === 0) return null;

  const selectedChannelSet = new Set(input.selectedChannelKeys);
  const datasetEventIds =
    dataset === 'reference' ? (input.referenceEventIds ?? []) : (input.targetEventIds ?? []);
  const datasetEventSet = new Set(datasetEventIds);
  const labelByChannelKey = new Map<string, string>();
  const valuesByEventAndChannel = new Map<string, number>();
  const eventIds = new Set<string>();

  for (const row of input.aggregates.event_channel) {
    if (row.dataset !== dataset) continue;
    if (!selectedChannelSet.has(row.channel_key)) continue;
    if (datasetEventSet.size > 0 && !datasetEventSet.has(row.event_id)) continue;
    labelByChannelKey.set(row.channel_key, row.channel_label || row.channel_key);
    eventIds.add(row.event_id);
    const key = `${row.event_id}::${row.channel_key}`;
    valuesByEventAndChannel.set(
      key,
      (valuesByEventAndChannel.get(key) ?? 0) + toSelectedEventValue(row, input.valueMode),
    );
  }

  const orderedEventIds =
    datasetEventIds.length > 0
      ? datasetEventIds.filter((eventId) => eventIds.has(eventId))
      : Array.from(eventIds).sort((a, b) => a.localeCompare(b));
  const channelKeys = input.selectedChannelKeys.filter((channelKey) => labelByChannelKey.has(channelKey));
  if (orderedEventIds.length === 0 || channelKeys.length === 0) return null;

  const eventSeries = buildThresholdedEventSeries({
    orderedEventIds,
    channelKeys,
    valuesByEventAndChannel,
    seriesId: `${dataset}_event`,
    seriesColor: dataset === 'reference' ? REFERENCE_COLOR : TARGET_COLOR,
    scaleMode: input.scaleMode,
    eventThreshold: input.eventThreshold,
    eventNameByEventId: input.eventNameByEventId,
  });
  const stackedTotals = channelKeys.map((_, channelIndex) =>
    eventSeries.reduce((sum, item) => sum + (item.values[channelIndex] ?? 0), 0),
  );

  return Math.max(0, ...stackedTotals);
}

/** [0, max] y-domain for cumulative-by-channel (independent from event plots). */
export function computeCumulativeDamageYDomain(input: SharedDamageDomainInput): [number, number] {
  const cumulativeMax = computeCumulativeScaledMax(input);
  return toScaledDomain(cumulativeMax ?? 0);
}

/** Shared [0, max] y-domain for reference and target absolute-by-event plots. */
export function computeSharedEventDamageYDomain(input: SharedDamageDomainInput): [number, number] {
  const maxima = [
    computeEventStackedScaledMax(input, 'reference'),
    computeEventStackedScaledMax(input, 'target'),
  ].filter((value): value is number => value !== null);

  return toScaledDomain(maxima.length > 0 ? Math.max(0, ...maxima) : 0);
}

function buildAbsoluteByEventSpec(params: {
  input: BuildDamage2DPlotSpecInput;
  dataset: 'reference' | 'target';
  title: string;
  seriesId: string;
  seriesLabel: string;
  seriesColor: string;
}): Damage2DPlotSpec {
  const { input } = params;
  const baseSpec = makeBaseSpec(input);
  if (!input.aggregates) {
    return {
      ...baseSpec,
      title: params.title,
      legend: [{ label: params.seriesLabel, color: params.seriesColor, role: params.dataset }],
      warnings: [],
      emptyState: {
        title: 'No comparison data available',
        description: `${params.seriesLabel} event totals appear once comparison aggregates are available.`,
      },
    };
  }

  if (input.selectedChannelKeys.length === 0) {
    return {
      ...baseSpec,
      title: params.title,
      legend: [{ label: params.seriesLabel, color: params.seriesColor, role: params.dataset }],
      warnings: [],
      emptyState: {
        title: 'Select plotted channels',
        description: `Choose one or more channels to render ${params.seriesLabel.toLowerCase()} event totals.`,
      },
    };
  }

  const selectedChannelSet = new Set(input.selectedChannelKeys);
  const datasetEventIds =
    params.dataset === 'reference'
      ? (input.referenceEventIds ?? [])
      : (input.targetEventIds ?? []);
  const datasetEventSet = new Set(datasetEventIds);
  const labelByChannelKey = new Map<string, string>();
  const valuesByEventAndChannel = new Map<string, number>();
  const eventIds = new Set<string>();

  for (const row of input.aggregates.event_channel) {
    if (row.dataset !== params.dataset) continue;
    if (!selectedChannelSet.has(row.channel_key)) continue;
    if (datasetEventSet.size > 0 && !datasetEventSet.has(row.event_id)) continue;
    labelByChannelKey.set(row.channel_key, row.channel_label || row.channel_key);
    eventIds.add(row.event_id);
    const key = `${row.event_id}::${row.channel_key}`;
    valuesByEventAndChannel.set(
      key,
      (valuesByEventAndChannel.get(key) ?? 0) + toSelectedEventValue(row, input.valueMode),
    );
  }

  const orderedEventIds =
    datasetEventIds.length > 0
      ? datasetEventIds.filter((eventId) => eventIds.has(eventId))
      : Array.from(eventIds).sort((a, b) => a.localeCompare(b));
  const channelKeys = input.selectedChannelKeys.filter((channelKey) => labelByChannelKey.has(channelKey));
  if (orderedEventIds.length === 0 || channelKeys.length === 0) {
    return {
      ...baseSpec,
      title: params.title,
      legend: [{ label: params.seriesLabel, color: params.seriesColor, role: params.dataset }],
      warnings: [],
      emptyState: {
        title: `No ${params.seriesLabel.toLowerCase()} event totals`,
        description: `The current selection does not have renderable ${params.seriesLabel.toLowerCase()} event totals.`,
      },
    };
  }

  const series = buildThresholdedEventSeries({
    orderedEventIds,
    channelKeys,
    valuesByEventAndChannel,
    seriesId: params.seriesId,
    seriesColor: params.seriesColor,
    scaleMode: input.scaleMode,
    eventThreshold: input.eventThreshold,
    eventNameByEventId: input.eventNameByEventId,
  });
  const stackedTotals = channelKeys.map((_, channelIndex) =>
    series.reduce((sum, item) => sum + (item.values[channelIndex] ?? 0), 0),
  );
  const maxValue = Math.max(0, ...stackedTotals);

  return {
    ...baseSpec,
    chartKind: 'stacked-bar',
    title: params.title,
    xCategories: channelKeys.map((channelKey) => labelByChannelKey.get(channelKey) ?? channelKey),
    yScale: {
      mode: input.scaleMode,
      domain: resolveAbsoluteYDomain(maxValue, input.sharedEventYDomain),
      tickFormat: input.scaleMode === 'log' ? 'log' : input.valueMode === 'normalized' ? 'percent' : 'linear',
    },
    series,
    legend: [{ label: params.seriesLabel, color: params.seriesColor, role: params.dataset }],
  };
}

function makeBaseSpec(input: BuildDamage2DPlotSpecInput): Damage2DPlotSpec {
  return {
    plotType: input.plotType,
    chartKind: 'grouped-bar',
    title: 'Cumulative Damage by Channel',
    subtitle: '',
    xCategories: [],
    yScale: {
      mode: input.scaleMode,
      domain: EMPTY_DOMAIN,
      tickFormat: input.scaleMode === 'log' ? 'log' : 'linear',
    },
    series: [],
    legend: [
      { label: 'Reference', color: REFERENCE_COLOR, role: 'reference' },
      { label: 'Target', color: TARGET_COLOR, role: 'target' },
    ],
    warnings: [],
    emptyState: null,
  };
}

export function buildDamage2DPlotSpec(input: BuildDamage2DPlotSpecInput): Damage2DPlotSpec {
  const baseSpec = makeBaseSpec(input);
  if (input.plotType === 'reference_absolute_by_event') {
    return buildAbsoluteByEventSpec({
      input,
      dataset: 'reference',
      title: 'Damage by Event (Reference)',
      seriesId: 'reference_event',
      seriesLabel: 'Reference',
      seriesColor: REFERENCE_COLOR,
    });
  }

  if (input.plotType === 'target_absolute_by_event') {
    return buildAbsoluteByEventSpec({
      input,
      dataset: 'target',
      title: 'Damage by Event (Target)',
      seriesId: 'target_event',
      seriesLabel: 'Target',
      seriesColor: TARGET_COLOR,
    });
  }

  if (input.plotType === 'target_delta_vs_reference') {
    if (!input.aggregates) {
      return {
        ...baseSpec,
        chartKind: 'diverging-bar',
        title: 'Target Δ vs Reference Damage by Channel',
        warnings: [],
        emptyState: {
          title: 'No comparison data available',
          description: 'Target delta values appear once comparison aggregates are available.',
        },
      };
    }

    if (input.selectedChannelKeys.length === 0) {
      return {
        ...baseSpec,
        chartKind: 'diverging-bar',
        title: 'Target Δ vs Reference Damage by Channel',
        warnings: [],
        emptyState: {
          title: 'Select plotted channels',
          description: 'Choose one or more channels to render target delta values.',
        },
      };
    }

    if ((input.selectedEventIds?.length ?? 0) > 0) {
      const selectedSet = new Set(input.selectedChannelKeys);
      const selectedEventSet = new Set(input.selectedEventIds);
      const labelByKey = new Map<string, string>();
      const referenceByChannel = new Map<string, number>();
      const targetByChannel = new Map<string, number>();

      for (const row of input.aggregates.event_channel) {
        if (!selectedSet.has(row.channel_key) || !selectedEventSet.has(row.event_id)) continue;
        labelByKey.set(row.channel_key, row.channel_label || row.channel_key);
        const values = row.dataset === 'reference' ? referenceByChannel : targetByChannel;
        values.set(
          row.channel_key,
          (values.get(row.channel_key) ?? 0) + toSelectedEventValue(row, input.valueMode),
        );
      }

      const channelKeys = input.selectedChannelKeys.filter((channelKey) => labelByKey.has(channelKey));
      if (channelKeys.length === 0) {
        return {
          ...baseSpec,
          chartKind: 'diverging-bar',
          title: 'Target Δ vs Reference Damage by Channel',
          warnings: [],
          emptyState: {
            title: 'No selected event deltas',
            description: 'The selected events do not have renderable target-vs-reference deltas.',
          },
        };
      }

      const deltaRows = channelKeys.map((channelKey) => {
        const referenceDamage = referenceByChannel.get(channelKey) ?? 0;
        const targetDamage = targetByChannel.get(channelKey) ?? 0;
        const signedDelta = targetDamage - referenceDamage;
        const lowReference = referenceDamage <= input.aggregates!.meta.low_reference_threshold;
        return {
          channelKey,
          channelLabel: labelByKey.get(channelKey) ?? channelKey,
          referenceDamage,
          targetDamage,
          signedDelta,
          valueModeLabel: input.valueMode,
          lowReference,
        };
      });
      const maxAbs = Math.max(0, ...deltaRows.map((row) => Math.abs(row.signedDelta)));
      const domain: [number, number] = maxAbs > 0 ? [-maxAbs, maxAbs] : [-1, 1];
      const lowReferenceRows = deltaRows.filter((row) => row.lowReference);
      const warnings =
        lowReferenceRows.length > 0
          ? [
              `Low-reference channels are flagged and ratio-style metrics are suppressed (${lowReferenceRows.length} of ${deltaRows.length}).`,
            ]
          : [];

      return {
        ...baseSpec,
        chartKind: 'diverging-bar',
        title: 'Target Δ vs Reference Damage by Channel',
        xCategories: deltaRows.map((row) => row.channelLabel),
        yScale: {
          mode: 'linear',
          domain,
          tickFormat: 'linear',
        },
        series: [
          {
            id: 'target_delta',
            label: 'Signed delta (Target - Reference)',
            color: DELTA_COLOR,
            values: deltaRows.map((row) => row.signedDelta),
            flags: deltaRows.map((row) => (row.lowReference ? 'low_reference' : undefined)),
          },
        ],
        legend: [{ label: 'Target - Reference Δ', color: DELTA_COLOR, role: 'delta' }],
        warnings,
        deltaRows,
      };
    }

    const rowByChannelKey = new Map(
      input.aggregates.channel_delta.map((row) => [row.channel_key, row] as const),
    );
    const selectedRows = input.selectedChannelKeys
      .map((channelKey) => rowByChannelKey.get(channelKey))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (selectedRows.length === 0) {
      return {
        ...baseSpec,
        chartKind: 'diverging-bar',
        title: 'Target Δ vs Reference Damage by Channel',
        warnings: [],
        emptyState: {
          title: 'No channel delta totals',
          description: 'The selected channels do not have renderable target-vs-reference deltas.',
        },
      };
    }

    const xCategories = selectedRows.map((row) => row.channel_label || row.channel_key);
    const signedValues = selectedRows.map((row) => row.absolute_delta);
    const maxAbs = Math.max(0, ...signedValues.map((value) => Math.abs(value)));
    const domain: [number, number] = maxAbs > 0 ? [-maxAbs, maxAbs] : [-1, 1];
    const lowReferenceRows = selectedRows.filter((row) => row.low_reference);
    const warnings =
      lowReferenceRows.length > 0
        ? [
            `Low-reference channels are flagged and ratio-style metrics are suppressed (${lowReferenceRows.length} of ${selectedRows.length}).`,
          ]
        : [];

    return {
      ...baseSpec,
      chartKind: 'diverging-bar',
      title: 'Target Δ vs Reference Damage by Channel',
      xCategories,
      yScale: {
        mode: 'linear',
        domain,
        tickFormat: 'linear',
      },
      series: [
        {
          id: 'target_delta',
          label: 'Signed delta (Target - Reference)',
          color: DELTA_COLOR,
          values: signedValues,
          flags: selectedRows.map((row) => (row.low_reference ? 'low_reference' : undefined)),
        },
      ],
      legend: [{ label: 'Target - Reference Δ', color: DELTA_COLOR, role: 'delta' }],
      warnings,
      deltaRows: selectedRows.map((row) => ({
        channelKey: row.channel_key,
        channelLabel: row.channel_label || row.channel_key,
        referenceDamage: row.reference_damage,
        targetDamage: row.target_damage,
        signedDelta: row.absolute_delta,
        valueModeLabel: input.valueMode,
        lowReference: row.low_reference,
      })),
    };
  }

  if (input.plotType !== 'cumulative_by_channel') {
    return {
      ...baseSpec,
      warnings: ['Plot type is not yet supported by the 2D spec builder.'],
      emptyState: {
        title: 'Plot type coming soon',
        description: 'Only cumulative-by-channel is currently available for 2D plot specs.',
      },
    };
  }

  if (!input.aggregates) {
    return {
      ...baseSpec,
      warnings: [],
      emptyState: {
        title: 'No comparison data available',
        description: 'Cumulative comparison values appear once comparison aggregates are available.',
      },
    };
  }

  if (input.selectedChannelKeys.length === 0) {
    return {
      ...baseSpec,
      warnings: [],
      emptyState: {
        title: 'Select plotted channels',
        description: 'Choose one or more channels to render cumulative comparison damage.',
      },
    };
  }

  const hasEventSelection = (input.selectedEventIds?.length ?? 0) > 0;
  const collected = collectCumulativeAbsoluteByDatasetAndChannel(input);
  if (!collected) {
    return {
      ...baseSpec,
      warnings: [],
      emptyState: {
        title: hasEventSelection ? 'No selected event totals' : 'No cumulative channel totals',
        description: hasEventSelection
          ? 'The selected events do not have renderable cumulative totals.'
          : 'The selected channels do not have renderable cumulative totals.',
      },
    };
  }

  const channelKeys = input.selectedChannelKeys.filter((channelKey) =>
    collected.labelByKey.has(channelKey),
  );
  const xCategories = channelKeys.map((channelKey) => collected.labelByKey.get(channelKey) ?? channelKey);

  const referenceValues = channelKeys.map((channelKey) =>
    toCumulativeDisplayPair(
      collected.valuesByDatasetAndChannel.get(`reference::${channelKey}`) ?? 0,
      collected.valuesByDatasetAndChannel.get(`target::${channelKey}`) ?? 0,
      input.valueMode,
      input.scaleMode,
    ).reference,
  );
  const targetValues = channelKeys.map((channelKey) =>
    toCumulativeDisplayPair(
      collected.valuesByDatasetAndChannel.get(`reference::${channelKey}`) ?? 0,
      collected.valuesByDatasetAndChannel.get(`target::${channelKey}`) ?? 0,
      input.valueMode,
      input.scaleMode,
    ).target,
  );

  const maxValue = Math.max(0, ...referenceValues, ...targetValues);

  return {
    ...baseSpec,
    xCategories,
    yScale: {
      mode: input.scaleMode,
      domain: resolveAbsoluteYDomain(maxValue, input.cumulativeYDomain),
      tickFormat: input.scaleMode === 'log' ? 'log' : input.valueMode === 'normalized' ? 'percent' : 'linear',
    },
    series: [
      {
        id: 'reference',
        label: 'Reference',
        color: REFERENCE_COLOR,
        values: referenceValues,
      },
      {
        id: 'target',
        label: 'Target',
        color: TARGET_COLOR,
        values: targetValues,
      },
    ],
    legend: [
      {
        label: buildDatasetLegendLabel({
          dataset: 'reference',
          eventIds: input.referenceEventIds,
          eventNameByEventId: input.eventNameByEventId,
        }),
        color: REFERENCE_COLOR,
        role: 'reference',
      },
      {
        label: buildDatasetLegendLabel({
          dataset: 'target',
          eventIds: input.targetEventIds,
          eventNameByEventId: input.eventNameByEventId,
        }),
        color: TARGET_COLOR,
        role: 'target',
      },
    ],
  };
}
