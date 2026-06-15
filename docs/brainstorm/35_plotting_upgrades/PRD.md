# PRD: Inspect Damage Plotting Upgrades

## Problem Statement

Analysts currently use the Inspect Damage route to compare fatigue damage for Reference and Target event selections. The current plot surface is a single 3D bar visualization with an overlay control rail. That view is useful for exploratory magnitude inspection, but it does not match the 2D comparison figures already proven in the relative damage calculation notebook and it does not match the Dashboard route's SVG card language.

The notebook workflow communicates damage comparisons with grouped bars, dense event/channel summaries, program/version comparisons, signed target deltas, percent-difference views, normalized ratios, and low-reference guards. Those views are easier to read side by side than a single 3D scene.

The app needs a lightweight plotting upgrade that makes the 2D comparison views visible together in the main Inspect Damage plot area while retaining the current 3D renderer as a focused exploratory card. The implementation should serve a small team of 5-10 users who may generate plots concurrently, so it should avoid new backend plot APIs, avoid unnecessary damage recalculation, and avoid mounting multiple heavy 3D canvases.

## Solution

Replace the current single 3D plot-with-rail surface with a Dashboard-style plot card layout:

- Four 2D cards are visible in the main plot area: cumulative damage by channel, absolute damage by event, cumulative damage by program/version, and target delta versus reference by channel.
- One focused 3D card remains below or beside the 2D grid. It uses the current Three.js renderer for the focused plot type.
- Clicking a 2D card focuses the 3D card on that same plot type.
- 2D cards retain interactive hover tooltips for exact values, labels, warnings, and comparison metadata.
- The current overlay plot control rail is removed.
- Channel selection moves into the Inspect Damage sidepanel below Target Load Data, separated by a divider.
- Value mode stays in the sidepanel Plot Inputs section with channel selection.
- Damage scale moves into the main plot area as a subtle shared Normal/Log toggle.
- Version slicing is removed from this PRD. The workflow compares exactly one Reference program/version scope against exactly one Target program/version scope, with multiple selected events allowed inside each scope.

The plotting upgrade remains a frontend visualization layer on top of the already-loaded inspect-damage response and existing comparison aggregates. It must not recompute fatigue damage or add a new backend plot endpoint.

## Target Layout

Sidepanel:

```text
+-----------------------------+
| Filter Data                 |
|-----------------------------|
| Reference Load Data         |
|   one program/version scope |
|   selectable events         |
|-----------------------------|
| Target Load Data            |
|   one program/version scope |
|   selectable events         |
|-----------------------------|
| Plot Inputs                 |
|   Channels                  |
|   [BJ] [Shock] [Bush F] ... |
|   Value [Absolute][Norm.]   |
+-----------------------------+
```

Main Inspect plot area:

```text
+--------------------------------------------------------------------------+
| Damage comparison                                             [Normal Log]|
|                                                                          |
| +----------------------+ +----------------------+                         |
| | 2D Cumulative Ch.    | | 2D Absolute Event    |                         |
| | grouped Ref/Target   | | heatmap              |                         |
| | hover exact values   | | hover exact values   |                         |
| +----------------------+ +----------------------+                         |
| +----------------------+ +----------------------+                         |
| | 2D Program/Version   | | 2D Delta vs Ref      |                         |
| | Ref scope vs Target  | | signed delta first   |                         |
| +----------------------+ +----------------------+                         |
| +--------------------------------------------------------------------+   |
| | Focused 3D card: current Three.js renderer for selected plot type   |   |
| +--------------------------------------------------------------------+   |
+--------------------------------------------------------------------------+
```

## User Stories

