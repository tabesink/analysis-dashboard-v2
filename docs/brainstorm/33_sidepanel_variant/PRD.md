# PRD: Reference vs Target Damage Comparison Side Panel

## Problem Statement

Analysts need compare two load-data datasets: **Reference** baseline vs **Target** candidate. Today app has one Load Data event tree backed by one selected event pool. That works for rendering one analysis set, but fails when user needs two independent sets for relative damage comparison.

Notebook workflow already proves need: user chooses event sets or program/version folders, computes cumulative damage, compares target against reference, then views absolute, normalized, ratio, percent-difference, and delta-style plots. Dashboard needs same workflow in UI.

Current app also treats channel visibility as table layout. Columns button can hide/show damage channels visually, but plot pipeline still needs explicit selected channel set. Plot data should use only user-selected channels, not all available channels, and not metadata columns.

Core problem: app lacks canonical comparison state:

- Reference selected events
- Target selected events
- Selected damage channels
- Absolute vs normalized display mode
- Clear aggregation rules for event, channel, program, version, and delta plots

## Solution

Add comparison-focused side panel and analysis state for Reference vs Target damage visualization.

Recent frontend groundwork already added the comparison state type and merge helpers expected by the inspect-damage session layer. Future implementation should build on:

- `client/src/types/damage-comparison.ts`
- `client/src/lib/damage-comparison-state.ts`
- `mergeInspectDamageState` in `client/src/lib/inspect-damage-table-preferences.ts`

Those files establish the state shape, default values, partial merge behavior, and event/channel pruning helpers. Remaining work should harden that baseline with tests and wire it into the side-panel, channel picker, raw plot facts, aggregations, and route UI.

Panel keeps existing shared side-panel shell and event-tree UX:

1. Filter Data
2. Reference Load Data
3. Divider
4. Target Load Data
5. Channel selection for plotted damage channels
6. Value mode controls: absolute / normalized

Reference and Target sections each render same hierarchical event tree: program -> version -> event. Each tree has independent checked state, All/None actions, count subtitle, status handling, color swatches if retained, and accessible labels naming Reference or Target.

Persist comparison state in session, separate from existing single-pool dashboard selection. Event IDs are source of truth. Program/version selection is derived from selected events and event catalog, not stored as primary truth.

Plots consume a normalized raw plot dataset at event x channel grain. Every plot filters by:

- Reference or Target dataset membership
- selected event IDs
- selected channel keys
- damage cell status/value validity
- absolute or normalized mode

Supported v1 plots:

1. Cumulative damage by program/version
2. Absolute damage by event
3. Cumulative damage by channel
4. Target delta vs Reference by channel
5. Normalized variants for all plots

## User Stories

