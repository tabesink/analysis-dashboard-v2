# Client Typography Audit — Phase 38 Baseline

Audit of typography across `client/src`, classified against the Phase 38 design contract in `DESIGN.md` §5. Companion to `CLIENT_COMPONENT_AUDIT.md`.

**Scope:** font families, type scale, weights, line height, tracking, monospace usage, prose/markdown, and typography in protected plot surfaces.

**Audit method:** static scan of `globals.css`, root layout, shadcn primitives, and all `*.tsx` class usage under `client/src`.

---

## Classification Key

| Status | Meaning |
|--------|---------|
| **Aligned** | Matches Phase 38 `DESIGN.md` typography contract. |
| **Acceptable drift** | Intentional density trade-off; token-normalizable without behavior change. |
| **Drift** | Conflicts with contract; should be addressed in a UI38 slice. |
| **Protected** | Plot/chart typography; do not restyle unless a later issue explicitly authorizes it. |

---

## Summary

| Finding | Status |
|---------|--------|
| Geist Sans/Mono loaded globally | **Drift** — contract requires system UI only |
| No `text-3xl` / `text-xl` page headers | **Acceptable drift** — app is intentionally compact |
| `text-xs` + `text-sm` dominate (~246 uses) | **Aligned** — matches dense dashboard direction |
| 27 arbitrary `text-[Npx]` sizes | **Drift** — bypasses Tailwind scale |
| Custom `.text-caption` / `.text-label` utilities | **Drift** — parallel micro-scale outside shadcn |
| `font-mono` only 7 uses | **Drift** — under-applied for technical IDs |
| `font-bold` unused | **Aligned** |
| `text-muted-foreground` widely used | **Aligned** |
| Hardcoded `text-gray-*` / `text-zinc-*` in plots | **Protected** — chart/plot regions |
| `@tailwindcss/typography` + `prose` for changelog only | **Aligned** |

---

## 1. Font Family Stack

### Phase 38 contract (`DESIGN.md` §5)

- Sans: Tailwind default system stack (`ui-sans-serif`, `system-ui`, Segoe UI, etc.).
- Mono: Tailwind/system monospace (`ui-monospace`, Menlo, Consolas, etc.).
- **Do not** download or bundle custom UI fonts (explicitly rejects SF Pro Rounded and brand fonts).

### Current implementation

| Layer | What runs today | Status |
|-------|-----------------|--------|
| `client/src/app/layout.tsx` | Loads `GeistSans` and `GeistMono` from `geist/font`; applies CSS variables to `<body>` | **Drift** |
| `client/src/app/globals.css` `@theme inline` | `--font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, …` | **Drift** — Geist is first in stack |
| `client/src/app/globals.css` `@theme inline` | `--font-mono: var(--font-geist-mono), ui-monospace, …` | **Drift** |
| `body` base layer | `antialiased` + `font-feature-settings: "rlig" 1, "calt" 1` | **Acceptable** — standard rendering polish |
| SVG plot axes (`SVGAxes.tsx`) | Inline `fontFamily="system-ui, -apple-system, sans-serif"` | **Aligned** in plots; inconsistent with app chrome |

**UI38-01 action:** Remove Geist imports from `layout.tsx`; set `--font-sans` / `--font-mono` to the system stacks in `globals.css` per `DESIGN.md`.

---

## 2. Global Type Scale and Custom Utilities

### Tailwind default scale usage (aggregate, `*.tsx`)

| Class | Occurrences | DESIGN.md role | Assessment |
|-------|------------:|----------------|------------|
| `text-xs` | 156 | UI label, muted, table dense text | **Aligned** — primary density tier |
| `text-sm` | 90 | Body, table, form copy | **Aligned** |
| `text-base` | 4 | Body / section titles | Underused for body; used for dialog headers |
| `text-lg` | 9 | Section title (contract: 20–24px) | Used for dialog/error titles only |
| `text-xl` | 0 | Section title | **Not used** |
| `text-2xl` – `text-3xl` | 0 | Page title (contract: 30–36px) | **Not used** |

### Arbitrary pixel sizes (bypass Tailwind scale)

