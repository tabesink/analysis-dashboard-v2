# Module Map — Plot Generation Ownership

Quick navigation for agents implementing PRD-35 or fixing Dashboard grid debt.

---

## Dashboard — Frontend

### Orchestration

| File | Exports | Responsibility |
|------|---------|----------------|
| `app/dashboard/page.tsx` | `DashboardPage` | Layout; grid column state (broken prop wire) |
| `components/dashboard/DashboardContent.tsx` | `DashboardContent` | Render/Stop/Clear toolbar |
| `components/dashboard/shared/GridActionToolbar.tsx` | `DashboardWorkspaceActions` | Action buttons |
| `components/dashboard/plot-grid/PlotGrid.tsx` | `PlotGrid` | Grid orchestrator, axis groups, fetch trigger |
| `components/dashboard/interactive-viewer/InteractiveViewer.tsx` | `InteractiveViewer` | Single-plot canvas view |
| `config/dashboard-config.ts` | `getDashboardTabs` | Tab registration |

### Data pipeline

| File | Exports | Responsibility |
|------|---------|----------------|
| `hooks/use-sequential-plot-data.ts` | `useSequentialPlotData` | Sequential fetch, abort, store updates |
| `hooks/use-lazy-plot-fetch.ts` | `useLazyPlotFetch` | Single-plot fallback fetch |
| `lib/plot-pipeline.ts` | `fetchAndDecodePlot`, `toSVGPlotCurvesData` | API + decode bridge |
| `lib/api/dashboard.ts` | `dashboardApi.getSVGPlotDataBinary` | HTTP client |
| `lib/utils/decode-worker-client.ts` | `decodeBinaryPlotDataInWorker` | Worker pool |
| `lib/utils/binary-decode-core.ts` | `decodeBinaryPlotDataCore` | Shared decode logic |
| `workers/binary-decode.worker.ts` | — | Off-thread decode |

### Rendering

| File | Exports | Responsibility |
|------|---------|----------------|
| `components/charts/SVGPlotCard.tsx` | `SVGPlotCard` | Card chrome — **reuse for damage** |
| `components/charts/SVGPlot.tsx` | `SVGPlot` | SVG line plot orchestrator |
| `components/charts/SVGAxes.tsx` | `SVGAxes` | Axes/grid typography |
| `components/charts/SVGPath.tsx` | `SVGPath` | Line path from Float32Arrays |
| `components/charts/InteractiveCanvasPlot.tsx` | `InteractiveCanvasPlot` | Canvas + hover |
| `components/charts/PlotTooltip.tsx` | `PlotTooltip` | Tooltip UI |
| `components/charts/types.ts` | `Curve`, `PlotConfig`, `AxisLimits` | Shared chart types |

### Chart utilities

| File | Exports | Responsibility |
|------|---------|----------------|
| `lib/chart-utils/scales.ts` | `calculateAxisLimits`, `createScale` | Continuous axis math |
| `lib/chart-utils/sort.ts` | `sortCurvesForRendering` | Z-order |
| `lib/chart-utils/color.ts` | `getCurveDisplayColor` | Curve color resolution |

### State

| File | Exports | Responsibility |
|------|---------|----------------|
| `stores/render-store.ts` | `useRenderStore` | Plot cache, loading, errors |
| `stores/plot-settings-store.ts` | `usePlotSettingsStore` | Per-plot axis sync |
| `stores/pinned-events-store.ts` | `usePinnedEventsStore` | Pin mode |
| `stores/color-selection-store.ts` | — | Color overrides |
| `stores/ui-store.ts` | `useUIStore` | Tab, curve visibility |
| `hooks/use-filter-state.ts` | `useFilterState` | Selection, rendered snapshot |
| `hooks/use-curve-coloring.ts` | `useCurveColoring` | Program/version colors |

### Configuration

| File | Exports | Responsibility |
|------|---------|----------------|
| `client/settings.yaml` | — | Plot keys source of truth |
| `scripts/generate-settings.js` | — | Codegen |
| `config/settings.ts` | `DEFAULT_PLOT_KEYS*` | Generated constants |
| `config/constants.ts` | Re-exports | Public config API |

---

## Dashboard — Backend

| File | Symbols | Responsibility |
|------|---------|----------------|
| `server/routers/dashboard.py` | `get_plot_data_binary_post`, `_build_binary_plot_data_response`, `render_grid`, `render_interactive` | HTTP layer |
| `server/services/query.py` | `get_plot_data`, `get_plot_data_binary`, `_fetch_plot_data` | LTTB fetch |
| `server/services/plot_image.py` | `PlotImageService` | Matplotlib PNG (legacy) |
| `server/storage/database.py` | `UnifiedStore.get_lttb_bulk` | DuckDB queries |
| `server/models/dashboard.py` | `PlotDataRequest`, `RenderGridRequest`, etc. | Pydantic models |
| `server/dependencies.py` | `QueryServiceDep` | DI |
| `server/config.py` | `max_events_per_query` | Limits |

