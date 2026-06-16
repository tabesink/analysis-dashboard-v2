# Data Contracts — Plot Pipelines

Canonical shapes for Dashboard grid plots and Inspect Damage comparison plots. Use as implementation reference for PRD-35.

---

## Dashboard — API request

### `PlotDataRequest`

```typescript
// POST /api/v1/dashboard/plots/data/binary
{
  event_ids: string[];
  plot_keys: string[];
}
```

**Current client usage:** `plot_keys` always `[singleKey]` per request.  
**Server capability:** Accepts multiple keys; single `get_lttb_bulk` query.

---

## Dashboard — Binary response

Wire format (little-endian):

```
uint32  num_curves
repeat num_curves:
  uint16  len_event_id
  bytes   event_id
  uint16  len_plot_key
  bytes   plot_key
  uint32  num_points
  float32[num_points] x
  float32[num_points] y
```

Decode output (`BinaryCurveData`):

```typescript
{
  eventId: string;
  plotKey: string;
  xArray: Float32Array;
  yArray: Float32Array;
}
```

Grouped: `Map<string, BinaryCurveData[]>` keyed by `plotKey`.

---

## Dashboard — Client normalized types

### `SVGPlotCurvesData` (`types/api.ts`)

```typescript
interface SVGPlotCurvesData {
  curves: {
    event_id: string;
    points: { x: number; y: number }[];  // empty from binary path
    x_array?: Float32Array;
    y_array?: Float32Array;
    color?: string;
  }[];
  x_label: string;  // cleared by toSVGPlotCurvesData
  y_label: string;
  x_unit: string;
  y_unit: string;
}
```

### `Curve` (`components/charts/types.ts`)

```typescript
interface Curve {
  eventId: string;
  eventName?: string;
  points: Point[];
  xArray?: Float32Array;
  yArray?: Float32Array;
  color?: string;
}
```

### `PlotConfig`

```typescript
interface PlotConfig {
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
}
```

### `AxisLimits`

```typescript
interface AxisLimits {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
```

### `PlotInfo` (PlotGrid internal)

```typescript
type PlotInfo = {
  curves: Curve[];
  config: PlotConfig;
  axisLimits: AxisLimits;
  rawAxisLimits: AxisLimits | null;
};
```

---

## Dashboard — Render store

```typescript
interface RenderState {
  isRendering: boolean;
  renderVersion: number;  // unused
  selectedPlotKey: string | null;
  cachedPlots: Map<string, SVGPlotCurvesData>;
  loadingPlots: Set<string>;
  plotErrors: Record<string, string>;
}
```

---

## Dashboard — Session

```typescript
session.data_state: {
  program_ids: string[];
  versions: string[];
  selected_event_ids: string[];
}

session.rendered_event_ids: string[];  // snapshot at Render
```

---

## Dashboard — Plot key config

From `settings.yaml` / `settings.ts`:

```typescript
DEFAULT_PLOT_KEYS: Record<string, {
  title: string;
  x_label: string;
  y_label: string;
}>;

DEFAULT_PLOT_KEYS_ARRAY: string[];  // 8 keys
getPlotDisplayTitle(plotKey: string): string;
getPlotXLabel(plotKey: string): string;
getPlotYLabel(plotKey: string): string;
```

---

## Legacy server — `RenderGridRequest` (unused)

```python
class RenderGridRequest:
    event_ids: list[str]
    plot_keys: list[str]
    grid_columns: int = 3       # ignored
    baseline_opacity: float = 0.5  # ignored
    axis_labels: dict[str, PlotAxisLabels] | None
    color_grouping: ColorGroupingConfig | None
    curve_colors: CurveColorConfig | None
    plot_settings: dict[str, PlotAxisSettings] | None
```

NDJSON stream events: `progress`, `plot_image`, `complete`, `error`.

---

## Inspect Damage — Comparison state

```typescript
// types/damage-comparison.ts
interface DamageComparisonState {
  reference: { selected_event_ids: string[] };
  target: { selected_event_ids: string[] };
  selected_channel_keys: string[];
  value_mode: 'absolute' | 'normalized';
}
```

**PRD-35 addition (proposed):**

```typescript
visualization_mode: '2d' | '3d';  // default '2d'
```

---

## Inspect Damage — View model

```typescript
// build-damage-comparison-view-model.ts
type DamageComparisonViewModel = {
  inspectEventIds: string[];
  emptyState: ComparisonEmptyState | null;
  selectionSummary: ComparisonSelectionSummary;
  subtitleText: string;
  legendText: string;
  aggregates: DamageComparisonAggregateOutput | null;
};
```

---

## Inspect Damage — Aggregate rows

### `EventChannelAggregateRow`

