# Handoff — Frontend Codebase UI/UX Audit (FR-26)

Use this document when planning the large UI/UX refactor and authoring `DESIGN.md`. This is an **audit only** — no code changes were made.

**Related artifacts**

| Artifact | Path | Role |
|----------|------|------|
| Audit prompt | `.prompts/review-frontend-codebase.md` | Scope and deliverable checklist |
| Canonical Workbench spec (draft) | `.cursor/skills/design-guidelines/DESIGN.md` | Token values, semantic roles, patterns — promote to repo `DESIGN.md` |
| Audit checklist | `.cursor/skills/design-guidelines/AUDIT.md` | 13-category drift checklist with ripgrep recipes |
| Refactor playbook | `.cursor/skills/design-guidelines/REFACTOR.md` | Ordered fix recipes (Phase 5 of design-guidelines skill) |
| Portable theme snippet | `.cursor/skills/design-guidelines/theme.css` | Copy/merge reference for token normalization |
| Live token source | `client/src/app/globals.css` | Runtime CSS variables + Tailwind v4 `@theme inline` |
| shadcn config | `client/components.json` | new-york style, CSS variables, lucide icons |

---

## 1. Executive Summary

### Current UI architecture

The frontend is a **Next.js App Router** app (`client/`) using **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme inline` in `globals.css`), **shadcn/ui new-york** primitives in `components/ui/`, **Radix** under the hood, **Geist Sans/Mono** via `geist/font`, and **lucide-react** icons. There is **no `tailwind.config.js`** (correct for v4).

The visual language is already intentionally **Apple-inspired / monochromatic engineering workbench**: warm neutrals (`#1d1d1f` foreground, `#f5f5f7` secondary, `#e8e8ed` borders), medium radius (`--radius: 0.5rem`), subtle elevation utilities (`shadow-subtle`, `shadow-elevated`), and a **fixed 64px icon-only sidebar**.

**Layering model (as implemented today)**

```
app/layout.tsx          → fonts, globals.css, Providers
app/providers.tsx       → QueryClient, ClientLayout, SettingsDialog, Toaster
components/layout/      → AppSidebar, SiteHeader, ClientLayout (app shell)
app/*/page.tsx          → route views (several are 1000+ LOC mega-pages)
components/ui/          → shadcn primitives (28 files)
components/shared/      → cross-route layout primitives (SidePanel*, EmptyState, FileDropZone)
components/blocks/      → shadcn-style composed dialog panels (progress steppers)
components/{domain}/    → dashboard, upload, edit-metadata, settings, charts, damage
features/               → operation modals + inspect-damage-3d (feature-sliced modals)
```

**Strengths**

- Token foundation in `globals.css` matches the Workbench DESIGN.md draft almost exactly.
- shadcn primitives are installed and used consistently for buttons, inputs, dialogs, tables.
- App shell (sidebar + header + scrollable main) is clean and matches the intended Workbench layout.
- Shared side-panel chrome (`SidePanelLayout`, `SidePanelSection`) exists and is reused across routes.
- Operation-modal progress UX is converging on a shared visual pattern (`components/blocks/dialog/*`).

**Primary problems (design-system debt)**

1. **Mega-pages own too much UI** — `database/page.tsx` (~1045 LOC) and `inspect-damage/page.tsx` (~1157 LOC) embed hierarchical table markup, empty states, toolbar patterns, and layout math inline. Hard to normalize visually or extend safely.
2. **Parallel implementations of the same visual pattern** — three event-tree components, four operation modals, duplicated page shell layout across Dashboard / Database / Inspect Damage.
3. **Semantic token gaps for domain states** — status pills, warning banners, and stale-damage affordances use raw Tailwind `amber-*` / `green-*` / `red-*` instead of named semantic roles.
4. **Typography micro-scale drift** — `text-[10px]`, `text-[11px]` appear alongside `.text-caption` / `.text-label` utilities; no single enforcement path.
5. **Dialog shell duplication** — `SettingsDialog` and `MetadataEditDialog` both hand-roll Radix Dialog chrome with nearly identical nav-aside layout but different dimensions and CSS variable syntax.
6. **Side panel width inconsistency** — `320px`, `340px`, `400px`, `520px` used without a named token.
7. **Dark mode is half-wired** — components include `dark:` variants but `:root` has no `.dark` token block; dark theme is not a first-class product surface today.
8. **No repo-root `DESIGN.md`** — canonical spec lives in a Cursor skill folder; agents may miss it.

**Risk posture**

