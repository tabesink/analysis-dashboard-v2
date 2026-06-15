# Refactoring Strategies — Production-Grade Quality

Patterns to improve code quality, scalability, and maintainability **without changing user-visible behavior**. Split into **Dashboard grid debt** (can land independently) and **PRD-35 enablers**.

---

## Dashboard grid — independent improvements

### 1. Batch binary plot fetch

**Problem:** 8 sequential HTTP requests, each re-querying DuckDB for one `plot_key`.

**Strategy:**

```typescript
// use-sequential-plot-data.ts — behavioral equivalent, faster
const buffer = await dashboardApi.getSVGPlotDataBinary(
  { event_ids: eventIds, plot_keys: plotKeys },  // all keys
  { signal },
);
const grouped = await decodeBinaryPlotDataInWorker(buffer, { signal });
for (const plotKey of plotKeys) {
  updateCachedPlot(plotKey, toSVGPlotCurvesData(grouped.get(plotKey) ?? []));
  removeLoadingPlot(plotKey);
}
```

**Preserves:** Progressive UI (update store per key in loop), abort semantics, error per key.

**Risk:** Low. API already supports multi-key; server does single `get_lttb_bulk`.

---

### 2. Extract `usePlotCurves` transform hook

**Problem:** `PlotGrid` and `InteractiveViewer` duplicate `SVGPlotCurvesData` → `Curve[]` with divergent pinned behavior.

**Strategy:**

```typescript
type PlotCurveMode = 'grid' | 'interactive';

function usePlotCurves(options: {
  raw: SVGPlotCurvesData | undefined;
  plotKey: string | null;
  mode: PlotCurveMode;
  pinnedModeEnabled: boolean;
  pinnedSet: Set<string>;
  curveVisibility?: Record<string, boolean>;
  getCurveColor: (eventId: string) => string;
  eventVersionMap: Map<string, string>;
}): Curve[];
```

| Mode | Pinned behavior | Visibility |
|------|----------------|------------|
| `grid` | Filter out unpinned | N/A |
| `interactive` | Grey unpinned | Respect `curveVisibility` |

**Preserves:** Current grid filter vs interactive grey semantics explicitly encoded.

---

### 3. Session restore auto-fetch

**Problem:** `rendered_event_ids` persist; `cachedPlots` empty after reload.

**Strategy:**

```typescript
// PlotGrid.tsx — new effect
useEffect(() => {
  if (!isSessionReady) return;
  if (renderedEventIds.length === 0) return;
  if (streamedPlots.size > 0) return;
  if (isStreaming || isRendering) return;
  startSequentialFetch(renderedEventIds, DEFAULT_PLOT_KEYS_ARRAY);
}, [isSessionReady, renderedEventIds, streamedPlots.size]);
```

**Preserves:** No auto-fetch on fresh session with no prior render. Only restores when snapshot exists but cache empty.

**UX change note:** Plots appear without clicking Render after reload — arguably a bugfix, not feature change. Flag behind `AUTO_RESTORE_PLOTS` constant if strict no-behavior-change required.

---

### 4. Fix or remove broken JSON plot cache path

**Problem:** `_get_events_metadata_bulk` called but not defined.

**Options (pick one):**

| Option | Action |
|--------|--------|
| A. Implement | Add bulk metadata query to `QueryService` |
| B. Remove metadata | Drop status from JSON series if unused |
| C. Deprecate | Mark `/plot-data`, `/plots/data`, render endpoints deprecated |

**Recommendation:** Option C for render endpoints; Option A minimal fix if JSON path still needed for exports.

---

### 5. Wire `PlotGrid` column props

**Problem:** `DashboardPage` passes `columns` but tabs don't forward.

**Strategy:** Update `DashboardTabConfig` to accept optional props; `DashboardTabs` spreads `componentProps`.

**Preserves:** Default `columns=3` when not passed.

---

### 6. Remove dead `renderVersion`

**Strategy:** Delete field from `render-store` or implement increment in `clearCachedPlots` / `startSequentialFetch`.

**Preserves:** Behavior if deleted (field unused). If implemented, enables future cache-bust without full clear.

---

### 7. Deprecate matplotlib endpoints

**Strategy:**
- Add `docs/decisions/log.md` entry marking `/render-grid`, `/render-interactive`, `/click-query` as legacy
- Add `@deprecated` comments in router
- Do not delete until export/email use case confirmed absent

**Quality win:** Reduces dual-stack maintenance, eliminates event-loop blocking risk.

---

## PRD-35 enablers (quality architecture)

### 8. Extract `PlotCardShell`

**From:** `SVGPlotCard`  
**To:** Shared shell in `client/src/components/charts/PlotCardShell.tsx`

`SVGPlotCard` becomes thin wrapper: shell + `SVGPlot` child.

**Enables:** Damage 2D/3D cards with identical chrome.

---

### 9. Shared damage scale transform

**From:** Inline in `DamagePlotView.tsx`  
**To:** `damage-scale-transform.ts`