```typescript
{
  dataset: 'reference' | 'target';
  event_id: string;
  program_id: string;
  version: string;
  channel_key: string;
  channel_label: string;
  absolute_damage: number;
  normalized_damage: number;
  selected_value: number;  // picks by value_mode
}
```

### `ChannelDeltaAggregateRow`

```typescript
{
  channel_key: string;
  channel_label: string;
  reference_damage: number;
  target_damage: number;
  absolute_delta: number;
  percent_difference: number | null;
  ratio: number | null;
  normalized_ratio: number | null;
  low_reference: boolean;
  low_reference_reason: 'missing_or_below_threshold' | null;
  selected_metric: 'absolute_delta' | 'normalized_ratio';
  selected_value: number | null;
}
```

---

## Inspect Damage — 3D cell model

```typescript
// damage-plot-types.ts
interface DamagePlotCell {
  eventId: string;
  eventLabel: string;
  eventIndex: number;
  version: string;
  channelKey: string;
  channelLabel: string;
  channelIndex: number;
  damage: number;
  metadata: { program_id: string | null };
}
```

### Plot types

```typescript
type DamagePlotType =
  | 'cumulative_by_program_version'
  | 'absolute_by_event'
  | 'cumulative_by_channel'
  | 'target_delta_vs_reference';

type DamagePlotScaleMode = 'linear' | 'log';
```

---

## PRD-35 — Proposed 2D plot spec (new contract)

Stable interface for categorical SVG renderers:

```typescript
type Damage2DChartKind =
  | 'grouped-bar'      // cumulative_by_channel
  | 'heatmap'          // absolute_by_event (preferred dense view)
  | 'program-version-bar'  // cumulative_by_program_version
  | 'diverging-bar';   // target_delta_vs_reference

interface Damage2DPlotSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
  flags?: ('low_reference' | 'excluded')[];
}

interface Damage2DPlotSpec {
  plotType: DamagePlotType;
  chartKind: Damage2DChartKind;
  title: string;
  subtitle: string;  // Ref/Target event counts
  xCategories: string[];
  yScale: {
    mode: DamagePlotScaleMode;
    domain: [number, number];
    tickFormat: 'linear' | 'log' | 'percent' | 'ratio';
  };
  series: Damage2DPlotSeries[];
  legend: { label: string; color: string; role: 'reference' | 'target' | 'delta' | 'magnitude' }[];
  warnings: string[];
  emptyState: { title: string; description: string } | null;
}

function buildDamage2DPlotSpec(input: {
  viewModel: DamageComparisonViewModel;
  plotType: DamagePlotType;
  valueMode: DamagePlotValueMode;
  selectedChannelKeys: readonly string[];
  version: string | undefined;
  damageScaleMode: DamagePlotScaleMode;
  channels: readonly DamageChannelDefinition[];
}): Damage2DPlotSpec;
```

**Invariants:**
- Spec builder reads aggregates only — never recomputes damage
- Low-reference channels flagged in `warnings` / `flags`, not shown as extreme ratios
- Log scale: `log10(1 + x)` consistent with 3D path
- Semantic colors: Reference/Target fixed palette, not Dashboard event colors

---

## PRD-35 — Proposed card shell contract

Generalize `SVGPlotCard` for any renderer child:

```typescript
interface PlotCardShellProps {
  plotKey?: string;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClick?: () => void;
  actionButtons?: React.ReactNode;
  footer?: React.ReactNode;
  aspectRatio?: '4/3' | '16/9' | 'auto';
  children: React.ReactNode;
}
```

**Dashboard line plots** pass `SVGPlot` as child.  
**Damage 2D** passes `DamagePlot2DChart`.  
**Damage 3D** passes `DamagePlotCanvas` viewport.

---

## Semantic comparison colors (proposed)

```typescript
const DAMAGE_COMPARISON_COLORS = {
  reference: '#2563eb',  // blue
  target: '#f97316',     // orange
  deltaPositive: '#dc2626',
  deltaNegative: '#16a34a',
  magnitudeScale: 'damage-color-scale',  // discrete bands from damage-color-scale.ts
} as const;
```

Do **not** use `getCurveColor(event_id)` for Reference/Target bars.

---

## Test contract checklist (from PRD)

| Test target | Assert |
|-------------|--------|
| `buildDamage2DPlotSpec` | Values, labels, warnings per plot type |
| Value mode | absolute vs normalized `selected_value` mapping |
| Log scale | Transformed domain matches 3D `log10(1+x)` |
| Channel filter | Unselected channels absent from spec |
| Version slice | Only matching version rows |
| Low reference | Flagged/excluded in delta views |
| Empty states | All 5 empty codes produce correct messages |
| Control rail | Plot type rows, viz mode toggle, callbacks |
| Top-level view | 2D renders SVG cards; 3D renders canvas path |
