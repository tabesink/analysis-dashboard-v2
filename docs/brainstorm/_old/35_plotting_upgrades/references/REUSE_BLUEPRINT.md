# Reuse Blueprint — Damage 2D/3D Plot Cards

Implementation scaffolding derived from Dashboard grid layout audit. Use when breaking PRD-35 into sequential issues.

> Status: superseded for issue order and final layout by `../IMPLEMENTATION_MAP.md`.
> This file remains useful for reusable component ideas and current-code context, but it still documents the earlier single-card control-rail direction in places. For implementation, follow `../PRD.md`, `../IMPLEMENTATION_MAP.md`, `../HANDOFF.md`, and `../issues/`.

**Principle:** Reuse **card chrome, axis typography, empty/loading/error patterns** from Dashboard. Do **not** force damage categorical data into the Dashboard **line-curve** model.

---

## Architecture target

```
┌──────────────────────────────────────────────────────────────┐
│ DamagePlotView                                               │
│  ┌──────────────┬──────────────────────────────────────────┐ │
│  │ ControlRail  │  PlotCardShell (Dashboard-style)         │ │
│  │ (always on)  │  ┌────────────────────────────────────┐  │ │
│  │              │  │ Renderer by visualization_mode:    │  │ │
│  │ plot type    │  │  2d → DamagePlot2DChart (SVG)      │  │ │
│  │ viz mode     │  │  3d → DamagePlotCanvas (Three.js)  │  │ │
│  │ value mode   │  └────────────────────────────────────┘  │ │
│  │ channels     │  [legend inside/near card]               │ │
│  │ version      │                                          │ │
│  │ damage scale │                                          │ │
│  └──────────────┴──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Slice order (recommended)

### Slice 1 — Cumulative by channel (2D grouped bar)

**Why first:** Clearest notebook alignment, lowest data-shape risk (PRD).

| Task | File | Action |
|------|------|--------|
| Add viz mode state | `damage-comparison-state.ts` | `visualization_mode: '2d' \| '3d'`, default `'2d'` |
| Spec builder | `build-damage-2d-plot-spec.ts` | Implement `cumulative_by_channel` only |
| Log transform util | `damage-scale-transform.ts` | `applyDamageScale(value, mode)` |
| SVG renderer | `DamagePlot2DGroupedBar.tsx` | Grouped Ref/Target bars |
| Card shell | Extract from `SVGPlotCard` | `PlotCardShell.tsx` — loading/error/empty/label |
| Wire view | `DamagePlotView.tsx` | Branch on `visualization_mode` |
| Control rail | `DamagePlotControlRail.tsx` | Add segmented 2D/3D toggle |
| Tests | `build-damage-2d-plot-spec.test.ts` | Notebook-parity values for channel totals |

**Acceptance:**
- Default route opens 2D grouped bar
- 3D mode still works via existing path
- No damage recalculation on mode/plot type change
- Subtitle shows Ref/Target event counts

### Slice 2 — Visualization mode + control rail polish

- Direct plot-type rows with checkbox affordance (replace dropdown if present)
- Rail full height, visible in empty states
- Disabled controls when irrelevant to plot type

### Slice 3 — Absolute by event (heatmap)

- `chartKind: 'heatmap'` in spec builder
- `DamagePlot2DHeatmap.tsx` — uses `damage-color-scale` bands
- Rendering limits with graceful message (PRD #34)

### Slice 4 — Cumulative by program/version

- `program-version-bar` chart kind
- Version slice filtering tests

### Slice 5 — Target delta vs reference

- `diverging-bar` with absolute delta, percent diff, normalized ratio
- Low-reference guards from aggregates

---

## Module reuse map

| Dashboard artifact | Reuse in damage plots | Adaptation |
|-------------------|----------------------|------------|
| `SVGPlotCard` | `PlotCardShell` | Remove curve-specific sync toggle; add subtitle slot |
| `SVGPlot` axes/grid | `DamagePlot2DAxes` | Categorical X ticks, not `createScale` on continuous data |
| `SVGAxes` typography | Copy token classes | Same font sizes, grid line opacity |
| `CardLabel` (bottom-left chip) | Same position/style | Title + event count |
| `calculateAxisLimits` | `computeCategoricalYDomain` | New — bar/heatmap Y envelope |
| `PlotGrid` grid CSS | Optional multi-card future | Single card for now; same `gap-3`, `aspect-4/3` |
| `useSequentialPlotData` | **Do not reuse** | Damage data already in memory |
| `render-store` | Optional cache | Only if tab-switch preservation needed |
| `buildPathD` / `SVGPath` | **Do not reuse** | Categorical charts, not line paths |

| Damage artifact | Keep | Notes |
|----------------|------|-------|
| `buildDamageComparisonViewModel` | Yes | Entry point |
| `buildDamageComparisonAggregates` | Yes | Canonical source |
| `buildComparisonDamagePlotCells` | Yes | 3D path + informs 2D spec |
| `computeDamagePlotLayout` | Yes | 3D only |
| `DamagePlotColorLegend` | Yes | 3D; 2D gets inline legend from spec |
| `damage-color-scale.ts` | Yes | Heatmaps + magnitude |

---

## `DamagePlotView` refactor sketch

```typescript
export function DamagePlotView({ comparison, comparisonViewModel, onUpdateComparison }) {
  const visualizationMode = comparison.visualization_mode ?? '2d';
  const [displayState, setDisplayState] = useState<DamagePlotDisplayState>(...);

  const spec2d = useMemo(() =>
    visualizationMode === '2d'
      ? buildDamage2DPlotSpec({ viewModel: comparisonViewModel, ... })
      : null,
    [visualizationMode, comparisonViewModel, displayState, comparison],
  );

  const cells3d = useMemo(() =>
    visualizationMode === '3d'
      ? buildComparisonDamagePlotCells({ ... })
      : null,
    [visualizationMode, ...],
  );

  return (
    <div className="flex h-full ...">
      <DamagePlotControlRail
        visualizationMode={visualizationMode}
        onVisualizationModeChange={(m) => onUpdateComparison({ visualization_mode: m })}
        ...
      />
      <PlotCardShell
        title={getPlotTitle(displayState.plotType)}
        subtitle={comparisonViewModel.subtitleText}
        isLoading={comparisonViewModel.emptyState?.code === 'missing_damage_response'}
        isEmpty={!!comparisonViewModel.emptyState}
        emptyTitle={comparisonViewModel.emptyState?.title}
        emptyDescription={comparisonViewModel.emptyState?.description}
      >
        {visualizationMode === '2d' && spec2d
          ? <DamagePlot2DChart spec={spec2d} />
          : cells3d
            ? <DamagePlotCanvas layout={layout3d} />
            : null}
      </PlotCardShell>
    </div>
  );
}
```

---

## 2D spec builder — cumulative by channel algorithm

```
Input: viewModel.aggregates.channel (or sum event_channel by dataset+channel)
Filter: selectedChannelKeys, effectiveVersion
For each channel:
  reference_value = channel row where dataset=reference
  target_value = channel row where dataset=target
  apply value_mode → selected_value
  apply damageScaleMode → transformDamageScale(value)