1. As an analyst, I want all primary 2D damage comparison plots visible together, so that I can compare results without repeatedly changing plot type.
2. As an analyst, I want the Inspect Damage plots to use Dashboard-style cards, so that plotting feels consistent across the app.
3. As an analyst, I want the current 3D plot to remain available as a focused card, so that I can still inspect damage magnitude spatially when useful.
4. As an analyst, I want clicking a 2D card to focus the 3D card on the same analysis, so that 2D comparison and 3D exploration are connected.
5. As an analyst, I want 2D cards to keep hover tooltips, so that I can inspect exact damage, ratio, percent difference, channel, event, program, and version values.
6. As an analyst, I want channel selection in the sidepanel below Reference and Target selection, so that plot inputs live near the data selections they affect.
7. As an analyst, I want absolute/normalized value mode in the sidepanel Plot Inputs section, so that value semantics are visible before reading plots.
8. As an analyst, I want damage scale inside the plot area as a subtle Normal/Log toggle, so that scale changes feel local to the plotted output.
9. As an analyst, I want the old overlay control rail removed, so that cards use the full plot area and avoid overlapping controls.
10. As an analyst, I want to select exactly one Reference program/version scope and one Target program/version scope, so that comparison labels and aggregation semantics stay clear.
11. As an analyst, I want to select multiple events inside each chosen scope, so that partial event comparisons remain possible.
12. As an analyst, I want cumulative damage by channel as a grouped Reference versus Target bar chart, so that channel totals are easy to compare.
13. As an analyst, I want absolute damage by event as a dense 2D heatmap, so that I can identify which selected events and channels drive damage.
14. As an analyst, I want cumulative damage by program/version as a 2D card, so that the selected Reference scope and selected Target scope are visible in engineering review language.
15. As an analyst, I want target delta versus reference by channel as a signed 2D chart, so that increases and decreases are visually obvious.
16. As an analyst, I want percent-difference and ratio-style delta metrics available after the signed delta card exists, so that relative comparisons can match the notebook workflow.
17. As an analyst, I want low-reference channels flagged, so that divide-by-near-zero results are not mistaken for meaningful ratios.
18. As an analyst, I want absolute and normalized value modes to apply consistently in 2D and 3D, so that the same control means the same thing in both renderers.
19. As an analyst, I want log damage scale to apply consistently in 2D and 3D, so that high-dynamic-range damage values remain readable.
20. As an analyst, I want channel selection to filter both 2D and 3D visualizations, so that plotted content always reflects my chosen channel subset.
21. As an analyst, I want plot subtitles or labels to include Reference and Target event counts and scope labels, so that each card carries its data context.
22. As an analyst, I want 2D cards to have clear legends, so that Reference, Target, delta, and magnitude color meanings are not ambiguous.
23. As an analyst, I want magnitude heatmaps to use a consistent damage color scale, so that dense event/channel views remain interpretable.
24. As an analyst, I want Reference and Target colors to be semantic and stable, so that comparison bars do not compete with event-specific Dashboard colors.
25. As an analyst, I want empty-state messages in the plot card area, so that missing Reference events, Target events, channels, or damage data are explained.
26. As an analyst, I want the sidepanel Plot Inputs section to remain usable in empty states, so that I can set up the desired comparison before selecting all data.
27. As an analyst, I want plot cards to show loading, warning, and error states consistently with Dashboard cards, so that failures are easy to diagnose.
28. As an analyst, I want the 2D plots to reuse already-loaded inspect-damage results, so that changing plot focus or scale does not recompute fatigue damage.
29. As an analyst, I want rendering limits to be handled gracefully, so that dense event/channel selections do not make the UI unusable.
30. As an analyst, I want the app to warn when the focused 3D plot is capped, so that I understand when not every cell is shown.
31. As an analyst, I want implementation to keep plot data transformation testable, so that chart values can be compared against notebook-derived expectations.
32. As an analyst, I want future plot exports to build from the same 2D plot specifications, so that exported values match what I see.

## Implementation Decisions

- Remove `DamagePlotOverlayControls` from the final PRD-35 UI. Do not replace it with another left overlay rail.
- Keep Reference and Target event selection in the Inspect Damage sidepanel. Add a compact Plot Inputs section below Target Load Data for selected channels and value mode.
- Enforce one Reference program/version scope and one Target program/version scope. Event IDs remain the persisted source of truth, but the UI should prevent or clearly reject mixed-scope selections within each side.
- Remove version slice state and controls from PRD-35 plot rendering. Plot specs derive program/version labels from the selected Reference and Target scopes.
- Keep one shared damage scale mode, rendered as a subtle Normal/Log toggle inside the main plot area. Use the same transform for 2D specs and the retained 3D path.
- Render all four 2D plot types together in a card grid. Plot type is no longer a global selector that hides the other 2D views.
- Keep a focused 3D card using the existing 3D cell builder, layout computation, canvas, color legend, and render cap. Only one 3D canvas should be mounted in the default layout.
- Clicking a 2D card updates the focused plot type used by the 3D card. This focus state may be local UI state unless later persistence is explicitly required.
- Build a new 2D plotting path that transforms comparison aggregates into plot specifications. This should be a deep module with a stable interface: given comparison view model, plot type, value mode, selected channels, damage scale, and selected scopes, return renderable 2D plot specifications.
- Do not force damage comparison plots into the existing line-curve data model. Dashboard line plots and Inspect Damage categorical plots should share card chrome, axes, typography, and interaction patterns, but categorical damage charts need their own bar and heatmap renderers.
- Reuse Dashboard chart primitives where they fit: plot card shell, SVG background, axes/grid typography, bottom-left title chip, concise legends, and tooltip approach. Add new SVG renderers for grouped bars, diverging bars, and heatmaps.
- Map cumulative damage by channel to a grouped Reference versus Target bar chart.
- Map absolute damage by event to a heatmap because it scales better than grouped bars for larger event/channel selections.
- Map cumulative damage by program/version to a compact Reference-scope versus Target-scope comparison card. Because the workflow allows one scope per side, this card does not need a version filter.
- Map target delta versus reference by channel to a signed absolute delta chart first. Add a later card-local metric toggle for absolute delta, percent difference, and ratio. Keep normalized ratio support in the spec contract when it is needed for notebook parity.
- Use semantic comparison colors for Reference and Target in 2D comparison charts. Do not reuse Dashboard event colors for Reference versus Target bars.
- Use the existing discrete damage color bands for magnitude heatmaps and any plot where color means damage magnitude.
- Keep low-reference guard semantics from comparison aggregation. Channels below the low-reference threshold should be flagged or excluded from ratio-like plots rather than shown as misleading extreme values.
- Keep empty-state handling separate from renderer selection. The sidepanel inputs still render; the main plot area shows card-level empty-state guidance when Reference events, Target events, channels, or usable damage data are missing.
- Preserve the existing inspect-damage aggregation layer as the canonical source for comparison data. The plotting upgrade should consume aggregate outputs rather than recomputing damage.
- Keep damage calculation and persisted inspect-damage APIs out of scope for this change. This is a frontend visualization upgrade on top of existing inspect-damage results.
- Keep the route's table view behavior intact. Table column visibility remains separate from plot channel selection.
- Avoid a large folder rename from `inspect-damage-3d` during the first implementation slices. A future cleanup may rename toward `inspect-damage-plots` after 2D and 3D coexist.

