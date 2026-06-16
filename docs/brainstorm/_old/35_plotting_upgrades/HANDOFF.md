# PRD-35 Handoff

## Mission

Build the Inspect Damage plotting upgrade in small, reviewable slices. The end state is all four 2D comparison plots visible together, plus one focused 3D card that reuses the current Three.js renderer.

## Read First

- `PRD.md`
- `IMPLEMENTATION_MAP.md`
- `references/README_INDEX.md`
- `references/DAMAGE_PLOT_CURRENT_STATE.md`
- `references/ARCHITECTURE_AUDIT.md`
- Current route: `client/src/app/inspect-damage/page.tsx`
- Current 3D plot view: `client/src/features/inspect-damage-3d/components/DamagePlotView.tsx`

## Current Baton

`PU-35-01`, `PU-35-02`, `PU-35-03`, and `PU-35-04` are complete.

One-scope enforcement is now wired in the Inspect Damage sidepanel load-data sections:

- Same-scope multi-select remains allowed per side.
- Cross-scope picks replace the side with the newly selected scope.
- A toast explains when Reference/Target is moved to a new scope.
- Regression tests cover same-scope add, cross-scope replacement, and clear/reset behavior.

Plot Inputs are now sidepanel-owned:

- New `Plot Inputs` section renders below `Target Load Data` with a divider.
- Channel selection updates `DamageComparisonState.selected_channel_keys` and enforces at least one selected channel.
- Value mode segmented control updates `DamageComparisonState.value_mode`.
- 3D overlay rail no longer owns channel/value-mode controls.

Planning docs remain aligned to the resolved design:

- No overlay rail.
- Channels and value mode move to the sidepanel.
- Damage scale is a subtle in-plot toggle.
- No version selector.
- Exactly one Reference program/version scope and one Target program/version scope.
- All four 2D cards render together.
- One focused 3D card is retained.

`PU-35-03` extracted a reusable `PlotCardShell` under `client/src/components/charts/` with title/subtitle chip support, loading/error/empty states, and action/footer slots. `SVGPlotCard` now composes this shell while preserving empty-plot SVG rendering and sync/action affordances.

`PU-35-04` added shared damage scaling via `applyDamageScale(value, mode)` (`linear` and `log10(1 + x)`), moved the Normal/Log toggle into the main focused 3D plot area, and removed damage-scale controls from the overlay rail.

`PU-35-05` is now complete: `buildDamage2DPlotSpec` provides a tested cumulative-by-channel grouped-bar spec path with selected-channel filtering, absolute/normalized value selection, shared linear/log damage scaling, semantic Reference/Target legend colors, and explicit renderable empty states.

`PU-35-06` is now complete: `CumulativeByChannelPlotCard` renders grouped Reference/Target bars inside `PlotCardShell` with Dashboard-style SVG chart scaffolding (grid/ticks/categories), semantic legend labels, native hover tooltip content (channel/dataset/value/value-mode/scale context), and accessible per-bar labels. Component tests cover grouped bars/categories, legend labels, tooltip text, and card-shell empty/loading/error states.

`PU-35-07` is now complete: `DamagePlotView` renders a 2×2 2D card grid plus one focused 3D card. Cumulative-by-channel uses the real 2D renderer; other plot types show placeholder shell cards. Clicking a 2D card updates focused 3D plot type. The overlay rail is no longer mounted; Normal/Log toggle, color legend, and render-cap warning remain on the focused 3D surface.

`PU-35-11` is now complete: the `target_delta_vs_reference` card now has a subtle card-local metric toggle (`Absolute`, `Percent`, `Ratio`). Percent and ratio modes apply formula-driven values from reference/target channel totals and suppress low-reference rows as unavailable instead of rendering misleading divide-by-near-zero values. Tooltip copy, aria labels, and axis/tick formatting adapt per selected metric mode.

`PU-35-12` now includes a route-ownership shift for tables: `/database` provides `Datasets | Damage Table` tabs, Damage Table reads all persisted calculated-damage scopes by default (without side-panel selection), and `/inspect-damage` is plot-only.

Continue implementation with `PU-35-12`.

## Issue Order

1. `issues/PU-35-00.md` - documentation baseline.
2. `issues/PU-35-01.md` - one-scope selection enforcement.
3. `issues/PU-35-02.md` - sidepanel Plot Inputs. **DONE**
4. `issues/PU-35-03.md` - shared plot card shell. **DONE**
5. `issues/PU-35-04.md` - shared damage scale. **DONE**
6. `issues/PU-35-05.md` - cumulative-by-channel spec. **DONE**
7. `issues/PU-35-06.md` - cumulative-by-channel renderer. **DONE**
8. `issues/PU-35-07.md` - 2D card grid plus focused 3D. **DONE**
9. `issues/PU-35-08.md` - absolute-by-event heatmap. **DONE**
10. `issues/PU-35-09.md` - program/version card. **DONE**
11. `issues/PU-35-10.md` - signed delta card. **DONE (2026-06-15)**
12. `issues/PU-35-11.md` - delta metric toggle. **DONE (2026-06-15)**
13. `issues/PU-35-12.md` - polish and accessibility. **NEXT**

## Operator Notes

- Keep backend APIs out of scope unless an issue explicitly changes scope.
- Keep table column visibility separate from selected plot channels.
- Do not add per-card controls except the later delta metric toggle.
- Avoid a large folder rename at the beginning; it is acceptable for new 2D modules to live alongside the current `inspect-damage-3d` modules until the surface stabilizes.
- For a small team of 5-10 users, the low-complexity performance rule is: do not recompute damage, do not add server plot rendering, and do not mount multiple Three.js canvases.

## Recovery Notes

If an implementation slice gets stuck:

- Fall back to the pure data/spec contract first; renderers can be stubbed while values are tested.
- Keep the existing 3D path working until the focused 3D card is fully wired.
- If one-scope enforcement is hard inside the shared event tree, implement explicit validation and warning first, then tighten interaction behavior in a follow-up.
- If `PlotCardShell` extraction causes churn in Dashboard line plots, create a damage-local card shell matching `SVGPlotCard` styling and defer shared extraction.

## Publishing

Local issue docs are the source of truth for now. Publish GitHub Issues only after human review of the issue breakdown.
