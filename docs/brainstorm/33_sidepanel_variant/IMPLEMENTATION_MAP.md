# IMPLEMENTATION_MAP — Side Panel Variant (SPV-33)

This map is the shared technical truth for all `SPV-33-*` slices.

## End-to-end flow and state model

```text
Comparison route opens
  -> load route-scoped session comparison state
  -> load shared event catalog and global filters
  -> render Reference and Target event trees from the same filtered catalog
  -> user changes Reference events, Target events, channel keys, or value mode
  -> persist only comparison state, not computed plot rows
  -> inspect damage for union of selected Reference and Target event IDs
  -> build event x channel facts from inspect response
  -> split facts into Reference and Target memberships
  -> aggregate selected facts into comparison plot series
  -> render v1 plot families with clear mode, count, and data-quality context
```

Canonical state:

```ts
type LoadDatasetSelection = {
  selected_event_ids: string[];
};

type DamageComparisonState = {
  reference: LoadDatasetSelection;
  target: LoadDatasetSelection;
  selected_channel_keys: string[];
  value_mode: 'absolute' | 'normalized';
  aggregation_event_scope: 'selected_only' | 'all_in_program_version';
};
```

Current frontend baseline:

- `client/src/types/damage-comparison.ts` defines `LoadDatasetSelectionState`, `DamageComparisonValueMode`, `DamageComparisonAggregationScope`, and `DamageComparisonState`.
- `client/src/lib/damage-comparison-state.ts` defines `getDefaultDamageComparisonState()`, `mergeDamageComparisonState()`, `pruneMissingEventIds()`, and `pruneMissingChannelKeys()`.
- `client/src/lib/damage-comparison-state.ts` now also defines `deriveProgramVersionScopeFromComparisonState()` for deriving program/version scope from selected comparison event IDs plus the current catalog.
- `client/src/lib/inspect-damage-table-preferences.ts` imports those helpers and `mergeInspectDamageState()` now merges/defaults `comparison` alongside existing `table_preferences`.
- Future agents should treat these files as the starting contract and extend them only when a slice needs a new helper, test, or UI-facing adapter.

## Canonical invariants

1. Event IDs are the only persisted selection truth for Reference and Target.
2. Program and version scopes are derived from selected event IDs and the current event catalog.
3. Reference and Target checked state are independent; selecting one must not mutate the other.
4. The same event may appear in both Reference and Target in v1.
5. Selected channel keys are analysis state, separate from table column visibility/layout state.
6. Global filters apply to both Reference and Target trees in v1.
7. Session stores selection spec only; computed plot facts and aggregates are rebuilt from current inspect-damage data.
8. Plot inputs are event x channel facts filtered by dataset membership, selected event IDs, selected channel keys, and valid damage-cell status.
9. Default aggregation scope is `selected_only`; `all_in_program_version` must remain explicit when added.
10. Low-reference comparison rows must avoid misleading finite percent or ratio values.

## Ownership boundaries

- **Comparison state helpers own**
  - default state
  - route-scoped merge/persistence shape
  - pruning missing event IDs and channel keys
  - deriving program/version scopes from selected event IDs
  - tests proving `mergeInspectDamageState()` keeps comparison state separate from table preferences
- **Shared side-panel/event-tree UI owns**
  - labeled Reference and Target sections
  - independent checked state, All/None actions, counts, and empty guidance
  - reuse of the existing side-panel shell and hierarchical event-tree behavior
- **Channel picker owns**
  - canonical damage channel labels and keys
  - persisted plotted-channel selection
  - separation from metadata/table column visibility preferences
- **Raw comparison dataset builder owns**
  - splitting union inspect response into Reference and Target facts
  - overlap semantics when an event is selected in both datasets
  - filtering selected channels and marking/dropping invalid damage cells according to view rules
- **Aggregation module owns**
  - cumulative program/version damage
  - event damage by channel
  - cumulative channel damage
  - target-vs-reference delta, ratio, percent-difference, and normalized-ratio metrics
  - normalized value semantics and low-reference guards
- **Comparison plot UI owns**
  - data fetching/wiring
  - empty states for missing Reference, Target, channels, or damage data
  - subtitles, legends, labels, and plot updates after selection changes

## Cross-layer contracts

- **Persisted comparison state**
  - is represented by `DamageComparisonState` in `client/src/types/damage-comparison.ts`
  - stores `reference.selected_event_ids`
  - stores `target.selected_event_ids`
  - stores `selected_channel_keys`
  - stores `value_mode`
  - stores `aggregation_event_scope`
  - is merged through `mergeDamageComparisonState()` from `client/src/lib/damage-comparison-state.ts`
  - derives program/version scope through `deriveProgramVersionScopeFromComparisonState()` from `client/src/lib/damage-comparison-state.ts`
  - must not overwrite existing single-pool dashboard or inspect-damage route state
