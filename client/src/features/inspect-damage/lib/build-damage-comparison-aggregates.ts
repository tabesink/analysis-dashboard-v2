import type { DamageComparisonRawFact } from '@/features/inspect-damage/lib/build-damage-comparison-raw-facts';
import type {
  DamageComparisonState,
  DamageComparisonValueMode,
} from '@/types/damage-comparison';

type DatasetKey = DamageComparisonRawFact['dataset'];

interface DamageByDataset {
  reference: number;
  target: number;
}

export interface DamageComparisonAggregateInput {
  facts: DamageComparisonRawFact[];
  comparison: DamageComparisonState;
  low_reference_threshold?: number;
}

export interface ProgramVersionAggregateRow {
  dataset: DatasetKey;
  program_id: string;
  version: string;
  absolute_damage: number;
  normalized_damage: number;
  selected_value: number;
}

export interface EventChannelAggregateRow {
  dataset: DatasetKey;
  event_id: string;
  program_id: string;
  version: string;
  channel_key: string;
  channel_label: string;
  absolute_damage: number;
  normalized_damage: number;
  selected_value: number;
}

export interface ChannelAggregateRow {
  dataset: DatasetKey;
  channel_key: string;
  channel_label: string;
  absolute_damage: number;
  normalized_damage: number;
  selected_value: number;
}

export interface ChannelDeltaAggregateRow {
  channel_key: string;
  channel_label: string;
  reference_damage: number;
  target_damage: number;
  reference_normalized: number;
  target_normalized: number;
  absolute_delta: number;
  percent_difference: number | null;
  ratio: number | null;
  normalized_ratio: number | null;
  low_reference: boolean;
  low_reference_reason: 'missing_or_below_threshold' | null;
  selected_metric: 'absolute_delta' | 'normalized_ratio';
  selected_value: number | null;
}

interface AggregateMeta {
  value_mode: DamageComparisonValueMode;
  low_reference_threshold: number;
  program_version: {
    normalized_denominator: 'dataset_total_damage';
  };
  event_channel: {
    normalized_denominator: 'dataset_total_damage';
  };
  channel: {
    normalized_denominator: 'dataset_total_damage';
  };
  channel_delta: {
    normalized_denominator: 'target_channel_share_over_reference_channel_share';
  };
}

export interface DamageComparisonAggregateOutput {
  program_version: ProgramVersionAggregateRow[];
  event_channel: EventChannelAggregateRow[];
  channel: ChannelAggregateRow[];
  channel_delta: ChannelDeltaAggregateRow[];
  meta: AggregateMeta;
}

const DEFAULT_LOW_REFERENCE_THRESHOLD = 1e-12;

function asDatasetTotals(facts: DamageComparisonRawFact[]): DamageByDataset {
  const totals: DamageByDataset = { reference: 0, target: 0 };
  for (const fact of facts) {
    totals[fact.dataset] += fact.damage;
  }
  return totals;
}

function toSelectedValue(
  valueMode: DamageComparisonValueMode,
  absoluteDamage: number,
  normalizedDamage: number,
): number {
  return valueMode === 'normalized' ? normalizedDamage : absoluteDamage;
}

function normalizeByDataset(absoluteDamage: number, datasetTotal: number): number {
  if (datasetTotal <= 0) return 0;
  return absoluteDamage / datasetTotal;
}

function groupSum<T extends { damage: number }>(
  items: readonly T[],
  getKey: (item: T) => string,
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    sums.set(key, (sums.get(key) ?? 0) + item.damage);
  }
  return sums;
}