---

## Inspect Damage — Frontend

### Page & state

| File | Exports | Responsibility |
|------|---------|----------------|
| `app/inspect-damage/page.tsx` | — | Route composition |
| `types/damage-comparison.ts` | `DamageComparisonState` | Comparison state shape |
| `lib/damage-comparison-state.ts` | Session sync helpers | Persistence |
| `hooks/use-inspect-damage-state.ts` | — | Route state hook |

### Transform layer (canonical — do not rework)

| File | Exports | Responsibility |
|------|---------|----------------|
| `features/inspect-damage/lib/build-damage-comparison-raw-facts.ts` | `buildDamageComparisonRawFacts` | API → facts |
| `features/inspect-damage/lib/build-damage-comparison-aggregates.ts` | `buildDamageComparisonAggregates` | Facts → tables |
| `features/inspect-damage/lib/build-damage-comparison-view-model.ts` | `buildDamageComparisonViewModel` | VM + empty states |

### Plot rendering (3D today — extend for 2D)

| File | Exports | Responsibility |
|------|---------|----------------|
| `features/inspect-damage-3d/lib/build-comparison-damage-plot-cells.ts` | `buildComparisonDamagePlotCells` | VM → 3D cells |
| `features/inspect-damage-3d/lib/damage-plot-layout.ts` | `computeDamagePlotLayout` | Cells → Three.js layout |
| `features/inspect-damage-3d/lib/damage-color-scale.ts` | `getDamageColor` | Magnitude colors |
| `features/inspect-damage-3d/lib/damage-plot-overlay-types.ts` | `DamagePlotType`, etc. | Plot type enums |
| `features/inspect-damage-3d/lib/damage-plot-types.ts` | `DamagePlotCell` | Cell model |
| `features/inspect-damage-3d/lib/damage-channel-axis.ts` | `DAMAGE_CHANNELS` | Channel definitions |
| `features/inspect-damage-3d/components/DamagePlotView.tsx` | `DamagePlotView` | Top-level plot area |
| `features/inspect-damage-3d/components/DamagePlotCanvas.client.tsx` | — | Three.js renderer |
| `features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx` | — | Control rail |
| `features/inspect-damage-3d/components/DamagePlotColorLegend.tsx` | — | 3D legend |

### PRD-35 — Proposed new modules

| File | Exports | Responsibility |
|------|---------|----------------|
| `features/inspect-damage-plots/lib/build-damage-2d-plot-spec.ts` | `buildDamage2DPlotSpec` | VM → 2D spec |
| `features/inspect-damage-plots/lib/get-comparison-plot-dataset.ts` | `getComparisonPlotDataset` | Shared data layer |
| `features/inspect-damage-plots/lib/damage-scale-transform.ts` | `applyDamageScale` | Linear/log |
| `features/inspect-damage-plots/components/DamagePlot2DChart.tsx` | — | SVG categorical router |
| `features/inspect-damage-plots/components/DamagePlot2DGroupedBar.tsx` | — | Grouped bar renderer |
| `features/inspect-damage-plots/components/DamagePlot2DHeatmap.tsx` | — | Heatmap renderer |
| `features/inspect-damage-plots/components/DamagePlotControlRail.tsx` | — | Extracted rail |
| `components/charts/PlotCardShell.tsx` | `PlotCardShell` | Shared card chrome |

---

## Test files (prior art)

| File | Covers |
|------|--------|
| `features/inspect-damage/__tests__/build-damage-comparison-aggregates.test.ts` | Aggregate math |
| `features/inspect-damage-3d/__tests__/build-comparison-damage-plot-cells.test.ts` | Cell builder |
| `features/inspect-damage/__tests__/build-damage-comparison-view-model.test.ts` | Empty states |
| `lib/chart-utils/scales.test.ts` | Axis limits |
| `lib/api/derived-data.test.ts` | API patterns |

---

## Execution flows (GitNexus process names)

| Flow | Entry | Path |
|------|-------|------|
| Dashboard grid render | `PlotGrid` mount + `isRendering` | Render → sequential fetch → SVG cards |
| Dashboard interactive | `InteractiveViewer` | Cache read → lazy fetch → Canvas |
| Inspect damage plot | `DamagePlotView` | VM → cells → layout → Three.js |
| Legacy server grid | `render_grid` | **Unused** — NDJSON PNG stream |

---

## Cross-cutting dependencies

```
settings.yaml
    → DEFAULT_PLOT_KEYS (client)
    → channel_map (server) — must align

measurements_lttb (DuckDB)
    → get_lttb_bulk (server)
    → binary decode (client)
    → SVGPlot

DamageInspectResponse (API)
    → raw facts → aggregates → cells/spec
    → 2D SVG | 3D Three.js
```