## Testing Decisions

- Tests should verify external plotting behavior and data contracts, not internal component structure. Good tests assert that selected comparison state produces the expected plot specs, values, labels, warnings, and empty states.
- Add focused unit tests for the 2D plot-spec builder. These should cover cumulative by channel, absolute by event, cumulative by program/version, and target delta versus reference.
- Add tests for one-scope-per-side selection enforcement so mixed Reference or mixed Target program/version selections cannot silently produce ambiguous plot labels.
- Add tests for absolute versus normalized value mode so the same input aggregates produce expected plotted values.
- Add tests for log damage scale transformation so 2D chart values or color-domain values are transformed consistently with 3D behavior.
- Add tests for selected channel filtering so hidden/unselected channels are not included in plot specs.
- Add tests for low-reference handling in delta, percent-difference, ratio, and normalized-ratio views.
- Add tests for empty-state selection conditions: no Reference events, no Target events, no selected channels, no response, and no usable damage values.
- Add component tests for sidepanel Plot Inputs to verify channel toggles and value mode callbacks.
- Add component tests for the top-level plot view to verify all four 2D cards render and the focused 3D card updates when a 2D card is clicked.
- Use existing comparison aggregate tests and chart utility tests as prior art. Avoid brittle assertions against SVG path strings unless the renderer contract explicitly owns those strings.
- For visual consistency, prefer snapshot-light tests that assert labels, roles, selected states, and high-level chart elements over pixel-perfect output.

## Out of Scope

- Recomputing fatigue damage or changing server-side damage calculation.
- Changing persisted database schema or inspect-damage API response shape.
- Removing the current 3D plot capability.
- Rendering one 3D card per plot type.
- Replacing Dashboard route line charts.
- Building full export workflows for the new 2D plots.
- Adding new backend endpoints for notebook parity.
- Supporting mixed program/version selections within Reference or Target.
- Restoring version slice controls in the plot UI.
- Reworking Reference and Target event selection beyond one-scope enforcement and Plot Inputs placement.
- Implementing a complete design-system refactor outside the Inspect Damage plotting surface.
- Guaranteeing pixel parity with matplotlib notebook output. The goal is semantic parity and app design consistency, not exact matplotlib reproduction.

## Further Notes

The notebook remains the reference for comparison semantics: cumulative program damage, per-channel ratios, percent difference, normalized ratio, and low-reference guards. The Dashboard route remains the reference for app-native plot styling: card chrome, white SVG plot surface, grid/axis typography, bottom-left title chip, concise legends, and interactive hover affordances.

The preferred product direction is 2D-first with all primary 2D views visible at once, plus one retained focused 3D card. This makes Inspect Damage easier to scan in the default case while preserving the existing exploratory 3D visualization for users who need it.

The first implementation slice should be cumulative damage by channel in 2D, because it is the clearest notebook-aligned comparison chart and has low data-shape risk. Once that path establishes the shared 2D card and spec-builder contracts, the remaining plot types can be added incrementally.

## Architecture Audit (2025-06)

A senior-engineer reverse-engineering pass documented the **Dashboard grid plot pipeline** (backend + frontend) and mapped reusable patterns for Inspect Damage 2D/3D plot cards. See [references/README_INDEX.md](./references/README_INDEX.md).

**Key findings for implementers:**

- The **active** Dashboard grid path is client-side SVG fed by `POST /plots/data/binary` — not the legacy `/render-grid` matplotlib endpoint.
- Inspect Damage already has a strong **view-model -> aggregates -> cells** stack; PRD-35 adds a **2D spec builder** and Dashboard **card chrome**, without reworking aggregation or damage APIs.
- Highest-impact dashboard quality fix (independent of PRD): **batch binary fetch** (one request for all plot keys instead of 8 sequential).
- Reuse `SVGPlotCard` patterns via proposed `PlotCardShell`; do **not** force damage categorical charts into the line-curve `Curve[]` model.
- Implementation slices are now tracked in [IMPLEMENTATION_MAP.md](./IMPLEMENTATION_MAP.md) and [issues/](./issues/).