1. As an analyst, I want choose Reference load data separately from Target load data, so that I can compare baseline and candidate datasets.
2. As an analyst, I want Reference Load Data and Target Load Data shown as separate side-panel sections, so that I do not confuse event pools.
3. As an analyst, I want each event tree grouped by program, version, and event, so that I can select at natural domain levels.
4. As an analyst, I want selecting Reference events not to affect Target events, so that each dataset stays independent.
5. As an analyst, I want All and None controls in each dataset section, so that I can quickly build or clear each pool.
6. As an analyst, I want per-section selected counts, so that I can confirm Reference and Target sizes.
7. As an analyst, I want same global filters applied to both trees, so that comparison candidates come from same visible catalog.
8. As an analyst, I want empty-state guidance when Reference has no events, so that I know why plots cannot render.
9. As an analyst, I want empty-state guidance when Target has no events, so that I know what selection is missing.
10. As an analyst, I want app to allow same event in Reference and Target unless product rules change, so that I can run control comparisons.
11. As an analyst, I want selected Reference and Target events restored on refresh, so that long comparison work survives navigation.
12. As an analyst, I want selected channels persisted, so that plots keep using my chosen channel subset.
13. As an analyst, I want channel selection separate from metadata column visibility, so that table layout does not accidentally change plot meaning.
14. As an analyst, I want Columns UI or equivalent channel picker to control plotted channels, so that I can add/drop channels visually.
15. As an analyst, I want plotted channel picker to show canonical damage channel labels, so that I can select BJ, shock, and bushing channels clearly.
16. As an analyst, I want cumulative damage by program/version, so that I can compare total damage across selected program/version scopes.
17. As an analyst, I want cumulative program/version damage to respect selected events, so that partial selections produce intentional partial totals.
18. As an analyst, I want optional all-in-program/version aggregation later, so that selecting a program/version can mean full folder comparison when needed.
19. As an analyst, I want absolute damage by event, so that I can see which events drive total damage.
20. As an analyst, I want absolute event plot to stack or group selected channels, so that event contribution is channel-aware.
21. As an analyst, I want cumulative damage by channel, so that I can identify dominant damage channels.
22. As an analyst, I want target delta vs reference by channel, so that I can see how much target damage changed from baseline.
23. As an analyst, I want delta bars to show signed change, so that increases and decreases are visually obvious.
24. As an analyst, I want percent-difference style comparison, so that changes are comparable across channels with different absolute magnitudes.
25. As an analyst, I want normalized values for every plot, so that I can compare damage mix independent of absolute scale.
26. As an analyst, I want normalized target-vs-reference comparison, so that I can see channel share shifts.
27. As an analyst, I want low-reference channels handled safely, so that divide-by-near-zero does not create misleading bars.
28. As an analyst, I want plot legends to state whether values are absolute or normalized, so that interpretation is clear.
29. As an analyst, I want plot subtitles to show selected event and channel counts, so that context travels with visualization.
30. As an analyst, I want missing or stale damage values surfaced, so that I do not trust incomplete comparisons.
31. As an analyst, I want app to reuse existing damage inspect results, so that comparison view does not recompute fatigue damage unnecessarily.
32. As an analyst, I want comparison state not to break existing dashboard Load Data, so that old single-pool flows still work.
33. As an analyst, I want inspect-damage table and plot controls aligned where useful, so that adding/dropping channels feels like one action.
34. As an analyst, I want table layout preferences still independent, so that hiding Work Order or Job Number does not remove data from plots.
35. As an analyst, I want comparison plots to update after selection changes, so that side-panel choices immediately drive rendered raw plot data.
36. As an analyst, I want route-specific persistence, so that comparison work does not overwrite dashboard grid state.
37. As an analyst, I want accessible section labels for Reference and Target, so that screen readers do not announce two identical Load Data regions.
38. As an analyst, I want program/version labels preserved in plots, so that output matches engineering review language.
39. As an analyst, I want event IDs preserved in plot data, so that bars can link back to source events.
40. As an analyst, I want exported or inspectable plot data later, so that UI results can be compared against notebook outputs.

## Implementation Decisions

- Build comparison state as route-scoped session data, not as overload of existing single-pool dashboard data state.

- The frontend now has a concrete `DamageComparisonState` type in `client/src/types/damage-comparison.ts` and default/merge/prune helpers in `client/src/lib/damage-comparison-state.ts`. Agents should extend and test these modules instead of introducing a second comparison state model.

- Event IDs are canonical selection truth. Program IDs and versions are derived from selected events plus event catalog. This avoids drift when events disappear, filters change, or metadata updates.

- Reference and Target share same selection shape:

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

- Default aggregation scope is `selected_only`. `all_in_program_version` remains explicit mode, not implicit behavior.

- Selected channels are analysis state. Table visible columns remain layout state. UI may sync channel-column toggles into selected channels, but model must keep metadata visibility separate from channel analysis selection.

- Canonical channel keys come from damage inspect metadata / canonical damage channel list. Channel picker stores channel keys only.

- Plot pipeline uses event x channel facts. Raw row shape should be dataset, event ID, program ID, version, channel key, channel label, and damage value.

- Cumulative damage by program/version groups by dataset, program ID, version, and selected channels. Normalized mode shows share of dataset total or share within displayed group, with label explicit.

- Absolute damage by event groups by dataset, event ID, and channel. It should support stacked bars by channel and optional total labels.

- Cumulative damage by channel groups by dataset and channel. It powers both single-dataset overview and comparison metrics.

- Target delta vs Reference merges channel cumulative damage from both datasets. It computes absolute delta, ratio, percent difference, and normalized ratio.