| Risk | Area | Notes |
|------|------|-------|
| **HIGH** | Hierarchical database table refactor | Touches selection, resize, sort, filter, batch actions across Database + Inspect Damage |
| **HIGH** | MetadataEditDialog shell extraction | Many sections, z-index stacking, discard prompts, derived-data modals |
| **MEDIUM** | Operation modal consolidation | Upload, scope delete, derived data share shell but different state machines |
| **MEDIUM** | Event tree unification | Three trees with different data shapes but shared checkbox/collapsible visuals |
| **LOW** | Token normalization (colors → semantic) | Mostly class renames if roles are defined first |
| **LOW** | Typography utility adoption | Replace `text-[11px]` → `text-label` etc. |

---

## 2. Stack Confirmation

| Check | Status | Evidence |
|-------|--------|----------|
| Next.js App Router | ✅ | `client/src/app/` |
| Tailwind v4 `@theme inline` | ✅ | `client/src/app/globals.css` |
| No tailwind.config.js | ✅ | `client/components.json` has `"config": ""` |
| shadcn/ui | ✅ | `client/src/components/ui/` (28 primitives) |
| Radix | ✅ | ui components + direct `@radix-ui/react-dialog` in settings/metadata dialogs |
| Geist fonts | ✅ | `client/src/app/layout.tsx` |
| lucide-react | ✅ | ~50 component files |
| CSS modules | ❌ none | All styling via Tailwind + inline styles for table column widths |
| Third-party toast | ✅ sonner | `app/providers.tsx` |

---

## 3. Route / Page Inventory

| Route | Page file | Layout | UI role | Notes |
|-------|-----------|--------|---------|-------|
| `/` | `app/page.tsx` | ClientLayout | Redirect/landing | Minimal |
| `/login` | `app/login/page.tsx` | **No shell** | Auth card + tabs | Canonical shadcn Card/Tabs form |
| `/dashboard` | `app/dashboard/page.tsx` | ClientLayout | Plot grid workspace | Side panel + PlotGrid; shares shell pattern |
| `/database` | `app/database/page.tsx` | `database/layout.tsx` | **Primary hierarchical table** | Mega-page; reference table UX |
| `/database/edit` | `app/database/edit/page.tsx` | same | Metadata edit route | Opens/triggers MetadataEditDialog flow |
| `/database/filter-values` | `app/database/filter-values/page.tsx` | same | Filter value admin | Smaller admin surface |
| `/inspect-damage` | `app/inspect-damage/page.tsx` | ClientLayout | Damage table + 3D entry | Mega-page; duplicates database table patterns |
| `/changelog` | `app/changelog/page.tsx` | ClientLayout | Changelog reader | Also embedded in Settings |
| `/settings/users` | `app/settings/users/page.tsx` | ClientLayout | Legacy/admin route | SettingsDialog is primary UX |

**Route-level loading/error** (duplicated pattern — candidate for shared `PageState` component):

- `app/dashboard/loading.tsx`, `error.tsx`
- `app/database/loading.tsx`, `error.tsx`
- `app/database/edit/loading.tsx`, `error.tsx`
- `app/login/loading.tsx`, `error.tsx`

All use `min-h-[400px]` centered spinner/message — not using `EmptyState` / `LoadingSpinner` consistently.

---

## 4. Component Inventory

Legend:

- **Origin**: `shadcn` | `shadcn-block` | `third-party` | `custom`
- **Action**: `keep` | `wrap` | `merge` | `move` | `rename` | `delete`
- **Styling**: Tailwind (+ CVA for ui primitives), occasional inline `style={}` for resizable tables

### 4.1 shadcn/ui primitives (`components/ui/`)

| Component | Path | Variants / props | Action | Notes |
|-----------|------|------------------|--------|-------|
| Accordion | `ui/accordion.tsx` | Radix accordion | keep | |
| AlertDialog | `ui/alert-dialog.tsx` | default | keep | Used as operation modal shell |
| Avatar | `ui/avatar.tsx` | default | keep | |
| Badge | `ui/badge.tsx` | default, secondary, destructive, outline | keep | Domain status pills bypass this |
| Button | `ui/button.tsx` | variant: default, destructive, outline, secondary, ghost, link; size: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg | keep | Well-extended; canonical |
| ButtonGroup | `ui/button-group.tsx` | — | keep | |
| Card | `ui/card.tsx` | Card, Header, Title, Description, Content, Footer | keep | Login page canonical usage |
| Checkbox | `ui/checkbox.tsx` | Radix | keep | Event trees override with custom CheckboxPrimitive styling |
| Collapsible | `ui/collapsible.tsx` | Radix | keep | Heavy use in trees |
| Dialog | `ui/dialog.tsx` | shadcn dialog | keep | **Bypassed** by Settings/Metadata (raw Radix) |
| DropdownMenu | `ui/dropdown-menu.tsx` | — | keep | |
| Input | `ui/input.tsx` | — | keep | |
| Label | `ui/label.tsx` | — | keep | |
| Pagination | `ui/pagination.tsx` | — | keep | |
| Popover | `ui/popover.tsx` | — | keep | |
| Progress | `ui/progress.tsx` | determinate + indeterminate | keep | Used in progress panels |
| RadioGroup | `ui/radio-group.tsx` | — | keep | |
| ScrollArea | `ui/scroll-area.tsx` | — | keep | |
| Select | `ui/select.tsx` | — | keep | |
| Separator | `ui/separator.tsx` | — | keep | |
| Sheet | `ui/sheet.tsx` | — | keep | Unused in primary flows? verify before delete |
| Sidebar | `ui/sidebar.tsx` | full sidebar primitive set | keep | Powers AppSidebar |
| Skeleton | `ui/skeleton.tsx` | — | keep | Underused vs custom loading divs |
| Switch | `ui/switch.tsx` | — | keep | |
| Table | `ui/table.tsx` | — | keep | **Not used** for main hierarchical table (custom div grid) |
| Tabs | `ui/tabs.tsx` | — | keep | Login, DashboardTabs |
| Tooltip | `ui/tooltip.tsx` | — | keep | Sidebar nav tooltips |
| ColorPicker | `ui/shadcn-io/color-picker.tsx` | third-party block | wrap | Used in HierarchicalEventTree; inline `backgroundColor` styles |