export function buildDamageComparisonAggregates(
  input: DamageComparisonAggregateInput,
): DamageComparisonAggregateOutput {
  const { facts, comparison } = input;
  const lowReferenceThreshold = input.low_reference_threshold ?? DEFAULT_LOW_REFERENCE_THRESHOLD;
  const datasetTotals = asDatasetTotals(facts);
  const valueMode = comparison.value_mode;

  const programVersionRows: ProgramVersionAggregateRow[] = [];
  const eventChannelRows: EventChannelAggregateRow[] = [];
  const channelRows: ChannelAggregateRow[] = [];
  const channelDeltaRows: ChannelDeltaAggregateRow[] = [];

  const programVersionSums = groupSum(
    facts,
    (fact) => `${fact.dataset}::${fact.program_id}::${fact.version}`,
  );
  for (const [key, absoluteDamage] of programVersionSums) {
    const [dataset, programId, version] = key.split('::');
    const normalizedDamage = normalizeByDataset(absoluteDamage, datasetTotals[dataset as DatasetKey]);
    programVersionRows.push({
      dataset: dataset as DatasetKey,
      program_id: programId,
      version,
      absolute_damage: absoluteDamage,
      normalized_damage: normalizedDamage,
      selected_value: toSelectedValue(valueMode, absoluteDamage, normalizedDamage),
    });
  }

  const eventChannelSums = groupSum(
    facts,
    (fact) => `${fact.dataset}::${fact.event_id}::${fact.program_id}::${fact.version}::${fact.channel_key}::${fact.channel_label}`,
  );
  for (const [key, absoluteDamage] of eventChannelSums) {
    const [dataset, eventId, programId, version, channelKey, channelLabel] = key.split('::');
    const normalizedDamage = normalizeByDataset(absoluteDamage, datasetTotals[dataset as DatasetKey]);
    eventChannelRows.push({
      dataset: dataset as DatasetKey,
      event_id: eventId,
      program_id: programId,
      version,
      channel_key: channelKey,
      channel_label: channelLabel,
      absolute_damage: absoluteDamage,
      normalized_damage: normalizedDamage,
      selected_value: toSelectedValue(valueMode, absoluteDamage, normalizedDamage),
    });
  }

  const channelSums = groupSum(facts, (fact) => `${fact.dataset}::${fact.channel_key}::${fact.channel_label}`);
  const channelByDatasetKey = new Map<string, { absolute: number; normalized: number; label: string }>();
  for (const [key, absoluteDamage] of channelSums) {
    const [dataset, channelKey, channelLabel] = key.split('::');
    const normalizedDamage = normalizeByDataset(absoluteDamage, datasetTotals[dataset as DatasetKey]);
    channelRows.push({
      dataset: dataset as DatasetKey,
      channel_key: channelKey,
      channel_label: channelLabel,
      absolute_damage: absoluteDamage,
      normalized_damage: normalizedDamage,
      selected_value: toSelectedValue(valueMode, absoluteDamage, normalizedDamage),
    });
    channelByDatasetKey.set(`${dataset}::${channelKey}`, {
      absolute: absoluteDamage,
      normalized: normalizedDamage,
      label: channelLabel,
    });
  }

  const seenChannelKeys = new Set<string>(channelRows.map((row) => row.channel_key));
  for (const channelKey of seenChannelKeys) {
    const reference = channelByDatasetKey.get(`reference::${channelKey}`);
    const target = channelByDatasetKey.get(`target::${channelKey}`);
    const referenceDamage = reference?.absolute ?? 0;
    const targetDamage = target?.absolute ?? 0;
    const referenceNormalized = reference?.normalized ?? 0;
    const targetNormalized = target?.normalized ?? 0;
    const lowReference = referenceDamage <= lowReferenceThreshold;

    const percentDifference = lowReference
      ? null
      : (100 * (targetDamage - referenceDamage)) / referenceDamage;
    const ratio = lowReference ? null : targetDamage / referenceDamage;
    const normalizedRatio =
      lowReference || referenceNormalized <= lowReferenceThreshold
        ? null
        : targetNormalized / referenceNormalized;

    const selectedMetric = valueMode === 'normalized' ? 'normalized_ratio' : 'absolute_delta';
    const selectedValue = selectedMetric === 'normalized_ratio' ? normalizedRatio : targetDamage - referenceDamage;

    channelDeltaRows.push({
      channel_key: channelKey,
      channel_label: reference?.label ?? target?.label ?? channelKey,
      reference_damage: referenceDamage,
      target_damage: targetDamage,
      reference_normalized: referenceNormalized,
      target_normalized: targetNormalized,
      absolute_delta: targetDamage - referenceDamage,
      percent_difference: percentDifference,
      ratio,
      normalized_ratio: normalizedRatio,
      low_reference: lowReference,
      low_reference_reason: lowReference ? 'missing_or_below_threshold' : null,
      selected_metric: selectedMetric,
      selected_value: selectedValue,
    });
  }

  return {
    program_version: programVersionRows,
    event_channel: eventChannelRows,
    channel: channelRows,
    channel_delta: channelDeltaRows,
    meta: {
      value_mode: valueMode,
      low_reference_threshold: lowReferenceThreshold,
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
}
