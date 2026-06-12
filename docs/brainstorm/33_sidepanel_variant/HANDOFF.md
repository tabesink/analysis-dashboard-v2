# HANDOFF — Side Panel Variant (SPV-33)

Use this handoff when implementing any issue in `issues/SPV-33-*.md`.

## Mission

Add a Reference vs Target damage-comparison side panel and plot workflow without regressing the existing single-pool dashboard and inspect-damage flows.

After this work, analysts can independently select Reference events, Target events, plotted damage channels, and absolute/normalized display mode. Comparison plots should render from selected event IDs plus selected channel keys, while table layout preferences remain independent.

## Context packet

- `PRD.md`
- `IMPLEMENTATION_MAP.md`
- `issues/SPV-33-*.md`
- `client/src/types/damage-comparison.ts`
- `client/src/lib/damage-comparison-state.ts`
- `client/src/lib/inspect-damage-table-preferences.ts`

## Current frontend baseline

The inspect-damage session layer already expects comparison state. Recent implementation added:

- `DamageComparisonState` and related state/value-mode/scope types in `client/src/types/damage-comparison.ts`.
- `getDefaultDamageComparisonState()`, `mergeDamageComparisonState()`, `pruneMissingEventIds()`, and `pruneMissingChannelKeys()` in `client/src/lib/damage-comparison-state.ts`.
- `deriveProgramVersionScopeFromComparisonState()` in `client/src/lib/damage-comparison-state.ts` for program/version derivation from selected comparison event IDs.
- `mergeInspectDamageState()` integration so `comparison` is defaulted/merged alongside `table_preferences`.
- `LoadDataEventTreeSection` in `client/src/components/dashboard/side-panel/LoadDataSection.tsx` for shared, parameterized load-data event-tree behavior.
- `ComparisonLoadDataSections` in `client/src/components/dashboard/side-panel/ComparisonLoadDataSections.tsx` for independent Reference/Target event selection wiring from the same filtered catalog.
- `ComparisonPlottedChannelSection` in `client/src/components/dashboard/side-panel/ComparisonPlottedChannelSection.tsx` for canonical plotted-channel analysis selection (`comparison.selected_channel_keys`) that stays separate from table layout columns.
- `buildDamageComparisonRawFacts` in `client/src/features/inspect-damage/lib/build-damage-comparison-raw-facts.ts` for deterministic event x channel facts split into `reference`/`target` memberships, including overlap duplication and explicit excluded-cell reason metadata.
- `buildDamageComparisonAggregates` in `client/src/features/inspect-damage/lib/build-damage-comparison-aggregates.ts` for pure v1 comparison families (program/version, event-channel, channel, channel-delta) with value-mode-selected outputs, explicit normalized-denominator metadata, and low-reference ratio guards.

Do not recreate this state model. Start by adding tests and adapters around the existing helpers, then wire UI and plot modules into that contract.

## Issue order

1. `SPV-33-01` — Harden existing comparison state helpers and session persistence contract.
2. `SPV-33-02` — Parameterize side-panel Load Data event tree for Reference and Target.
3. `SPV-33-03` — Add plotted-channel selection as analysis state.
4. `SPV-33-04` — Build raw Reference/Target event x channel comparison facts.
5. `SPV-33-05` — Aggregate comparison plot data and delta metrics.
6. `SPV-33-06` — Wire comparison route UI, v1 plots, regressions, and docs closeout.

## Operator notes

- Keep slices vertical and behavior-testable; avoid broad side-panel redesign.
- Preserve existing single-pool Load Data routes while adding Reference/Target behavior.
- Keep event IDs and channel keys as persisted truth.
- Treat `client/src/lib/damage-comparison-state.ts` as the canonical state-helper module unless a slice explicitly extends it.
- Validate math with deterministic fixtures that mirror notebook formulas from the PRD.
- Do not add backend aggregation unless client-side union inspect data proves insufficient.
- Update this handoff and `IMPLEMENTATION_MAP.md` when a completed slice changes shared assumptions.

## Completion notes

- `SPV-33-06` is now wired through `client/src/app/inspect-damage/page.tsx` with a dedicated `Comparison` central tab.
- The comparison tab side panel now renders Filter Data + Reference Load Data + Target Load Data + Plotted Channels + Value Mode controls, all persisted through `mergeInspectDamageState()` patch updates without replacing table preferences.
- Inspect requests in comparison mode now use the union of selected Reference/Target event IDs (`getComparisonInspectEventIds`) and then flow through `buildDamageComparisonRawFacts` and `buildDamageComparisonAggregates`.
- Route UI now renders all v1 comparison families (program/version, event-channel, channel cumulative, and channel deltas) with explicit absolute/normalized mode legend text, selected-count subtitle context, and low-reference/missing-data guidance.