### 4.2 shadcn-style blocks (`components/blocks/`)

| Component | Path | Category | Used by | Action | Duplication |
|-----------|------|----------|---------|--------|-------------|
| UploadProgressPanel | `blocks/dialog/upload-progress-panel.tsx` | upload/progress | UploadOperationModal | keep → extract PhaseStep | Stepper duplicated 4× |
| DerivedDataProgressPanel | `blocks/dialog/derived-data-progress-panel.tsx` | upload/progress | DerivedDataOperationModal | merge | Same stepper markup |
| ScopeDeleteProgressPanel | `blocks/dialog/scope-delete-progress-panel.tsx` | upload/progress | ScopeDeleteOperationModal | merge | Same stepper markup |
| ScopeDeleteConfirmPanel | `blocks/dialog/scope-delete-confirm-panel.tsx` | dialog content | ScopeDeleteOperationModal | keep | |
| ScopeDeleteSummaryPanel | `blocks/dialog/scope-delete-summary-panel.tsx` | dialog content | Upload/ScopeDelete modals | keep | |

**Recommendation:** Extract `PhaseStep` + `PhaseStepper` to `components/shared/phase-stepper.tsx`; panels become data-driven.

### 4.3 Layout / app shell (`components/layout/`)

| Component | Path | Category | Used by | Styling | Action |
|-----------|------|----------|---------|---------|--------|
| ClientLayout | `layout/ClientLayout.tsx` | layout | providers.tsx | Tailwind | keep |
| AppSidebar | `layout/AppSidebar.tsx` | navigation | ClientLayout | Tailwind + ui/sidebar | keep |
| NavMain | `layout/NavMain.tsx` | navigation | AppSidebar | Tailwind | keep |
| LogoHeader | `layout/LogoHeader.tsx` | navigation | AppSidebar | Tailwind | keep |
| SiteHeader | `layout/SiteHeader.tsx` | header | ClientLayout | Tailwind | keep — extract `HeaderActions` hand-rolled buttons → Button ghost |
| VersionLabel | `layout/VersionLabel.tsx` | header | SiteHeader | Tailwind | keep |

### 4.4 Shared reusable (`components/shared/`)

| Component | Path | Category | Used by | Props | Action |
|-----------|------|----------|---------|-------|--------|
| SidePanelLayout | `shared/SidePanelLayout.tsx` | layout | Dashboard, Database, Upload, Edit Metadata, Inspect Damage | `expandedWidth` (default `w-[400px]`) | **wrap** — normalize widths to tokens |
| SidePanelSection | `shared/SidePanelSection.tsx` | layout | Many side panels | title, subtitle, collapsible | keep — canonical section header |
| EmptyState | `shared/EmptyState.tsx` | empty state | Some routes | icon, title, description, action | **extend** — adopt in route loading/error/table empties |
| LoadingSpinner | `shared/LoadingSpinner.tsx` | loading | sparse | — | **extend** — replace route loading.tsx duplicates |
| ErrorBoundary | `shared/ErrorBoundary.tsx` | error state | tree wrapper | — | keep |
| FileDropZone | `shared/FileDropZone.tsx` | upload | Upload flows | drag/drop | keep |

### 4.5 Data-display / tables / trees