Output series:
  [{ id: 'reference', label: 'Reference', color: REF_COLOR, values: [...] },
   { id: 'target', label: 'Target', color: TGT_COLOR, values: [...] }]
xCategories = channel labels in display order
```

Mirror logic already in `buildChannelTotalsCells` — spec builder can call shared `getChannelComparisonValues()` to avoid drift.

---

## Shared transform extraction

**Problem:** `buildChannelTotalsCells` (3D) and future `buildDamage2DPlotSpec` (2D) will duplicate aggregation reads.

**Solution:** Extract `getComparisonPlotDataset()`:

```typescript
// lib/get-comparison-plot-dataset.ts
type ComparisonPlotDataset = {
  channelTotals: { channelKey, channelLabel, reference, target }[];
  eventChannelMatrix: DamagePlotCell[];
  programVersionRows: DamagePlotCell[];
  deltaRows: { channelKey, value, lowReference, direction }[];
};

function getComparisonPlotDataset(
  viewModel: DamageComparisonViewModel,
  plotType: DamagePlotType,
  filters: { selectedChannelKeys, version, valueMode },
): ComparisonPlotDataset;
```

Then:
- `buildComparisonDamagePlotCells` maps dataset → 3D cells
- `buildDamage2DPlotSpec` maps dataset → 2D spec

---

## SVG 2D renderer checklist (Dashboard parity)

| Element | Dashboard reference | Damage 2D implementation |
|---------|--------------------|-------------------------|
| White plot background | `SVGPlot` white rect | Same |
| Grid lines | `SVGAxes` | `DamagePlot2DAxes` |
| Bottom-left title chip | `CardLabel` in `SVGPlotCard` | `PlotCardShell` footer |
| Axis label font | `text-xs` muted | Match |
| Hover tooltip | `PlotTooltip` / canvas hover | `DamagePlot2DTooltip` — channel, value, dataset |
| Loading spinner | `Loader2` centered | Reuse |
| Error state | `AlertCircle` + message | Reuse |
| Empty axes | `SVGPlot` with `curves=[]` | Empty message centered (damage has richer empty copy) |
| Aspect ratio | `aspect-4/3` | Same |

---

## 3D mode retention checklist

- [ ] `visualization_mode === '3d'` uses existing `buildComparisonDamagePlotCells` → `computeDamagePlotLayout` → `DamagePlotCanvas`
- [ ] `MAX_RENDERED_CELLS = 300` cap preserved
- [ ] `DamagePlotColorLegend` visible in 3D mode only (or 2D magnitude heatmaps)
- [ ] Log scale uses shared `damage-scale-transform.ts`
- [ ] Cap warning in control rail when `isCapped`

---

## Issue breakdown template

Use these IDs when creating `docs/brainstorm/35_plotting_upgrades/issues/`:

| ID | Title | Depends |
|----|-------|---------|
| PU-35-01 | Add visualization_mode to comparison state + rail toggle | — |
| PU-35-02 | Extract PlotCardShell from SVGPlotCard | — |
| PU-35-03 | buildDamage2DPlotSpec — cumulative_by_channel + tests | PU-35-01 |
| PU-35-04 | DamagePlot2DGroupedBar SVG renderer | PU-35-02, PU-35-03 |
| PU-35-05 | Wire 2D default in DamagePlotView | PU-35-01–04 |
| PU-35-06 | Extract getComparisonPlotDataset shared module | PU-35-03 |
| PU-35-07 | absolute_by_event heatmap spec + renderer | PU-35-06 |
| PU-35-08 | program/version 2D chart | PU-35-06 |
| PU-35-09 | target delta diverging chart + low-ref guards | PU-35-06 |
| PU-35-10 | Control rail UX (rows, empty-state visibility) | PU-35-05 |

---

## Non-goals for reuse blueprint

- Do not port Dashboard `Render` button pattern — damage plots update immediately
- Do not use binary LTTB API for damage
- Do not merge damage into `PlotGrid` 8-card layout (single comparison card)
- Do not reuse Dashboard event color palette for Ref/Target semantics

---

## Verification against notebook

For each plot type, add one fixture test comparing `buildDamage2DPlotSpec` output to expected values from `notebooks/relative_damage_calculation_comaparison.ipynb`:

1. Export notebook channel totals for a known event pair
2. Hardcode as test fixture in `build-damage-2d-plot-spec.test.ts`
3. Assert `series[].values` within tolerance

Semantic parity, not pixel parity (PRD out of scope).
