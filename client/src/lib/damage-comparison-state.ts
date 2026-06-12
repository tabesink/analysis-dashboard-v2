import type {
  DamageComparisonState,
  LoadDatasetSelectionState,
} from '@/types/damage-comparison';

export function getDefaultLoadDatasetSelectionState(): LoadDatasetSelectionState {
  return { selected_event_ids: [] };
}

export function getDefaultDamageComparisonState(): DamageComparisonState {
  return {
    reference: getDefaultLoadDatasetSelectionState(),
    target: getDefaultLoadDatasetSelectionState(),
    selected_channel_keys: [],
    value_mode: 'absolute',
    aggregation_event_scope: 'selected_only',
  };
}

function mergeLoadDatasetSelection(
  current: LoadDatasetSelectionState | undefined,
  patch: Partial<LoadDatasetSelectionState> | undefined,
): LoadDatasetSelectionState {
  const base = current ?? getDefaultLoadDatasetSelectionState();
  if (!patch) return base;
  return {
    selected_event_ids:
      patch.selected_event_ids !== undefined
        ? [...patch.selected_event_ids]
        : base.selected_event_ids,
  };
}

export function mergeDamageComparisonState(
  current: DamageComparisonState | undefined | null,
  patch: Partial<DamageComparisonState> | undefined,
): DamageComparisonState {
  const base = current ?? getDefaultDamageComparisonState();
  if (!patch) return base;

  return {
    reference: mergeLoadDatasetSelection(base.reference, patch.reference),
    target: mergeLoadDatasetSelection(base.target, patch.target),
    selected_channel_keys:
      patch.selected_channel_keys !== undefined
        ? [...patch.selected_channel_keys]
        : base.selected_channel_keys,
    value_mode: patch.value_mode ?? base.value_mode,
    aggregation_event_scope:
      patch.aggregation_event_scope ?? base.aggregation_event_scope,
  };
}

export function pruneMissingEventIds(
  state: DamageComparisonState,
  validEventIds: ReadonlySet<string>,
): DamageComparisonState {
  return {
    ...state,
    reference: {
      selected_event_ids: state.reference.selected_event_ids.filter((id) =>
        validEventIds.has(id),
      ),
    },
    target: {
      selected_event_ids: state.target.selected_event_ids.filter((id) =>
        validEventIds.has(id),
      ),
    },
  };
}

export function pruneMissingChannelKeys(
  state: DamageComparisonState,
  validChannelKeys: ReadonlySet<string>,
): DamageComparisonState {
  return {
    ...state,
    selected_channel_keys: state.selected_channel_keys.filter((key) =>
      validChannelKeys.has(key),
    ),
  };
}

type EventCatalogEntry = {
  event_id: string;
  program_id: string;
  version: string;
};

export function deriveProgramVersionScopeFromComparisonState(
  state: DamageComparisonState,
  eventCatalog: ReadonlyArray<EventCatalogEntry>,
): {
  program_ids: string[];
  versions: string[];
  program_version_keys: string[];
} {
  const selectedEventIds = new Set([
    ...state.reference.selected_event_ids,
    ...state.target.selected_event_ids,
  ]);

  const programIds = new Set<string>();
  const versions = new Set<string>();
  const programVersionKeys = new Set<string>();

  for (const event of eventCatalog) {
    if (!selectedEventIds.has(event.event_id)) continue;
    programIds.add(event.program_id);
    versions.add(event.version);
    programVersionKeys.add(`${event.program_id}::${event.version}`);
  }

  return {
    program_ids: [...programIds].sort((a, b) => a.localeCompare(b)),
    versions: [...versions].sort((a, b) => a.localeCompare(b)),
    program_version_keys: [...programVersionKeys].sort((a, b) => a.localeCompare(b)),
  };
}