| Class | Occurrences | Typical use |
|-------|------------:|-------------|
| `text-[11px]` | 11 | Table headers, schedule editor, comparison plot inputs |
| `text-[10px]` | 13 | Plot overlays, damage badges, dense side-panel controls |
| `text-[9px]` | 3 | Damage plot warning chips (**protected**) |

**Assessment:** **Drift.** These create a shadow type scale smaller than `text-xs` (12px). Several map closely to the custom utilities below.

### App-specific utilities (`globals.css`)

```css
--font-size-caption: 0.625rem;  /* 10px */
--font-size-label:   0.6875rem; /* 11px */
.text-caption { font-size: var(--font-size-caption); line-height: 1rem; }
.text-label   { font-size: var(--font-size-label);   line-height: 1rem; }
```

| Utility | Used in | Assessment |
|---------|---------|------------|
| `.text-caption` | `PlotCardShell`, `PlotTooltip`, `color-picker` | **Drift** — overlaps `text-[10px]` |
| `.text-label` | `DatabaseOperationModal`, `PlotGrid` | **Drift** — overlaps `text-[11px]` |

**UI38-02 action:** Collapse caption/label/micro-arbitrary sizes into one documented dense tier (likely `text-xs` with optional `leading-none`) or formalize two token-backed utilities referenced from `DESIGN.md`.

---

## 3. Font Weight Usage

| Class | Occurrences | DESIGN.md guidance | Assessment |
|-------|------------:|--------------------|------------|
| `font-medium` | 93 | UI labels, active items | **Aligned** — primary emphasis |
| `font-semibold` | 19 | Headers, active labels (sparingly) | **Aligned** — restrained use |
| `font-normal` | 2 | Body default | Rarely explicit; inherits from body |
| `font-bold` | 0 | Avoid heavy display type | **Aligned** |
| `font-mono` | 7 | IDs, channels, snippets | **Drift** — underused |

### `font-mono` call sites

| Location | Content |
|----------|---------|
| `VersionLabel` | Build/version string |
| `DatabaseOperationModal` | Current table name during import |
| `DatabaseSwitchDialog` | Delete confirmation phrase |
| `UserManagementSettingsPanel` | User IDs |
| `PlotTooltip` | Numeric values (**protected**) |

**Gap vs contract:** Channel names, program IDs, work orders, and table cell IDs in `database/page.tsx`, `DamageTableView`, and event trees largely use proportional sans at `text-xs` without `font-mono`. DESIGN.md expects mono for technical identifiers.

---

## 4. Line Height and Tracking

### Line height

| Class | Occurrences | Typical context |
|-------|------------:|-----------------|
| `leading-none` | 17 | Table headers, dense grid cells, plot labels |
| `leading-relaxed` | 4 | Banner/helper copy |
| `leading-snug` | 1 | Overlay control labels |
| (default / inherited) | majority | Body, forms, dialogs |

**Assessment:** Dense tables favor `leading-none`. Acceptable for engineering UI; ensure readable minimums in multi-line cells.

### Tracking

| Class | Occurrences | Context |
|-------|------------:|---------|
| `tracking-tight` | 3 | `SiteHeader` h1, `SidePanelSection` h3, `Dialog` title |
| `tracking-wide` | 1 | `DatabaseOperationModal` uppercase phase label |
| `tracking-[0.06em]` | 2 | `ComparisonPlotInputsSection` uppercase micro-headers |
| `uppercase` | 3 | Comparison plot section labels, phase times label |

**Assessment:** `tracking-tight` usage matches contract (page/section headings only). Uppercase micro-labels in comparison plot inputs are **acceptable drift** for dense controls but should not spread to general UI.

---

## 5. Semantic Roles vs Actual Patterns

Mapping DESIGN.md roles to what the app actually renders.

