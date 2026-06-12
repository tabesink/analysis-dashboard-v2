import type { DamageComparisonState } from '@/types/damage-comparison';
import type { DamageInspectResponse } from '@/types/api';

export type DamageComparisonDataset = 'reference' | 'target';
export type DamageComparisonFactValueStatus = 'current' | 'stale';
export type DamageComparisonExcludedReason =
  | 'missing_cell'
  | 'invalid_status'
  | 'missing_damage'
  | 'non_finite_damage'
  | 'negative_damage';

export interface DamageComparisonRawFact {
  dataset: DamageComparisonDataset;
  event_id: string;
  program_id: string;
  version: string;
  channel_key: string;
  channel_label: string;
  damage: number;
  value_status: DamageComparisonFactValueStatus;
  source_status: string;
  stale_reason?: string | null;
}

export interface DamageComparisonExcludedFact {
  dataset: DamageComparisonDataset;
  event_id: string;
  program_id: string;
  version: string;
  channel_key: string;
  channel_label: string;
  reason: DamageComparisonExcludedReason;
  source_status: string | null;
}

export interface DamageComparisonRawFactBuildResult {
  facts: DamageComparisonRawFact[];
  excluded: DamageComparisonExcludedFact[];
}

function normalizeFactStatus(status: string): DamageComparisonFactValueStatus | null {
  if (status === 'stale') return 'stale';
  if (status === 'ok' || status === 'current') return 'current';
  return null;
}

function resolveDatasets(
  eventId: string,
  referenceEventIds: ReadonlySet<string>,
  targetEventIds: ReadonlySet<string>,
): DamageComparisonDataset[] {
  const datasets: DamageComparisonDataset[] = [];
  if (referenceEventIds.has(eventId)) datasets.push('reference');
  if (targetEventIds.has(eventId)) datasets.push('target');
  return datasets;
}

export function buildDamageComparisonRawFacts(params: {
  response: DamageInspectResponse;
  comparison: DamageComparisonState;
}): DamageComparisonRawFactBuildResult {
  const referenceEventIds = new Set(params.comparison.reference.selected_event_ids);
  const targetEventIds = new Set(params.comparison.target.selected_event_ids);
  const selectedChannelKeys = params.comparison.selected_channel_keys;

  const channelsByKey = new Map(
    params.response.channels.map((channel) => [channel.channel_key, channel] as const),
  );

  const facts: DamageComparisonRawFact[] = [];
  const excluded: DamageComparisonExcludedFact[] = [];

  for (const row of params.response.rows) {
    const datasets = resolveDatasets(row.event_id, referenceEventIds, targetEventIds);
    if (datasets.length === 0) continue;

    for (const channelKey of selectedChannelKeys) {
      const channel = channelsByKey.get(channelKey);
      if (!channel) continue;

      const cell = row.damages[channelKey];
      const sourceStatus = cell?.status ?? null;
      const baseExcluded = {
        event_id: row.event_id,
        program_id: row.program_id,
        version: row.version ?? '',
        channel_key: channelKey,
        channel_label: channel.channel_name,
        source_status: sourceStatus,
      };

      if (!cell) {
        for (const dataset of datasets) {
          excluded.push({
            dataset,
            ...baseExcluded,
            reason: 'missing_cell',
          });
        }
        continue;
      }

      const normalizedStatus = normalizeFactStatus(cell.status);
      if (!normalizedStatus) {
        for (const dataset of datasets) {
          excluded.push({
            dataset,
            ...baseExcluded,
            reason: 'invalid_status',
          });
        }
        continue;
      }

      if (typeof cell.damage !== 'number') {
        for (const dataset of datasets) {
          excluded.push({
            dataset,
            ...baseExcluded,
            reason: 'missing_damage',
          });
        }
        continue;
      }

      if (!Number.isFinite(cell.damage)) {
        for (const dataset of datasets) {
          excluded.push({
            dataset,
            ...baseExcluded,
            reason: 'non_finite_damage',
          });
        }
        continue;
      }

      if (cell.damage < 0) {
        for (const dataset of datasets) {
          excluded.push({
            dataset,
            ...baseExcluded,
            reason: 'negative_damage',
          });
        }
        continue;
      }

      for (const dataset of datasets) {
        facts.push({
          dataset,
          event_id: row.event_id,
          program_id: row.program_id,
          version: row.version ?? '',
          channel_key: channelKey,
          channel_label: channel.channel_name,
          damage: cell.damage,
          value_status: normalizedStatus,
          source_status: cell.status,
          stale_reason: cell.stale_reason,
        });
      }
    }
  }

  return { facts, excluded };
}