| Component | Path | Category | Origin | Used by | Action | Inconsistency |
|-----------|------|----------|--------|---------|--------|---------------|
| Database page table | `app/database/page.tsx` (inline) | table/grid | custom | /database | **move** → `components/database/DatabaseTable.tsx` | Reference implementation per database-table skill |
| Inspect Damage table | `app/inspect-damage/page.tsx` (inline) | table/grid | custom | /inspect-damage | **merge** with DatabaseTable variant | ~70% structural overlap |
| DatabaseEventTree | `upload/DatabaseEventTree.tsx` | table/tree | custom | database page side/tree | keep | Custom checkbox `rounded-[3px] size-3.5` |
| HierarchicalEventTree | `dashboard/shared/HierarchicalEventTree.tsx` | data-display | custom | Dashboard side panel | keep | Different data model; shares checkbox styling |
| DamageEventTree | `damage/DamageEventTree.tsx` | table/tree | custom | inspect-damage page | merge visuals | Read-only tree variant |
| CsvPreviewTable | `upload/CsvPreviewTable.tsx` | table | custom | Upload | keep | Flex-column preview table |
| DurabilityScheduleTable | `edit-metadata/DurabilityScheduleTable.tsx` | table | custom | Metadata dialog | keep | Inline flex + `text-[11px]` headers |
| AssignChannelsPanel table | `edit-metadata/AssignChannelsPanel.tsx` | table | custom | Metadata dialog | keep | Grid cols constant |

### 4.6 Dialogs, modals, sheets

| Component | Path | Category | Origin | Action | Notes |
|-----------|------|----------|--------|--------|-------|
| SettingsDialog | `settings/SettingsDialog.tsx` | dialog | custom (raw Radix) | **wrap** → `WorkbenchDialogShell` | 980×720, nav aside 180px |
| MetadataEditDialog | `edit-metadata/MetadataEditDialog.tsx` | dialog | custom (raw Radix) | **wrap** → same shell | 1470×720, wider |
| UploadOperationModal | `features/database-upload/UploadOperationModal.tsx` | modal | custom | merge | AlertDialog + progress panel |
| ScopeDeleteOperationModal | `features/database-scope-delete/ScopeDeleteOperationModal.tsx` | modal | custom | merge | Same shell |
| DerivedDataOperationModal | `features/edit-metadata/DerivedDataOperationModal.tsx` | modal | custom | merge | Adds `z-[70]` layer |
| DatabaseOperationModal | `upload/DatabaseOperationModal.tsx` | modal | custom | merge | Largest (990 LOC) — split state from chrome |
| DatabaseSwitchDialog | `upload/DatabaseSwitchDialog.tsx` | dialog | shadcn Dialog | keep | |
| ChannelMapUploadDialog | `edit-metadata/ChannelMapUploadDialog.tsx` | dialog | shadcn Dialog | keep | |
| ScheduleUploadDialog | `edit-metadata/ScheduleUploadDialog.tsx` | dialog | shadcn Dialog | keep | |

**Shell constants:** `client/src/lib/shell-operation-modal.ts` — `SHELL_OPERATION_MODAL_LAYER_CLASS = 'z-[70]'`.

### 4.7 Upload / progress / status

| Component | Path | Category | Action |
|-----------|------|----------|--------|
| UploadContent | `upload/UploadContent.tsx` | upload | keep |
| UploadDataSection | `upload/UploadDataSection.tsx` | upload | keep |
| UploadSidePanel | `upload/UploadSidePanel.tsx` | upload | keep |
| DatabaseSidePanel | `upload/DatabaseSidePanel.tsx` | upload | keep |
| DatabaseSection | `upload/DatabaseSection.tsx` | upload | keep |
| ColumnResizeHandle | `upload/ColumnResizeHandle.tsx` | table | move → shared |
| ChannelReprocessBanner | `edit-metadata/ChannelReprocessBanner.tsx` | status | wrap — canonical `TaskStatusBanner` |
| DamageCalculationBanner | `edit-metadata/DamageCalculationBanner.tsx` | status | merge |
| DamageValidationReportSummary | `edit-metadata/DamageValidationReportSummary.tsx` | status | keep |
| getStatusBadgeClassName | `lib/status-badge.ts` | badge | **replace** with semantic tokens |

### 4.8 Dashboard / charts / 3D

| Component | Path | Category | Action |
|-----------|------|----------|--------|
| DashboardContent | `dashboard/DashboardContent.tsx` | page content | keep |
| DashboardTabs | `dashboard/DashboardTabs.tsx` | navigation | keep |
| PlotGrid | `dashboard/plot-grid/PlotGrid.tsx` | visualization | keep |
| SidePanel | `dashboard/side-panel/SidePanel.tsx` | layout | keep |
| GlobalFilters | `dashboard/side-panel/GlobalFilters.tsx` | form/filters | keep |
| LoadDataSection | `dashboard/side-panel/LoadDataSection.tsx` | form | keep |
| InteractiveViewer | `dashboard/interactive-viewer/InteractiveViewer.tsx` | visualization | keep — replace `bg-gray-100/80` |
| PinnedEventsOverlay | `dashboard/interactive-viewer/PinnedEventsOverlay.tsx` | overlay | keep |
| CurveSelector | `dashboard/interactive-viewer/CurveSelector.tsx` | form | keep |
| GridActionToolbar | `dashboard/shared/GridActionToolbar.tsx` | toolbar | keep — canonical toolbar |
| SVGPlot, SVGPlotCard, SVGAxes | `charts/*` | charts | keep |
| InteractiveCanvasPlot | `charts/InteractiveCanvasPlot.tsx` | charts | keep |
| PlotTooltip | `charts/PlotTooltip.tsx` | charts | keep |
| DamagePlotCanvas | `features/inspect-damage-3d/components/*` | 3D | keep — `#ffffff` inline bg |