```typescript
export function applyDamageScale(
  value: number,
  mode: DamagePlotScaleMode,
): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return mode === 'log' ? Math.log10(1 + value) : value;
}

export function applyDamageScaleToCells(
  cells: readonly DamagePlotCell[],
  mode: DamagePlotScaleMode,
): DamagePlotCell[];
```

**Enables:** 2D/3D log parity (PRD #21).

---

### 10. Shared comparison plot dataset

**From:** Duplicated logic in cell builder + future spec builder  
**To:** `get-comparison-plot-dataset.ts`

Single read of aggregates → typed dataset → consumed by both renderers.

**Enables:** Testable data layer; prevents 2D/3D value drift.

---

### 11. Renderer strategy pattern

```typescript
type DamageVisualizationMode = '2d' | '3d';

interface DamagePlotRendererProps {
  mode: DamageVisualizationMode;
  spec2d: Damage2DPlotSpec | null;
  layout3d: DamagePlotLayout | null;
}

function DamagePlotRenderer({ mode, spec2d, layout3d }: DamagePlotRendererProps) {
  if (mode === '2d' && spec2d) return <DamagePlot2DChart spec={spec2d} />;
  if (mode === '3d' && layout3d) return <DamagePlotCanvas layout={layout3d} />;
  return null;
}
```

**Enables:** `DamagePlotView` stays thin; testable renderer switching.

---

### 12. Categorical chart utilities (not line-curve utils)

**Do not reuse:** `buildPathD`, `SVGPath`, `calculateAxisLimits(Curve[])`

**Create:**

```typescript
// lib/chart-utils/categorical.ts
function computeBarYDomain(values: number[], padding?: number): [number, number];
function computeHeatmapColorDomain(values: number[], mode: DamagePlotScaleMode): [number, number];
function layoutGroupedBars(categories: string[], series: Damage2DPlotSeries[], dims: Dimensions): BarLayout[];
```

**Enables:** 2D damage charts without polluting line-chart utilities.

---

## Backend quality (no behavior change for active path)

### 13. Unify LTTB fetch internals

```python
# query.py
def _fetch_lttb_series(self, event_ids, plot_keys, *, include_metadata: bool) -> list[dict]:
    ...

def get_plot_data(self, ...):
    return self._serialize_json(self._fetch_lttb_series(..., include_metadata=True))

def get_plot_data_binary(self, ...):
    return self._serialize_binary(self._fetch_lttb_series(..., include_metadata=False))
```

**Preserves:** Same outputs; fixes metadata bug path; reduces duplication.

---

### 14. Optional binary response cache

Cache keyed by `(sorted(event_ids), sorted(plot_keys))` with same 600s TTL as JSON.

**Risk:** Memory per worker. Measure before enabling.

**Preserves:** Response bytes identical on hit.

---

### 15. `asyncio.to_thread` for matplotlib (if legacy kept)

```python
img_bytes = await asyncio.to_thread(
    image_service.generate_grid_cell_image,
    ...
)
```

**Preserves:** Same PNG output; frees event loop.

---

## Testing strategy (quality gates)

| Area | Test type | Proves |
|------|-----------|--------|
| `buildDamage2DPlotSpec` | Unit | Values, labels, warnings, empty states |
| `getComparisonPlotDataset` | Unit | Shared data for 2D/3D |
| `applyDamageScale` | Unit | Log linear parity |
| `usePlotCurves` | Unit | Grid filter vs interactive grey |
| Batch fetch | Integration | All 8 keys from one response |
| `PlotCardShell` | Component | Loading/error/empty/title |
| Control rail | Component | Viz mode toggle, plot type rows |

**Avoid:** SVG path string snapshots unless renderer contract owns them (PRD testing decisions).

---

## Migration risk matrix

| Refactor | Risk | Rollback |
|----------|------|----------|
| Batch fetch | Low | Revert to per-key loop |
| usePlotCurves | Medium | Keep inline transforms until tests pass |
| PlotCardShell extract | Low | SVGPlotCard unchanged externally |
| getComparisonPlotDataset | Medium | Cell builder delegates to new module |
| Deprecate render-grid | Low | Endpoints remain, unused |
| Fix _get_events_metadata_bulk | Low | Only affects unused JSON path |

---

## Suggested commit sequence (dashboard debt)

1. `test: usePlotCurves grid and interactive modes`
2. `refactor: extract usePlotCurves from PlotGrid and InteractiveViewer`
3. `test: batch binary fetch populates all plot keys`
4. `perf: fetch all plot keys in single binary request`
5. `refactor: extract PlotCardShell from SVGPlotCard`
6. `docs: deprecate server matplotlib render endpoints`

## Suggested commit sequence (PRD-35)

1. `feat: visualization_mode on damage comparison state`
2. `feat: buildDamage2DPlotSpec cumulative_by_channel + tests`
3. `feat: DamagePlot2DGroupedBar renderer`
4. `feat: wire 2D default in DamagePlotView with PlotCardShell`
5. `refactor: extract getComparisonPlotDataset`
6. `feat: heatmap, program/version, delta chart kinds`