- **Event tree selection**
  - accepts a section label such as `Reference Load Data`, `Target Load Data`, or existing single-pool labels
  - emits selected event IDs
  - derives counts and group check state from visible catalog rows
- **Channel selection**
  - uses canonical damage channel keys
  - ignores metadata columns for plot meaning
  - may visually reuse Columns-style UI, but persisted analysis selection remains distinct
- **Raw plot fact**
  - includes dataset membership (`reference` or `target`)
  - includes event ID, program ID, version, channel key, channel label, and damage value/status
  - preserves event IDs and program/version labels for inspection and engineering review language
- **Comparison aggregate**
  - absolute delta is `target - reference`
  - percent difference is `100 * (target - reference) / reference`
  - ratio is `target / reference`
  - normalized ratio is `(target / target total) / (reference / reference total)`
  - low-reference rows expose an explicit guard state instead of fake finite ratio-style values

## Existing decisions to preserve

- Keep the current single-pool dashboard Load Data behavior working.
- Keep inspect-damage table layout preferences independent from analysis channel selection.
- Reuse existing inspected damage results; do not recompute fatigue damage in the browser.
- Reuse the existing shared side-panel shell and hierarchical event-tree UX where practical.
- Keep global filters shared across both trees in v1.

## Forbidden shortcuts

- No overload of existing single-pool `selected_event_ids` for Reference/Target state.
- No persisted program/version selections as primary truth.
- No coupling plotted channels to generic table column visibility.
- No hidden mutual exclusion between Reference and Target events.
- No persisted computed plot series in session.
- No browser-side fatigue recalculation.
- No broad redesign of unrelated dashboard, upload, certificate, or edit-metadata side panels.

## Slice notes

- `SPV-33-01` hardens the existing state helpers and session merge baseline before UI wiring.
- `SPV-33-02` parameterizes the side-panel event-tree section so existing single-pool routes and new Reference/Target sections can share behavior. Completed artifacts:
  - `LoadDataEventTreeSection` in `client/src/components/dashboard/side-panel/LoadDataSection.tsx`
  - `ComparisonLoadDataSections` in `client/src/components/dashboard/side-panel/ComparisonLoadDataSections.tsx`
  - focused regression tests proving single-pool behavior and independent Reference/Target write paths.
- `SPV-33-03` introduces plotted-channel analysis selection without changing metadata/table layout preferences. Completed artifacts:
  - `ComparisonPlottedChannelSection` in `client/src/components/dashboard/side-panel/ComparisonPlottedChannelSection.tsx`
  - focused channel-selection component/helper tests proving canonical channel list usage, `selected_channel_keys` patching, and missing-key pruning.
- `SPV-33-04` creates the raw event x channel comparison facts from union inspect-damage data. Completed artifacts:
  - `buildDamageComparisonRawFacts` in `client/src/features/inspect-damage/lib/build-damage-comparison-raw-facts.ts`
  - focused raw-fact tests proving overlap duplication, selected-channel filtering to canonical inspect channels, and stale/invalid cell handling semantics.
- `SPV-33-05` builds pure aggregation and comparison math on top of those facts. Completed artifacts:
  - `buildDamageComparisonAggregates` in `client/src/features/inspect-damage/lib/build-damage-comparison-aggregates.ts`
  - focused aggregation tests proving program/version, event/channel, and channel cumulative grouping plus signed deltas, ratio metrics, normalized-ratio math, value-mode selected outputs, and low-reference guard semantics.
- `SPV-33-06` wires the complete comparison route UI and plot families, then hardens regressions and docs. Completed artifacts:
  - `client/src/app/inspect-damage/page.tsx` now includes a `Comparison` central tab, side-panel comparison controls, and comparison-family rendering in route content.
  - `client/src/hooks/use-inspect-damage-state.ts` now exposes comparison state + patch updates through the existing `mergeInspectDamageState` path so table preferences stay independent.
  - `client/src/features/inspect-damage/lib/build-damage-comparison-view-model.ts` now builds union inspect IDs, empty-state guidance, subtitles/legends, and aggregate-ready view data.
  - focused regressions in `client/src/features/inspect-damage/__tests__/build-damage-comparison-view-model.test.ts` and `client/src/features/inspect-damage/components/InspectDamageCentralTabSwitcher.test.tsx`.