| Role | Contract (DESIGN.md) | Actual pattern | Status |
|------|----------------------|----------------|--------|
| Page title | `text-3xl font-semibold tracking-tight` | `SiteHeader` h1: `text-sm font-medium tracking-tight` | **Acceptable drift** — compact header bar, not marketing hero |
| Section title | `text-xl font-semibold tracking-tight` | `SidePanelSection` h3: `text-base font-semibold tracking-tight` | **Acceptable drift** — one step smaller |
| Card title | `text-base font-semibold` | `CardTitle`: `font-semibold leading-none` (inherits size) | **Mostly aligned** |
| Body | `text-sm` / `text-base` | Dominated by `text-sm` | **Aligned** |
| UI label | `text-xs font-medium` / `text-sm font-medium` | `Label`: `text-sm font-medium`; many `text-xs font-medium` in tables | **Aligned** |
| Muted text | `text-muted-foreground` | Widely used (~60+ files) | **Aligned** |
| Table text | `text-sm`, dense | Custom flex tables: `text-xs`, `text-[11px]`, `leading-none`, `tabular-nums` | **Acceptable drift** for density |
| Code / IDs | `font-mono text-xs` | Sparse `font-mono`; mostly sans IDs | **Drift** |

### Heading element inventory

| Element | Location | Classes |
|---------|----------|---------|
| `<h1>` | `SiteHeader` | `text-sm font-medium text-foreground/90 tracking-tight` |
| `<h2>` | `DialogPageHeader`, login error, dialog titles | `text-base font-medium` or `text-lg font-semibold` |
| `<h3>` | `SidePanelSection`, empty states, database page, comparison plot inputs | `text-base font-semibold tracking-tight` or `text-sm font-medium` or `text-[11px] uppercase` |
| `CardTitle` | Login, cards | `font-semibold leading-none` (no explicit size) |

**Notable gap:** No route uses `text-3xl` or `text-xl`. The app treats the sticky header as the page title surface at `text-sm`. This is consistent with a dense tool but differs from the reference type scale table.

---

## 6. shadcn Primitive Defaults

Typography baked into shared primitives (downstream of all consumers).

| Primitive | Default typography | Notes |
|-----------|-------------------|-------|
| `Button` | `text-sm font-medium`; size `xs` → `text-xs` | **Aligned** |
| `Input` | `text-base md:text-sm` | Mobile-first; md+ matches contract |
| `Label` | `text-sm font-medium leading-none` | **Aligned** |
| `Table` | `text-sm`; head `font-medium` | Only used in user management |
| `CardTitle` | `font-semibold leading-none` | No explicit size — inherits |
| `CardDescription` | `text-sm text-muted-foreground` | **Aligned** |
| `DialogTitle` | `text-lg font-semibold leading-none tracking-tight` | Slightly larger than compact app headers |
| `AlertDialogTitle` | `text-lg font-semibold` | Custom non-Radix implementation |
| `Badge` | `text-xs font-medium` | **Aligned** |
| `TabsTrigger` | `text-sm font-medium` | **Aligned** |
| `Sidebar` menu buttons | `text-sm` | **Aligned** |

---

## 7. Area-by-Area Typography Notes

### App shell

| Surface | Typography | Status |
|---------|------------|--------|
| `SiteHeader` | `text-sm font-medium tracking-tight` page title | Compact; **acceptable** |
| `VersionLabel` | `text-xs font-mono` on muted pill | **Aligned** for build metadata |
| `AppSidebar` / `NavMain` | shadcn sidebar `text-sm` + tooltips `text-xs` | **Aligned** |

### Settings and workflow dialogs

| Surface | Typography | Status |
|---------|------------|--------|
| `SettingsDialog` nav | `text-sm font-normal`; raw `<button>` | **Drift** — should use shadcn `Button` + token classes |
| `MetadataEditDialog` nav | Same pattern as settings | **Drift** |
| `DialogPageHeader` | `text-base font-medium` | Reasonable dialog title tier |
| Operation modals | `text-lg` titles; body `text-sm`/`text-xs`; `text-label uppercase` phase header | Mixed; normalize in UI38-05 |

### Data surfaces (database, inspect damage)

| Surface | Typography | Status |
|---------|------------|--------|
| `database/page.tsx` table header | `text-xs font-semibold text-foreground/70` | Dense; prefer `text-muted-foreground` over opacity |
| `DamageTableView` | Same header pattern + `text-[10px]` status badges | **Acceptable** density; badge sizes drift |
| `CsvPreviewTable` | `text-[11px]` headers, `text-xs` cells, `tabular-nums` | **Drift** on arbitrary 11px |
| `DurabilityScheduleTable` | `text-[11px]` headers, `text-xs tabular-nums` cells | **Drift** on arbitrary 11px |
| `FilterableColumnHeader` | `text-xs` + dropdown | **Aligned** |

### Side panels and filters