### 4.9 Edit metadata panel suite (`components/edit-metadata/`)

| Component | Role | Action |
|-----------|------|--------|
| EditMetadataPanel | Main form surface | keep |
| EditMetadataSidePanel | Route side panel wrapper | keep |
| MetadataDialogHeader | Dialog header + status badge | keep |
| AssignChannelsPanel | Channel map table | keep |
| DurabilitySchedulePanel | Schedule editor host | keep |
| SelectDatasetSection | Dataset picker | keep |
| UploadScheduleSection | Schedule upload | keep |

---

## 5. Duplicated / Inconsistent Components

| Pattern | Instances | Severity | Recommendation |
|---------|-----------|----------|----------------|
| **Page workspace shell** (`p-4`, `min-h-[calc(100vh-3.5rem)]`, `h-[calc(100vh-7rem)]`, side panel + main) | `dashboard/page.tsx`, `database/page.tsx`, `inspect-damage/page.tsx` | Warning | Extract `WorkbenchPageShell` |
| **Centered empty/loading 400px** | 6 loading/error files + inline in pages | Warning | `PageLoadingState`, `PageErrorState` using EmptyState/LoadingSpinner |
| **Event tree checkbox styling** | `DatabaseEventTree`, `HierarchicalEventTree`, `FilterOptionRow` | Warning | Shared `TreeCheckbox` primitive |
| **Phase stepper** | 4 progress panels | Warning | `PhaseStepper` shared component |
| **Operation modal shell** | Upload, ScopeDelete, DerivedData, DatabaseOperation | Warning | `OperationModal` + slot panels |
| **Nav-aside dialog shell** | SettingsDialog, MetadataEditDialog | Warning | `WorkbenchDialogShell` with size variants |
| **Status badge colors** | `lib/status-badge.ts`, inline amber in inspect-damage | Critical | Semantic `--status-*` tokens + `StatusBadge` component |
| **Warning banner styling** | EditMetadataPanel, PlotGrid, SelectDatasetSection, inspect-damage, scope delete | Warning | `Callout variant="warning"` |
| **Side panel widths** | 320, 340, 400, 520 | Suggestion | `--panel-width-sm/md/lg` |
| **Micro typography** | `text-[10px]`, `text-[11px]` vs `text-caption`, `text-label` | Suggestion | Enforce label/caption utilities |
| **Hand-rolled header buttons** | `SiteHeader.tsx` | Suggestion | Use Button ghost/link variants |
| **Raw Radix Dialog** vs shadcn Dialog | Settings, Metadata | Suggestion | Unify on shadcn Dialog or documented exception |

---

## 6. Design Token Audit

### 6.1 What exists (source of truth)

**File:** `client/src/app/globals.css`

| Token group | Status | Notes |
|-------------|--------|-------|
| Color roles (shadcn) | ✅ Defined in `:root` | Matches DESIGN.md draft |
| Radius scale | ✅ `--radius` + `@theme` sm→4xl | Consistent |
| Font families | ✅ Geist via CSS vars | |
| Caption/label sizes | ✅ `--font-size-caption`, `--font-size-label` + utilities | Underused |
| Elevation | ⚠️ Partial | `shadow-subtle`, `shadow-elevated` utilities only; no `--shadow-*` tokens |
| Z-index | ❌ Not in CSS | Hardcoded `z-50`, `z-[70]` in components |
| Motion | ⚠️ Partial | `transition-smooth`, accordion keyframes, stepper-pulse |
| Dark mode | ❌ | `dark:` classes exist; no `.dark { ... }` token block |
| Domain semantics | ❌ | No `--status-approved`, `--warning`, `--surface-panel` |

### 6.2 Hardcoded / drift findings

| Category | Finding | Files | Expected |
|----------|---------|-------|----------|
| Gray utilities | `bg-gray-100/80` | SVGPlotCard, InteractiveViewer | `bg-muted/80` |
| Amber warning palette | `amber-500`, `amber-600`, etc. | 10+ files | `text-warning`, `bg-warning/10`, `border-warning/40` |
| Status pills | `bg-green-100 text-green-700` etc. | `lib/status-badge.ts` | Semantic status tokens |
| Inline hex | `#ffffff` | DamagePlotCanvas.client.tsx | `bg-background` |
| RGBA inline | `rgba(128,128,128,0.2)` | InteractiveViewer | token or `--plot-unpinned` |
| CSS var syntax in className | `border-[var(--border)]` | SettingsDialog, MetadataEditDialog | Prefer Tailwind `border-border` |
| Arbitrary radius | `rounded-[3px]`, `rounded-[4px]` | trees, checkbox | `rounded-sm` or `--radius-tree-checkbox` |
| Arbitrary z-index | `z-[70]` | shell-operation-modal | `--z-modal-shell` in theme |

