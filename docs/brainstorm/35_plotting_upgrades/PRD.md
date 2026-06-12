# PRD: Inspect Damage Plotting Upgrades

## Problem Statement

Analysts currently use the Inspect Damage route to visualize damage associated with selected Reference and Target events. The current route renders the comparison views as 3D bar plots. This is useful for exploratory inspection, but it does not match the 2D comparison figures already proven in the relative damage calculation notebook, and it does not match the interactive SVG plot language used by the Dashboard route.

The notebook workflow communicates damage comparisons with 2D grouped bars, channel-share comparisons, percent-difference views, normalized ratios, and heatmap-style dense event/channel summaries. Those plots are easier to read, easier to compare across cards, and easier to align with engineering review artifacts than the current 3D-only presentation.

The app needs a plotting upgrade that makes 2D plots the primary Inspect Damage visualization style while retaining the current 3D plotting capability as an explicit user-selectable visualization mode. Users should be able to choose what comparison to inspect and how to visualize it without losing existing controls for value mode, channel selection, version slicing, log scaling, and event counts.

## Solution

Add a unified Inspect Damage plotting experience with two orthogonal choices:

- Plot type: the analysis being shown, such as cumulative by channel, absolute by event, cumulative by program/version, or target delta versus reference.
- Visualization mode: the renderer used to show that analysis, either 2D plots or 3D plot.

The default visualization mode should be 2D plots. The 2D mode should reuse the Dashboard route's visual language: card-based plot containers, white SVG backgrounds, shared axis/grid typography, bottom-left title chips, concise legends, hover tooltips, and empty/loading/error states that feel consistent with existing Dashboard SVG plots.

The current 3D plotting capability should remain available as a selectable "3D plot" mode. It should continue to use the existing 3D bar renderer and color legend, driven by the same plot type, selected channels, value mode, version slice, and damage scale controls.

The left Inspect Damage plot control rail should remain visible at all times, including when no events are selected. It should expose plot type, visualization mode, value mode, selected channels, version slice, and damage scale. Changing plot type or visualization mode should update the plotted content immediately using already-loaded inspect-damage results, without triggering unnecessary damage recalculation.

## User Stories