| Surface | Typography | Status |
|---------|------------|--------|
| `SidePanelSection` | `text-base font-semibold tracking-tight` title; `text-xs` subtitle | **Aligned** section pattern |
| `GlobalFilters` | `text-xs` / `text-sm` accordion copy | **Aligned** |
| `ComparisonPlotInputsSection` | `text-[10px]`–`text-[11px]`, uppercase micro-headers | Dense plot controls; **protected-adjacent** |
| `EmptyState` | `text-sm font-medium` title; `text-xs text-muted-foreground` | **Aligned** |

### Upload flows

| Surface | Typography | Status |
|---------|------------|--------|
| `FileDropZone` | `text-sm font-medium` primary; `text-xs text-muted-foreground` hint | **Aligned** |
| `UploadDataSection` | Heavy `text-xs` metadata lines | **Aligned** for dense upload UI |
| `DatabaseOperationModal` | `text-label uppercase tracking-wide`; `text-xs font-mono` status | Mixed custom utilities |

### Auth

| Surface | Typography | Status |
|---------|------------|--------|
| `login/page.tsx` | shadcn `CardTitle`, `CardDescription`, `Label`, `text-sm`/`text-xs` errors and hints | **Best-aligned surface** in the app |
| `login/error.tsx` | `text-lg font-semibold` | Matches dialog/error title tier |

### Markdown / long-form

| Surface | Typography | Status |
|---------|------------|--------|
| `ChangelogContent` | `prose prose-neutral max-w-none` via `@tailwindcss/typography` | **Aligned** — isolated long-form island |
| `ChangelogSettingsPanel` | `text-sm text-muted-foreground` loading state | **Aligned** |

### Charts and plots (**protected**)

| Surface | Typography | Status |
|---------|------------|--------|
| `plot-card-styles.ts` | `PLOT_LEGEND_OVERLAY_ITEM_CLASS`: `text-xs text-gray-700` | **Protected** — hardcoded gray, not tokens |
| `PlotTooltip` | `text-sm`, `text-xs`, `text-caption`, zinc palette | **Protected** |
| `PlotCardShell` | `text-caption`, `text-[11px]`, `text-[10px] text-black/70` | **Protected** |
| `SVGAxes` | SVG `fontSize` 8px (grid) / 16px (interactive); system-ui family | **Protected** |
| `DamagePlotAxes` | `text-[10px] font-medium text-gray-500` | **Protected** |
| Damage plot warning chips | `text-[9px] text-amber-800` | **Protected** |

Do not normalize plot typography during UI38 unless explicitly authorized. UI chrome around plots should use semantic tokens.

---

## 8. Secondary Typography Features

| Feature | Usage | Assessment |
|---------|-------|------------|
| `tabular-nums` | 21 uses (tables, numeric columns) | **Aligned** for data columns |
| `text-muted-foreground` | ~60 files | **Aligned** — primary secondary text token |
| `text-foreground/70`, `/80`, `/90` | Table headers, tree labels | **Drift** — prefer `text-muted-foreground` |
| `text-destructive` | Form errors, delete affordances | **Aligned** |
| `text-primary` | Links in prose changelog | **Aligned** |
| Hardcoded `text-gray-*`, `text-zinc-*`, `text-black/70` | Plot tooltips, legends, axes | **Protected** in viz; **drift** if copied to UI chrome |
| `antialiased` | `body`, root layout | **Aligned** |
| `font-feature-settings: "rlig", "calt"` | `body` in `globals.css` | **Aligned** — subtle ligatures |

---

## 9. Drift Summary vs Phase 38 Contract

### Must fix (UI38-01 / UI38-02)

1. **Remove Geist font loading** — revert to system UI stacks in `layout.tsx` and `globals.css`.
2. **Consolidate micro type scale** — eliminate parallel `text-[9px]`/`[10px]`/`[11px]`, `.text-caption`, and `.text-label` OR document them as official dense tiers in `DESIGN.md`.
3. **Replace `text-foreground/N` opacity text** with `text-muted-foreground` where semantics match.

### Should improve (UI38-04 / UI38-05)