### 6.3 Typography audit

| Role | Canonical (DESIGN.md) | Observed drift |
|------|----------------------|----------------|
| Page title | `text-2xl font-semibold tracking-tight` | SiteHeader uses config-driven text-sm labels |
| Section title | `text-base font-semibold tracking-tight` | SidePanelSection ✅ |
| Body | `text-sm` | Default ✅ |
| Subtitle | `text-xs text-muted-foreground` | Common ✅ |
| Label | `text-label` (11px) | Often `text-[11px]` instead |
| Caption | `text-caption` (10px) | Often `text-[10px]` instead |
| Dialog title | `text-base font-medium` | Settings/Metadata headers ✅ |

### 6.4 Spacing & density

- Page padding: consistently `p-4` on workspace routes ✅
- Dialog padding: `px-6 py-4` in progress panels ✅
- Table header height: `h-7`, `h-8` mixed in CsvPreviewTable vs database table
- Button toolbar: `min-w-[5.75rem]` duplicated in database page + GridActionToolbar
- Gap scale: generally Tailwind default (2, 3, 4) — no drift issues

### 6.5 Accessibility states

| State | Status | Gap |
|-------|--------|-----|
| Focus visible | ✅ Global `:focus-visible` ring in globals.css | Some components use `outline-none` with alternate rings — verify per component |
| Disabled | ✅ shadcn defaults | |
| Destructive | ✅ token + button variant | |
| Loading | ⚠️ ad hoc | Loader2 spinners inline; no `Button` loading prop pattern |
| Selected/active nav | ✅ sidebar + dialog nav | Dialog nav uses template strings vs `cn()` |
| Error | ⚠️ | `text-destructive` on forms; route errors are plain text |

---

## 7. Source-of-Truth Gaps

| Domain | Current state | Needed for DESIGN.md |
|--------|---------------|----------------------|
| Color roles | shadcn tokens only | Add semantic: status, warning, success, plot, panel |
| Type scale | DESIGN.md roles + 2 utilities | Document when to use each role; ban arbitrary px |
| Spacing scale | Implicit Tailwind | Document workspace/page/panel/dialog spacing |
| Radius scale | CSS vars | Document tree-checkbox exception |
| Surface hierarchy | Ad hoc | Define: canvas, panel, card, overlay, modal |
| Component variants | shadcn CVA | Document allowed app-level variants (Callout, StatusBadge, Panel) |
| Form patterns | shadcn form primitives | Document label spacing, error text, inline warnings |
| Data-table patterns | database-table skill | Extract to DESIGN.md section referencing sticky header, density |
| Dialog patterns | 3 parallel patterns | Define: alert operation modal vs workbench dialog vs confirm |
| Status/progress patterns | blocks/dialog | Document phase stepper, progress bar heights |
| Page layout patterns | duplicated JSX | Document two-panel workspace diagram |
| Z-index | magic numbers | Named layers table |
| Motion | partial | Document durations for panel collapse, dialog, stepper pulse |

---

## 8. Recommended Canonical Component Taxonomy

```
client/src/
├── components/
│   ├── ui/                    # shadcn primitives — DO NOT domain-logic
│   ├── workbench/             # NEW: design-system compositions
│   │   ├── WorkbenchPageShell.tsx
│   │   ├── WorkbenchDialogShell.tsx
│   │   ├── OperationModal.tsx
│   │   ├── PhaseStepper.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Callout.tsx
│   │   ├── PageLoadingState.tsx
│   │   └── PageErrorState.tsx
│   ├── layout/                # app shell (existing)
│   ├── shared/                # thin wrappers — migrate workbench-worthy pieces up
│   ├── data-display/          # NEW: tables/trees extracted from pages
│   │   ├── DatabaseTable/
│   │   ├── TreeCheckbox.tsx
│   │   └── ColumnResizeHandle.tsx (from upload/)
│   ├── dashboard/             # dashboard-specific (keep)
│   ├── upload/                # upload-specific (keep)
│   ├── edit-metadata/         # metadata dialog panels (keep)
│   ├── settings/              # settings (keep)
│   └── charts/                # visualization (keep)
├── features/                  # stateful modals + 3D — orchestration only, thin UI
└── app/                       # route wiring only — target <200 LOC per page
```

**Principles**