- Delta semantics:
  - Absolute delta: target damage minus reference damage
  - Percent difference: 100 x (target - reference) / reference
  - Ratio: target / reference
  - Normalized ratio: (target / target total) / (reference / reference total)

- Low-reference guard required. If reference damage is missing, zero, or below minimum threshold, comparison row must mark low reference and avoid misleading finite percent/ratio.

- Existing shared side-panel shell and hierarchical event tree remain canonical UI primitives. Load-data section should become parameterized so Reference, Target, dashboard Load Data, and inspect-damage Load Data can share behavior.

- Existing global filters apply to both Reference and Target in v1. Independent filter scopes are out of scope unless product requires later.

- Same event may appear in both Reference and Target in v1. Mutual exclusion is out of scope until product decides otherwise.

- v1 can inspect damage for union of Reference and Target event IDs, then split rows client-side by dataset membership. A future API can accept reference IDs, target IDs, and channel keys, then return pre-aggregated plot series.

- Session stores selection spec, not computed plot data. Plot data recomputes from current damage inspect response and comparison state.

- `mergeInspectDamageState` already preserves/merges `comparison` alongside existing `table_preferences`. Future state wiring must preserve this separation so comparison analysis state does not become table layout state.

- Existing dashboard and inspect-damage behavior must not regress. Single-pool `selected_event_ids` remains valid for current routes.

## Testing Decisions

- Test behavior through public inputs and outputs: selection state in, plot rows/aggregates out. Avoid asserting component internals or hook implementation details.

- Unit-test comparison state helpers:
  - default state
  - merge/persist partial updates
  - prune missing event IDs and missing channel keys
  - derive program/version scopes from event IDs
  - regression coverage for `mergeInspectDamageState` preserving both `table_preferences` and `comparison`

- Unit-test raw plot dataset builder:
  - splits union inspect response into Reference and Target
  - keeps overlap event in both datasets when selected in both
  - filters to selected channel keys
  - drops or marks null/stale damage cells according to view rules

- Unit-test aggregation module:
  - cumulative by program/version
  - absolute by event
  - cumulative by channel
  - target-vs-reference delta metrics
  - normalized values
  - low-reference guard

- Component-test side panel:
  - renders Reference Load Data and Target Load Data
  - independent All/None behavior
  - independent selection counts
  - selected channel picker changes plot channel state
  - existing Load Data routes not changed by comparison state

- Regression-test existing session merge behavior so adding comparison state does not drop existing table preferences, global filters, rendered event IDs, or single-pool data state.

- Prior art exists in current table preference tests, dashboard workspace tests, inspect-damage view-state tests, and damage plot utility tests. Follow same style: small deterministic fixtures, no network, no visual snapshots unless needed.

## Out of Scope

- Replacing main dashboard Load Data with Reference/Target.
- Reworking database upload, certificate, or edit-metadata side panels.
- Recomputing py-fatigue damage in browser.
- Full backend aggregation endpoint in v1 if client-side union inspect is enough.
- Independent Reference and Target global filters.
- Mutual exclusion between Reference and Target selections.
- Persisting computed plot series in session.
- Export workflow for comparison plot data.
- Notebook parity for every diagnostic plot beyond requested four families.
- 3D damage plot redesign unless separate issue chooses to consume comparison state.

## Further Notes

- Existing old PRD correctly identified shared primitives: hierarchical event tree and side-panel shell are canonical; whole dashboard side panel and current Load Data section are route-specific.

- New data model is required because Reference/Target plus selected channels are analysis state, not table layout and not dashboard single-pool selection.

- Important invariant: plots render from selected event IDs plus selected channel keys. Program/version labels are grouping metadata, not primary persisted selection truth.

- Notebook formulas should anchor validation:
  - `pct_of_total = 100 x D_channel / sum(D_all_channels)`
  - `pct_diff = 100 x (D_target - D_reference) / D_reference`
  - `normalized_ratio = (D_target / sum(D_target)) / (D_reference / sum(D_reference))`

- Best deep module opportunity: one pure comparison aggregation module with small API. UI, session, and API wiring can change around it while math stays testable.