1. As an analyst, I want 2D damage plots in Inspect Damage, so that comparison results match the notebook analysis style.
2. As an analyst, I want the Inspect Damage plots to use Dashboard-style plot cards, so that the app has one consistent visual language.
3. As an analyst, I want the current 3D plot to remain available, so that I can still explore damage magnitude spatially when useful.
4. As an analyst, I want to choose between 2D plots and 3D plot, so that I can select the visualization style that best fits the task.
5. As an analyst, I want visualization mode to be separate from plot type, so that "what I am analyzing" is not confused with "how it is drawn."
6. As an analyst, I want 2D plots to be the default view, so that the route opens in the clearest comparison-oriented layout.
7. As an analyst, I want the left plot control rail to remain visible when no events are selected, so that I can configure plot type and visualization mode before selecting data.
8. As an analyst, I want the plot control rail to extend the full height of the plot panel, so that controls feel integrated into the card instead of floating over it.
9. As an analyst, I want plot types listed directly with clear selection indicators, so that I can see available analyses without opening a dropdown.
10. As an analyst, I want plot type rows to show checkboxes or equivalent selected-state affordances, so that the active plot type is visually obvious.
11. As an analyst, I want changing the selected plot type to rerender the plot immediately, so that I can move quickly between comparison views.
12. As an analyst, I want changing visualization mode to rerender the current plot immediately, so that I can compare the same analysis in 2D and 3D.
13. As an analyst, I want cumulative damage by channel as a 2D grouped bar chart, so that Reference and Target channel totals are easy to compare.
14. As an analyst, I want absolute damage by event as a dense 2D view, so that I can identify which selected events drive damage without navigating a 3D scene.
15. As an analyst, I want absolute damage by event to support many events and channels, so that full program slices remain readable.
16. As an analyst, I want cumulative damage by program/version as a 2D program/version chart, so that program-level comparisons align with notebook outputs.
17. As an analyst, I want target delta versus reference by channel as a 2D diverging or ratio-style chart, so that increases and decreases are visually obvious.
18. As an analyst, I want normalized ratio and percent-difference style outputs available for comparison plots, so that relative changes are comparable across channels.
19. As an analyst, I want low-reference channels flagged, so that divide-by-near-zero results are not mistaken for meaningful ratios.
20. As an analyst, I want absolute and normalized value modes to apply consistently in 2D and 3D, so that the same control means the same thing in both renderers.
21. As an analyst, I want log damage scale to apply consistently in 2D and 3D, so that high-dynamic-range damage values remain readable.
22. As an analyst, I want channel selection to filter both 2D and 3D visualizations, so that plotted content always reflects my chosen channel subset.
23. As an analyst, I want version slice selection to filter supported plot types, so that program/version review workflows are explicit.
24. As an analyst, I want disabled or irrelevant controls to be visually clear, so that I know when a control does not apply to the current plot type.
25. As an analyst, I want plot subtitles or labels to include Reference and Target event counts, so that the plotted comparison carries its data context.
26. As an analyst, I want 2D cards to have clear legends, so that Reference, Target, delta, and magnitude color meanings are not ambiguous.
27. As an analyst, I want magnitude heatmaps to use a consistent damage color scale, so that dense event/channel views remain interpretable.
28. As an analyst, I want Reference and Target colors to be semantic and stable, so that comparison bars do not compete with event-specific Dashboard colors.
29. As an analyst, I want empty-state messages in the plot card area, so that missing Reference events, Target events, channels, or damage data are explained.
30. As an analyst, I want the control rail to remain usable in empty states, so that I can set up the desired visualization before completing event selection.
31. As an analyst, I want plot cards to show loading and error states consistently with Dashboard cards, so that failures are easy to diagnose.
32. As an analyst, I want hover tooltips on 2D plots, so that I can inspect exact damage, ratio, percent difference, channel, event, program, and version values.
33. As an analyst, I want the 2D plots to reuse already-loaded inspect-damage results, so that changing visualization does not recompute fatigue damage.
34. As an analyst, I want rendering limits to be handled gracefully, so that dense event/channel selections do not make the UI unusable.
35. As an analyst, I want the app to warn when 3D plots are capped, so that I understand when not every cell is shown.
36. As an analyst, I want the 2D heatmap or dense event view to handle larger selections better than 3D bars, so that notebook-scale event sets remain practical.
37. As an analyst, I want the plot card layout to respect the left rail width, so that plotted content is not hidden behind controls.
38. As an analyst, I want the 3D plot legend to remain available in 3D mode, so that bar colors stay interpretable.
39. As an analyst, I want 2D legends to live inside or near their cards, so that each card can be read independently.
40. As an analyst, I want the 3D mode to be selectable rather than removed, so that existing workflows are preserved.
41. As an analyst, I want app styling to avoid nested borders and heavy shadows in the control rail, so that the rail feels like part of the plot card.
42. As an analyst, I want plot cards to be visually aligned with the Dashboard grid, so that switching routes does not feel like switching products.
43. As an analyst, I want implementation to keep plot data transformation testable, so that chart values can be compared against notebook-derived expectations.
44. As an analyst, I want the route to remain responsive while switching plot types, so that iterative comparison remains fast.
45. As an analyst, I want future plot exports to build from the same 2D plot specifications, so that exported values match what I see.

## Implementation Decisions

- Introduce a visualization mode state with at least two values: 2D plots and 3D plot. Visualization mode is independent of plot type.

- Default visualization mode is 2D plots. 3D plot remains available as a user-selectable mode.

- Keep plot type as the domain analysis selector. Plot types remain cumulative by program/version, absolute by event, cumulative by channel, and target delta versus reference by channel.

- Keep one shared plot control rail. It owns plot type, visualization mode, value mode, selected channels, version slice, and damage scale controls. The rail is always visible, including empty states.

- Use direct plot-type rows with visible selected-state indicators instead of a plot-type dropdown. Plot type selection should be single-select.

- Add visualization mode as a segmented control in the rail. The control should make clear that it switches renderer, not data meaning.

- Reuse the current 3D renderer for 3D mode. The existing 3D cell builder, layout computation, canvas, and color legend can remain the 3D rendering path.

- Build a new 2D plotting path that transforms comparison aggregates into plot specifications. This should be a deep module with a stable interface: given comparison view model, plot type, value mode, selected channels, version slice, and damage scale, return renderable 2D plot specifications.

- Do not force damage comparison plots into the existing line-curve data model. Dashboard line plots and Inspect Damage categorical plots should share card chrome, axes, typography, and interaction patterns, but categorical damage charts need their own bar and heatmap renderers.

- Reuse Dashboard chart primitives where they fit: plot card shell, SVG background, axes/grid typography, and tooltip approach. Add new SVG renderers for grouped bars, diverging bars, and heatmaps.

