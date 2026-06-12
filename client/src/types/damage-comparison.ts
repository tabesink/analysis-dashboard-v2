/**
 * Reference vs Target damage comparison state persisted in inspect_damage_state.
 * @see docs/brainstorm/33_sidepanel_variant/PRD.md
 */

export type LoadDatasetSelectionState = {
  selected_event_ids: string[];
};

export type DamageComparisonValueMode = 'absolute' | 'normalized';

export type DamageComparisonAggregationScope = 'selected_only' | 'all_in_program_version';

export interface DamageComparisonState {
  reference: LoadDatasetSelectionState;
  target: LoadDatasetSelectionState;
  selected_channel_keys: string[];
  value_mode: DamageComparisonValueMode;
  aggregation_event_scope: DamageComparisonAggregationScope;
}