4. **Apply `font-mono text-xs`** to program IDs, work orders, channel names, and confirmation tokens in tables and trees.
5. **Normalize dialog/nav typography** — settings and metadata dialogs should use shadcn `Button` and consistent `text-sm` nav labels.
6. **Unify section header pattern** — pick one of `text-base font-semibold tracking-tight` (side panels) vs `text-sm font-medium` (dashboard card toolbar) and document exceptions.

### Acceptable as-is (document, do not churn)

7. **Compact page titles** at `text-sm` in `SiteHeader` instead of `text-3xl`.
8. **Dense table `text-xs` + `leading-none` + `tabular-nums`** on custom flex tables.
9. **Plot/chart micro typography** — protected; token changes only if required for compile/contrast.

### Explicitly out of scope

10. Restyling SVG/canvas font sizes inside plot cards.
11. Changing damage plot warning chip sizes/colors.

---

## 10. Recommended Guardrail Searches

Run during UI38 implementation (extend `DESIGN.md` §17).

### Typography enforcement boundary (explicit exemption)

Do not normalize micro typography in these paths unless a dedicated issue authorizes it:

- `client/src/components/charts/**`
- `client/src/features/inspect-damage-3d/components/*PlotCard*.tsx`
- `client/src/features/inspect-damage-3d/components/DamagePlotAxes.tsx`
- `client/src/features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx`
- `client/src/features/inspect-damage-3d/components/DamagePlotColorLegend.tsx`

### Guardrail scans (non-exempt paths)

```bash
# Keep Geist-first wiring explicit and centralized
rg "GeistSans|GeistMono|--font-geist|--font-sans|--font-mono" client/src/app

# Block arbitrary px text sizes in non-exempt UI
rg "text-\\[[0-9]+px\\]" client/src --glob "*.tsx" \
  --glob "!client/src/components/charts/**" \
  --glob "!client/src/features/inspect-damage-3d/components/*PlotCard*.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotAxes.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotColorLegend.tsx"

# Block legacy custom typography utilities in non-exempt UI
rg "text-caption|text-label" client/src --glob "*.tsx" \
  --glob "!client/src/components/charts/**" \
  --glob "!client/src/features/inspect-damage-3d/components/*PlotCard*.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotAxes.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx" \
  --glob "!client/src/features/inspect-damage-3d/components/DamagePlotColorLegend.tsx"

# Hardcoded gray/zinc text in non-chart UI
rg "text-gray-|text-zinc-|text-black/" client/src --glob "*.tsx" \
  --glob "!client/src/components/charts/**" \
  --glob "!client/src/features/inspect-damage-3d/components/**"

# Opacity-based foreground instead of muted token
rg "text-foreground/" client/src --glob "*.tsx"

# Missing mono on likely technical strings (manual review)
rg "programId|work_order|job_number|channel" client/src --glob "*.tsx"

# Settings + metadata + database consistency scope
rg "text-foreground/" client/src/components/settings client/src/components/edit-metadata client/src/app/database --glob "*.tsx"
rg "\\[var\\(--" client/src/components/settings client/src/components/edit-metadata client/src/components/shared/dialog-layout --glob "*.tsx"
rg "text-\\[[0-9]+px\\]|text-caption|text-label" client/src/components/settings client/src/components/edit-metadata client/src/app/database --glob "*.tsx"
```

---

## 11. Phase 38 Issue Mapping

| Issue | Typography work |
|-------|-----------------|
| **UI38-01** | Remove Geist; set system font stacks; reconcile root/`globals.css` comments ("Apple-like" → shadcn/zinc) |
| **UI38-02** | Consolidate `.text-caption`/`.text-label`; align `EmptyState`/`LoadingSpinner` copy sizes; primitive defaults |
| **UI38-03** | `SiteHeader` title tier; sidebar label consistency |
| **UI38-04** | Table header tokens; `font-mono` on IDs; replace `text-foreground/70` headers |
| **UI38-05** | Dialog titles, nav labels, operation modal phase typography |
| **UI38-06** | Add typography guardrail greps to CI/docs |

---

## 12. Related References

- `DESIGN.md` §5 — canonical type scale and rules
- `CLIENT_COMPONENT_AUDIT.md` — component classification and modal/table drift
- `../IMPLEMENTATION_MAP.md` — invariants and protected surfaces
- `../issues/UI38-01-design-contract-and-theme-baseline.md` — first typography fix slice