- Map cumulative damage by channel to a grouped Reference versus Target bar chart.

- Map absolute damage by event to a dense 2D representation. Heatmap is the preferred direction for full event/channel selections because it scales better than grouped bars for notebook-sized datasets.

- Map cumulative damage by program/version to a grouped or stacked program/version chart, preserving program and version labels.

- Map target delta versus reference by channel to a diverging bar, ratio bar, or metric-selectable comparison card. The implementation should support absolute delta, percent difference, and normalized ratio semantics from the notebook.

- Use semantic comparison colors for Reference and Target in 2D comparison charts. Do not reuse Dashboard event colors for Reference versus Target bars.

- Use the existing discrete damage color bands for magnitude heatmaps and any plot where color means damage magnitude.

- Keep low-reference guard semantics from comparison aggregation. Channels below the low-reference threshold should be flagged or excluded from ratio-like plots rather than shown as misleading extreme values.

- Keep empty-state handling separate from renderer selection. The rail still renders; the main plot area shows empty-state guidance when Reference events, Target events, channels, or usable damage data are missing.

- Preserve the existing inspect-damage aggregation layer as the canonical source for comparison data. The plotting upgrade should consume aggregate outputs rather than recomputing damage.

- Keep damage calculation and persisted inspect-damage APIs out of scope for this change. This is a frontend visualization upgrade on top of existing inspect-damage results.

- Keep the route's table view behavior intact. The plotting upgrade only changes the Inspect Damage central plot view.

- Consider a future module rename from 3D-specific naming toward plot-renderer naming once both 2D and 3D live side by side. Do not block the first implementation on large folder churn.

## Testing Decisions

- Tests should verify external plotting behavior and data contracts, not internal component structure. Good tests assert that selected comparison state produces the expected plot specs, values, labels, warnings, and empty states.

- Add focused unit tests for the 2D plot-spec builder. These should cover cumulative by channel, absolute by event, cumulative by program/version, and target delta versus reference.

- Add tests for absolute versus normalized value mode so the same input aggregates produce expected plotted values.

- Add tests for log damage scale transformation so 2D chart values or color-domain values are transformed consistently with 3D behavior.

- Add tests for selected channel filtering so hidden/unselected channels are not included in plot specs.

- Add tests for version slicing so only matching versions contribute when a version slice is selected.

- Add tests for low-reference handling in delta, percent-difference, and normalized-ratio views.

- Add tests for empty-state selection conditions: no Reference events, no Target events, no selected channels, no response, and no usable damage values.

- Add component tests for the plot control rail to verify plot type rows are visible, selected-state indicators are shown, visualization mode can be changed, and callbacks fire with the correct values.

- Add component tests for the top-level plot view to verify 2D mode renders 2D plot cards and 3D mode renders the retained 3D plot path.

- Use existing comparison aggregate tests and chart utility tests as prior art. Avoid brittle assertions against SVG path strings unless the renderer contract explicitly owns those strings.

- For visual consistency, prefer snapshot-light tests that assert labels, roles, selected states, and high-level chart elements over pixel-perfect output.

## Out of Scope

- Recomputing fatigue damage or changing server-side damage calculation.

- Changing persisted database schema or inspect-damage API response shape.

- Removing the current 3D plot capability.

- Replacing Dashboard route line charts.

- Building full export workflows for the new 2D plots.

- Adding new backend endpoints for notebook parity.

- Reworking Reference and Target event selection behavior beyond what plotting needs.

- Implementing a complete design-system refactor outside the Inspect Damage plotting surface.

- Guaranteeing pixel parity with matplotlib notebook output. The goal is semantic parity and app design consistency, not exact matplotlib reproduction.

## Further Notes

The notebook remains the reference for comparison semantics: cumulative program damage, per-channel ratios, percent difference, normalized ratio, and low-reference guards. The Dashboard route remains the reference for app-native plot styling: card chrome, white SVG plot surface, grid/axis typography, bottom-left title chip, concise legends, and interactive hover affordances.

The preferred product direction is 2D-first with 3D retained as an explicit visualization mode. This makes Inspect Damage easier to read in the default case while preserving the existing exploratory 3D visualization for users who need it.

The first implementation slice should be cumulative damage by channel in 2D, because it is the clearest notebook-aligned comparison chart and has a low data-shape risk. Once that path establishes the shared 2D card and spec-builder contracts, the remaining plot types can be added incrementally.