- shadcn `ui/` stays pristine; regenerate from CLI when upgrading.
- Wrap shadcn **only** when the wrapper encodes a repeated Workbench pattern (dialog shell, callout, status badge).
- Pages compose; they do not define 800 lines of table markup.
- `features/` owns modal state machines; visual shell moves to `components/workbench/`.

---

## 9. Recommended Folder / File Structure (target)

| Current | Target | Rationale |
|---------|--------|-----------|
| Table in `app/database/page.tsx` | `components/data-display/DatabaseTable/` | Reuse on Inspect Damage |
| `lib/status-badge.ts` | `components/workbench/StatusBadge.tsx` + tokens | Visual + semantic unity |
| `components/blocks/dialog/*` | `components/workbench/PhaseStepper.tsx` + thin panels | DRY stepper |
| 4 operation modals | `components/workbench/OperationModal.tsx` | Single shell |
| Settings + Metadata dialog chrome | `components/workbench/WorkbenchDialogShell.tsx` | Size variants: `md`, `xl` |
| Route loading/error | `components/workbench/PageStates.tsx` | Consistent empty/loading/error |

---

## 10. Proposed Normalized Design Tokens

Add to `globals.css` `:root` (values to finalize in DESIGN.md):

```css
/* Semantic status (domain) */
--status-approved: ...;
--status-approved-foreground: ...;
--status-obsolete: ...;
--status-draft: ...;

/* Warning / callout (replace amber-*) */
--warning: #ff9500;           /* align with chart-4 or separate */
--warning-foreground: ...;
--warning-muted: ...;

/* Surface hierarchy */
--surface-canvas: var(--background);
--surface-panel: var(--card);
--surface-inset: var(--muted);

/* Panel widths */
--panel-width-sm: 20rem;   /* 320px */
--panel-width-md: 21.25rem; /* 340px */
--panel-width-default: 25rem; /* 400px */
--panel-width-lg: 32.5rem;  /* 520px */

/* Z-index layers */
--z-sticky: 10;
--z-dropdown: 20;
--z-sidebar: 30;
--z-header: 40;
--z-overlay: 50;
--z-modal: 60;
--z-modal-shell: 70;
--z-toast: 80;

/* Shadow tokens (optional — map to utilities) */
--shadow-subtle: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-elevated: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
```

Typography roles — adopt from `.cursor/skills/design-guidelines/DESIGN.md` verbatim.

---

## 11. Draft `DESIGN.md` Outline

When authoring repo-root `DESIGN.md` (getdesign.md style):

1. **Frontmatter** — name, description, colors (light; dark TBD), typography roles, radius, elevation, z-index, motion
2. **Visual theme & atmosphere** — monochromatic engineering workbench, Apple-inspired restraint
3. **Design principles** — density over decoration, semantic tokens over raw Tailwind, compose from workbench layer
4. **Color palette & semantic roles** — shadcn base + status + warning + chart usage rules
5. **Typography rules** — role table with canonical class strings; caption/label enforcement
6. **Layout principles** — 64px sidebar, two-panel workspace, page shell dimensions
7. **Component styling rules** — Button/Input/Card defaults; when to use Badge vs StatusBadge vs Callout
8. **Data-display rules** — hierarchical table (sticky header, row height, checkbox size, group boundaries)
9. **Dialog & workflow rules** — WorkbenchDialogShell vs OperationModal vs AlertDialog confirm
10. **Density rules** — table `text-sm`, header `text-label`, plot caption `text-caption`
11. **Responsive behavior** — desktop-first; document intentional no-mobile scope
12. **Accessibility rules** — focus ring, destructive actions, loading announcements
13. **Do's and don'ts** — no hardcoded hex in TSX; no new grays; no arbitrary z-index
14. **Agent implementation guide** — where to add components, which layer, grep checks before PR

**Bootstrap path:** Copy `.cursor/skills/design-guidelines/DESIGN.md` → `DESIGN.md`, merge findings from this audit, add domain-specific sections (database table, operation modals).

---

## 12. Prioritized Refactor Roadmap

### Phase 1 — Inventory and tagging (1–2 days)

- [ ] Promote `DESIGN.md` to repo root (or `docs/design/DESIGN.md`)
- [ ] Tag components in inventory with `@layer workbench` comments or `design-system` export barrel
- [ ] Add ripgrep CI/check script from AUDIT.md recipes (optional)
- [ ] Document z-index and panel width decisions in DESIGN.md

### Phase 2 — Token normalization (2–3 days)

- [ ] Add semantic status + warning tokens to `globals.css`
- [ ] Replace `getStatusBadgeClassName` with `StatusBadge` component
- [ ] Replace `amber-*` warning blocks with `Callout variant="warning"`
- [ ] Replace `bg-gray-100/80` → `bg-muted/80`
- [ ] Migrate `text-[10px]`/`text-[11px]` → `text-caption`/`text-label`
- [ ] Add z-index CSS variables; update `shell-operation-modal.ts`

