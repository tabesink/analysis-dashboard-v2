import {
  buildDamageComparisonAggregates,
  type DamageComparisonAggregateOutput,
} from '@/features/inspect-damage/lib/build-damage-comparison-aggregates';
import { buildDamageComparisonRawFacts } from '@/features/inspect-damage/lib/build-damage-comparison-raw-facts';
import type { DamageComparisonState } from '@/types/damage-comparison';
import type { DamageInspectResponse } from '@/types/api';

type ComparisonEmptyStateCode =
  | 'missing_reference_events'
  | 'missing_target_events'
  | 'missing_channels'
  | 'missing_damage_response'
  | 'missing_usable_damage';

type ComparisonEmptyState = {
  code: ComparisonEmptyStateCode;
  title: string;
  description: string;
};

type ComparisonSelectionSummary = {
  referenceEventCount: number;
  targetEventCount: number;
  channelCount: number;
  valueMode: DamageComparisonState['value_mode'];
};

export type DamageComparisonViewModel = {
  inspectEventIds: string[];
  emptyState: ComparisonEmptyState | null;
  selectionSummary: ComparisonSelectionSummary;
  subtitleText: string;
  legendText: string;
  aggregates: DamageComparisonAggregateOutput | null;
};

export function getComparisonInspectEventIds(
  comparison: DamageComparisonState,
): string[] {
  return [...new Set([...comparison.reference.selected_event_ids, ...comparison.target.selected_event_ids])];
}

function getComparisonEmptyState(params: {
  comparison: DamageComparisonState;
  response: DamageInspectResponse | null;
  hasFacts: boolean;
}): ComparisonEmptyState | null {
  const { comparison, response, hasFacts } = params;
  if (comparison.reference.selected_event_ids.length === 0) {
    return {
      code: 'missing_reference_events',
      title: 'Select Reference events',
      description: 'Choose at least one Reference event to compare against Target.',
    };
  }
  if (comparison.target.selected_event_ids.length === 0) {
    return {
      code: 'missing_target_events',
      title: 'Select Target events',
      description: 'Choose at least one Target event to complete the comparison.',
    };
  }
  if (comparison.selected_channel_keys.length === 0) {
    return {
      code: 'missing_channels',
      title: 'Select plotted channels',
      description: 'Choose one or more damage channels to render comparison plots.',
    };
  }
  if (!response) {
    return {
      code: 'missing_damage_response',
      title: 'Loading damage data',
      description: 'Comparison plots appear once inspect-damage results load.',
    };
  }
  if (!hasFacts) {
    return {
      code: 'missing_usable_damage',
      title: 'No usable damage values',
      description: 'Selected events/channels do not contain renderable damage values.',
    };
  }
  return null;
}

function buildSubtitleText(summary: ComparisonSelectionSummary): string {
  return [
    `Reference ${summary.referenceEventCount} events`,
    `Target ${summary.targetEventCount} events`,
    `${summary.channelCount} channels`,
  ].join(' · ');
}

function buildLegendText(params: {
  summary: ComparisonSelectionSummary;
  excludedCount: number;
  lowReferenceCount: number;
}): string {
  const modePrefix =
    params.summary.valueMode === 'normalized' ? 'Normalized mode' : 'Absolute mode';
  const excludedText =
    params.excludedCount > 0
      ? `${params.excludedCount} cells excluded due to missing/invalid damage values`
      : 'No cells excluded';
  const lowReferenceText =
    params.lowReferenceCount > 0
      ? `${params.lowReferenceCount} channels flagged for low reference values`
      : 'No low-reference channel guards triggered';
  return `${modePrefix} · ${excludedText} · ${lowReferenceText}`;
}

export function buildDamageComparisonViewModel(params: {
  comparison: DamageComparisonState;
  response: DamageInspectResponse | null;
}): DamageComparisonViewModel {
  const selectionSummary: ComparisonSelectionSummary = {
    referenceEventCount: params.comparison.reference.selected_event_ids.length,
    targetEventCount: params.comparison.target.selected_event_ids.length,
    channelCount: params.comparison.selected_channel_keys.length,
    valueMode: params.comparison.value_mode,
  };
  const inspectEventIds = getComparisonInspectEventIds(params.comparison);
  const subtitleText = buildSubtitleText(selectionSummary);

  const rawFacts = params.response
    ? buildDamageComparisonRawFacts({
        response: params.response,
        comparison: params.comparison,
      })
    : null;
  const hasFacts = (rawFacts?.facts.length ?? 0) > 0;
  const emptyState = getComparisonEmptyState({
    comparison: params.comparison,
    response: params.response,
    hasFacts,
  });

  const aggregates = hasFacts
    ? buildDamageComparisonAggregates({
        facts: rawFacts!.facts,
        comparison: params.comparison,
      })
    : null;

  const lowReferenceCount =
    aggregates?.channel_delta.filter((row) => row.low_reference).length ?? 0;
  const legendText = buildLegendText({
    summary: selectionSummary,
    excludedCount: rawFacts?.excluded.length ?? 0,
    lowReferenceCount,
  });

  return {
    inspectEventIds,
    emptyState,
    selectionSummary,
    subtitleText,
    legendText,
    aggregates,
  };
}