**Verify:** Visual snapshot of Database, Dashboard, Inspect Damage, Metadata dialog.

### Phase 3 — Component consolidation (1–2 weeks)

- [ ] Extract `PhaseStepper` from progress panels
- [ ] Create `OperationModal` shell; migrate 4 modals (**MEDIUM risk**)
- [ ] Create `WorkbenchDialogShell`; migrate Settings + Metadata (**HIGH risk** — test discard flows)
- [ ] Extract `TreeCheckbox` shared primitive
- [ ] Create `PageLoadingState` / `PageErrorState`; update route files

**Verify:** All operation flows (upload, delete, channel reprocess, damage calc) + settings + metadata edit.

### Phase 4 — Page-by-page refactor (2–3 weeks)

- [ ] Extract `DatabaseTable` from `database/page.tsx` (**HIGH risk**)
- [ ] Adopt `DatabaseTable` variant on `inspect-damage/page.tsx`
- [ ] Extract `WorkbenchPageShell` on dashboard/database/inspect-damage
- [ ] Split `DatabaseOperationModal.tsx` state from presentation
- [ ] Reduce each `app/*/page.tsx` to orchestration (<200 LOC target)

**Verify:** Full regression on selection, sort, filter, resize, batch delete, metadata edit entry points.

### Phase 5 — Visual QA and regression testing

- [ ] Manual smoke: login, dashboard plots, database CRUD, upload, metadata dialog all sections, inspect damage, settings
- [ ] axe accessibility pass on refactored shells
- [ ] Chromatic or manual screenshot baseline if available
- [ ] Update CHANGELOG + decision log entry for design-system adoption

---

## 13. Agent Implementation Checklist

Copy into implementation issues:

```
## Pre-flight
- [ ] Read DESIGN.md (repo root)
- [ ] Read this HANDOFF.md section relevant to your slice
- [ ] Run impact analysis on symbols you will extract/rename

## Token work
- [ ] No new hex/rgb in TSX
- [ ] Use semantic roles from DESIGN.md
- [ ] Use text-label / text-caption instead of arbitrary px

## Component work
- [ ] New shared visual pattern → components/workbench/
- [ ] shadcn ui/ changes only via CLI upgrade, not ad hoc edits
- [ ] Pages compose components; no new 400+ LOC page files

## Dialog / modal work
- [ ] Operation flows use OperationModal shell
- [ ] Multi-section dialogs use WorkbenchDialogShell
- [ ] Confirm destructive actions use AlertDialog

## Table / tree work
- [ ] Follow data-display rules in DESIGN.md
- [ ] Shared TreeCheckbox for all hierarchical trees
- [ ] Column resize uses shared ColumnResizeHandle

## Verification
- [ ] npm test (client) passes
- [ ] Manual test steps listed in issue
- [ ] No visual drift in sidebar, header, panel collapse, dialog open/close
```

---

## 14. Open Questions for DESIGN.md Authoring

1. **Dark mode** — Ship light-only and strip `dark:` classes, or implement `.dark` token block from DESIGN.md draft?
2. **Panel default width** — Standardize on 320px (current majority) or 400px (`SidePanelLayout` default)?
3. **Status colors** — Keep green/red/amber semantics or move to neutral + iconography only (more monochromatic)?
4. **Database table extraction** — Single component with variants vs shared hook + presentational split?
5. **Toast styling** — sonner `richColors` vs custom toast matching Workbench palette?
6. **3D inspect module** — Include in design system scope or exempt as experimental surface?

---

## 15. Key File Index (quick navigation)

| Concern | Path |
|---------|------|
| Tokens | `client/src/app/globals.css` |
| Root layout | `client/src/app/layout.tsx` |
| Providers / shell mount | `client/src/app/providers.tsx` |
| App shell | `client/src/components/layout/ClientLayout.tsx` |
| Sidebar config | `client/src/config/sidebar-config.ts` |
| Header config | `client/src/config/header-config.ts` |
| Mega table (reference) | `client/src/app/database/page.tsx` |
| Mega damage page | `client/src/app/inspect-damage/page.tsx` |
| Metadata dialog | `client/src/components/edit-metadata/MetadataEditDialog.tsx` |
| Settings dialog | `client/src/components/settings/SettingsDialog.tsx` |
| Status badge helper | `client/src/lib/status-badge.ts` |
| Modal z-index | `client/src/lib/shell-operation-modal.ts` |
| Database table skill | `.cursor/skills/database-table/SKILL.md` |
| Design guidelines skill | `.cursor/skills/design-guidelines/SKILL.md` |

---

*Audit completed 2026-06-11. No code changes. Next step: author `DESIGN.md` from outline §11 using `.cursor/skills/design-guidelines/DESIGN.md` as the starting point.*
