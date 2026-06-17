# Client Component Audit — Phase 38 Baseline

Audit of all visual surfaces under `client/src`, classified for Phase 38 UI/UX standardization. Generated from a full review of the client codebase against `DESIGN.md`, `IMPLEMENTATION_MAP.md`, and the UI38 issue sequence.

**Scope:** `client/src/components/`, `client/src/features/`, `client/src/app/` (visual surfaces only).

**Out of scope for incidental restyling (per PRD):** dashboard plot cards, damage plot cards, chart/plot internals.

---

## Classification Key

| Type | Meaning |
|------|---------|
| **shadcn native** | Source-owned primitive in `components/ui/` (Radix + CVA + semantic tokens). Standard shadcn install. |
| **shadcn-io** | shadcn.io registry component; composes local shadcn primitives. |
| **Custom** | App-built markup/logic; may use semantic tokens but no shadcn primitive as foundation. |
| **Hybrid** | App component composing one or more shadcn primitives plus custom layout or domain logic. |

**Critical exception:** `components/ui/alert-dialog.tsx` lives in `ui/` but is **not** standard shadcn. It is a custom div-based modal without Radix `AlertDialog`. Treat it as custom infrastructure, not a native primitive.

---

## Summary Statistics

| Category | Count (approx.) |
|----------|-----------------|
| shadcn native primitives installed | 21 |
| shadcn-io components | 1 |
| Custom primitive in `ui/` (`alert-dialog`) | 1 |
| App/feature visual components (excl. tests) | ~85 |
| Hybrid (majority of app UI) | ~60 |
| Custom (domain viz, tables, shells) | ~25 |
| Strong shadcn alignment | Login page, `UserManagementSettingsPanel` |

---

## 1. Installed shadcn Primitives (`client/src/components/ui/`)

| File | Classification | Notes |
|------|----------------|-------|
| `accordion.tsx` | shadcn native | Used in `GlobalFilters` |
| `alert-dialog.tsx` | **Custom (non-Radix)** | Div overlay; backdrop click closes; no Radix focus trap/ARIA. **UI38-02 risk.** |
| `badge.tsx` | shadcn native | User management |
| `button.tsx` | shadcn native | Extended sizes (`xs`, `icon-xs`) beyond stock shadcn |
| `card.tsx` | shadcn native | Widely used |
| `checkbox.tsx` | shadcn native | Tables, filters, trees |
| `collapsible.tsx` | shadcn native | Event trees |
| `dialog.tsx` | shadcn native | Radix Dialog; `rounded-xl` styling drift vs Phase 38 `rounded-md` |
| `dropdown-menu.tsx` | shadcn native | Column headers, user mgmt |
| `input.tsx` | shadcn native | Forms, filters |
| `label.tsx` | shadcn native | Login, user mgmt |
| `popover.tsx` | shadcn native | Database/inspect tables |
| `progress.tsx` | shadcn native | Upload/operation steppers |
| `scroll-area.tsx` | shadcn native | Side panels, trees |
| `select.tsx` | shadcn native | Metadata, upload, overlay controls |
| `separator.tsx` | shadcn native | Side panel, metadata header |
| `sidebar.tsx` | shadcn native | App shell; composes Button, Input, Separator, Skeleton, Tooltip |
| `skeleton.tsx` | shadcn native | Loading placeholders |
| `switch.tsx` | shadcn native | User management only |
| `table.tsx` | shadcn native | **Only used in `UserManagementSettingsPanel`** |
| `tabs.tsx` | shadcn native | Login, dashboard tabs |
| `tooltip.tsx` | shadcn native | Sidebar logo |
| `shadcn-io/color-picker.tsx` | shadcn-io hybrid | Composes `Popover`; used in event trees / pinned events |

**Total installed:** 23 files — 21 standard shadcn, 1 shadcn-io, 1 custom masquerading as shadcn.

---

## 2. shadcn Primitives Referenced in DESIGN.md but Not Installed

| Missing primitive | Where it would matter |
|-------------------|----------------------|
| `Empty` | `EmptyState.tsx` is custom |
| `Spinner` | `LoadingSpinner.tsx` is custom |
| `Sheet` / `Drawer` | Side panels use custom `SidePanelLayout` |
| `Breadcrumb` | No breadcrumb in `SiteHeader` |
| `Textarea`, `Field`, `RadioGroup` | Forms use raw inputs |
| `Alert` | Banners use custom div shells |
| `Sonner` wrapper | `sonner` used directly in `providers.tsx` |
| `Command` | No command palette |
| `Pagination` | Tables use custom scroll/pagination |
| `Resizable` | Plot/layout panels are custom |
| `Chart` | Charts are custom SVG/canvas |
| `Calendar` / `DatePicker` | Not present |
| `NavigationMenu`, `ContextMenu`, `HoverCard`, `Avatar` | Not present |

---

## 3. App Component Inventory by Area

### A. App Shell and Layout — `components/layout/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `ClientLayout` | Hybrid | `SidebarProvider`, `SidebarInset` |
| `AppSidebar` | Hybrid | `Sidebar`, `SidebarContent`, `SidebarMenu*`, custom auth/settings buttons |
| `NavMain` | Hybrid | `SidebarMenu*` |
| `LogoHeader` | Hybrid | `SidebarHeader`, `Tooltip` |
| `SiteHeader` | Hybrid | `Button` + custom text links/buttons |
| `VersionLabel` | Custom | Token typography only |

### B. Shared Wrappers — `components/shared/`

| Component | Type | shadcn used | Phase 38 note |
|-----------|------|-------------|---------------|
| `DialogContentCard` | Custom | None (div shell) | Target wrapper for UI38-02; uses `border-[var(--border)]`, `shadow-subtle` |
| `DialogPageHeader` | Custom | None | Used by settings/metadata dialogs |
| `DialogCardFooter` | Custom | None | Footer slot wrapper |
| `EmptyState` | Custom | None | Should align with shadcn `Empty` block |
| `LoadingSpinner` | Custom | None | Custom CSS spinner; DESIGN prefers shadcn Spinner |
| `FileDropZone` | Custom | None | Custom drag-drop; DESIGN prefers shadcn.io file-upload block |
| `SidePanelLayout` | Hybrid | `Button` | Custom collapsible panel chrome |
| `SidePanelSection` | Hybrid | `Button` | Custom expand/collapse (not `Collapsible`) |
| `RouteErrorFallback` | Hybrid | `Button` | Error page shell |
| `ErrorBoundary` | Hybrid | `Button` | Class component fallback |

### C. Dialog Blocks — `components/blocks/dialog/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `operation-progress-stepper` (`PhaseStep`, `StepperTimeline`, etc.) | Hybrid | `Progress` + custom timeline dots |
| `upload-progress-panel` | Hybrid | Via stepper |
| `derived-data-progress-panel` | Hybrid | Via stepper |
| `scope-delete-confirm-panel` | Custom | Token-based confirm body |
| `scope-delete-summary-panel` | Custom | Summary content |
| `scope-delete-progress-panel` | Hybrid | Via stepper |

### D. Settings — `components/settings/`

| Component | Type | shadcn used | Notes |
|-----------|------|-------------|-------|
| `SettingsDialog` | Hybrid | `Button` + raw `DialogPrimitive` | Custom two-column shell; native `<button>` nav; not shadcn `Dialog` |
| `DatabaseSettingsPanel` | Hybrid | `DialogContentCard` wrapper | Composes upload modals |
| `ChangelogSettingsPanel` | Hybrid | `DialogContentCard` + `Loader2` | No Skeleton |
| `UserManagementSettingsPanel` | Strong hybrid | `Table`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Input`, `Label`, `Select`, `Switch`, `Badge`, `Button` | Best shadcn coverage in app |

### E. Upload and Database — `components/upload/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `DatabaseOperationModal` | Hybrid | Custom `AlertDialog`, `Progress`, `Button` |
| `DatabaseSwitchDialog` | Hybrid | `Dialog`, `Input`, `Label`, `ScrollArea`, `Button` |
| `UploadDataSection` | Hybrid | `Button`, `Input`, `ScrollArea`, `Select` + `FileDropZone` |
| `DatabaseSection` | Hybrid | `Button` |
| `DatabaseSidePanel` | Hybrid | `ScrollArea` |
| `DatabaseEventTree` | Hybrid | `Button`, `Collapsible`, raw `CheckboxPrimitive` |
| `CsvPreviewTable` | Custom | Flex/grid table; not shadcn `Table` |
| `ColumnResizeHandle` | Custom | Pure mouse-drag div |

### F. Edit Metadata — `components/edit-metadata/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `MetadataEditDialog` | Hybrid | Raw `DialogPrimitive`, custom `AlertDialog`, `Button`, `DialogPageHeader` |
| `MetadataDialogHeader` | Hybrid | `Separator`, `Skeleton` |
| `EditMetadataPanel` | Hybrid | `Button`, `Checkbox`, `Input`, `Select` |
| `EditMetadataSidePanel` | Hybrid | `ScrollArea` |
| `AssignChannelsPanel` | Hybrid | `Button`, `Input` |
| `SelectDatasetSection` | Hybrid | `Select` |
| `DurabilitySchedulePanel` | Hybrid | `Button` |
| `DurabilityScheduleTable` | Hybrid | `Input` + custom flex table |
| `ScheduleUploadDialog` | Hybrid | `Dialog` |
| `ChannelMapUploadDialog` | Hybrid | `Dialog` |
| `UploadScheduleSection` | Hybrid | `Button` + `FileDropZone` |
| `ChannelReprocessBanner` | Hybrid | `Button` + custom banner div |
| `DamageCalculationBanner` | Hybrid | `Button` + custom banner div |

### G. Dashboard Workspace — `components/dashboard/`

| Component | Type | shadcn used | Phase 38 sensitivity |
|-----------|------|-------------|---------------------|
| `DashboardContent` | Hybrid | `Card` | Standard surface |
| `DashboardTabs` | Hybrid | `Tabs` | |
| `PlotGrid` | Hybrid | `Button` | **Sensitive plot surface** |
| `SidePanel` | Hybrid | `ScrollArea`, `Separator`, `Skeleton` | |
| `GlobalFilters` | Hybrid | `Accordion`, `Button`, `Input`, `Skeleton` | |
| `FilterSummaryBar` | Hybrid | `Button` | |
| `FilterOptionRow` | Hybrid | `Checkbox` | |
| `LoadDataSection` | Hybrid | `Button`, `Skeleton` | |
| `ComparisonLoadDataSections` | Hybrid | `Separator` | |
| `ComparisonPlotInputsSection` | Hybrid | `Button` | |
| `HierarchicalEventTree` | Hybrid | `ScrollArea`, `Button`, `Collapsible`, `ColorPicker`, raw `CheckboxPrimitive` | |
| `GridActionToolbar` | Hybrid | `Button` | |
| `InteractiveViewer` | Hybrid | `Card` | **Sensitive** |
| `CurveSelector` | Hybrid | Via `SidePanelSection` + tree | |
| `PinnedEventsOverlay` | Hybrid | `Button`, `ColorPicker` | **Sensitive** |

### H. Charts and Plots — `components/charts/`

| Component | Type | shadcn used | Phase 38 |
|-----------|------|-------------|----------|
| `PlotCardShell` | Hybrid | `Card` | **Do not restyle (PRD)** |
| `SVGPlotCard` | Hybrid | `Button` | **Do not restyle** |
| `SVGPlot`, `SVGPath`, `SVGAxes` | Custom | SVG rendering | Domain viz |
| `InteractiveCanvasPlot` | Custom | Canvas | Domain viz |
| `PlotTooltip` | Custom | Positioned div | Chart-only colors OK |
| `PlotLegendOverlay` | Custom | Overlay | Chart-only colors OK |
| `plot-card-styles.ts` | Custom tokens | CSS classes for plot cards | **Protected surface** |

### I. Database Table Helper — `components/database-table/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `FilterableColumnHeader` | Hybrid | `DropdownMenu` on custom header |

### J. Damage Tree — `components/damage/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `DamageEventTree` | Hybrid | `Collapsible` |

### K. Changelog — `components/changelog/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `ChangelogContent` | Custom | Tailwind `prose` + `react-markdown` |

---

## 4. Feature Modules — `client/src/features/`

| Component | Type | shadcn used |
|-----------|------|-------------|
| `UploadOperationModal` | Hybrid | Custom `AlertDialog`, `Button` |
| `ScopeDeleteOperationModal` | Hybrid | Custom `AlertDialog`, `Button` |
| `DerivedDataOperationModal` | Hybrid | Custom `AlertDialog`, `Button` |
| `DatabaseDerivedDataOperationModals` | Logic wrapper | Composes modals above |
| `DatabaseChannelReprocessBanner(s)` | Hybrid | `Button` + banner shell |
| `DamageTableView` | Hybrid | `CardContent`, `Button`, `Checkbox`, `Popover` + custom flex table |
| `DamagePlotView` | Hybrid | `Button`, `Popover` |
| `DamagePlotOverlayControls` | Hybrid | `Checkbox`, `Select` |
| `Damage2DPlotCard` | Hybrid | Via `PlotCardShell` | **Protected** |
| `AbsoluteByEventPlotCard` | Hybrid/Custom | Plot viz | **Protected** |
| `CumulativeByChannelPlotCard` | Hybrid/Custom | Plot viz | **Protected** |
| `TargetDeltaVsReferencePlotCard` | Hybrid/Custom | Plot viz | **Protected** |
| `DamagePlotCanvas.client` | Custom | Three.js/canvas | **Protected** |
| `DamagePlotAxes`, `DamagePlotBars`, `DamagePlotBaseGrid` | Custom | SVG/layout | **Protected** |
| `DamagePlotEventLabelRail` | Custom | Label rail | **Protected** |
| `DamagePlotColorLegend` | Custom | Chart legend | **Protected** |

---

## 5. App Routes (Page-Level Visual Surfaces) — `client/src/app/`

| Route / file | Type | Primary UI building blocks |
|--------------|------|----------------------------|
| `login/page.tsx` | Strong hybrid | `Card`, `Tabs`, `Input`, `Label`, `Button` — closest to shadcn block pattern |
| `dashboard/page.tsx` | Hybrid | Dashboard workspace components |
| `database/page.tsx` | Hybrid | Custom data table + `Card`, `Button`, `Checkbox`, `Popover`, side panel |
| `inspect-damage/page.tsx` | Hybrid | `Card`, `ScrollArea`, `Separator`, `Skeleton`, damage plots |
| `database/edit/page.tsx` | Thin route | Delegates to `MetadataEditDialog` |
| `changelog/page.tsx` | Thin route | Markdown content |
| `settings/users/page.tsx` | Redirect | No UI |
| `*/loading.tsx` (4 files) | Hybrid | `LoadingSpinner` (custom) |
| `*/error.tsx` (4 files) | Hybrid | `RouteErrorFallback` or inline error |
| `providers.tsx` | Infrastructure | `Toaster` from `sonner` (not shadcn wrapper) |
| `layout.tsx` | Infrastructure | Root HTML shell |

---

## 6. Cross-Cutting Patterns and Drift vs Phase 38

### Modal architecture (three competing patterns)

1. **shadcn `Dialog`** — `DatabaseSwitchDialog`, `ScheduleUploadDialog`, `UserManagementSettingsPanel`
2. **Raw Radix `DialogPrimitive`** — `SettingsDialog`, `MetadataEditDialog` (bypass shadcn wrapper)
3. **Custom `AlertDialog`** — all operation modals (upload, export, scope delete, derived data)

This is the highest-risk area for UI38-02/05: inconsistent shells, mixed `rounded-xl` vs `rounded-lg`, custom nav buttons vs shadcn patterns.

### Table architecture (two competing patterns)

1. **shadcn `Table`** — only user management
2. **Custom flex/resizable tables** — `database/page.tsx`, `DamageTableView`, `CsvPreviewTable`, `DurabilityScheduleTable`

Phase 38 wants Data Table blocks; current domain tables are deeply custom (column resize, tree expansion, damage cells). High migration cost — likely wrapper/token normalization first, not full Data Table rewrite.

### Empty, loading, and feedback

| Current | DESIGN.md target |
|---------|------------------|
| `EmptyState` (custom) | shadcn `Empty` block |
| `LoadingSpinner` (custom) | shadcn `Spinner` / `Skeleton` |
| `Loader2` spinners inline | Mixed pattern |
| `toast` from `sonner` directly | shadcn Sonner wrapper |
| Custom banner divs | shadcn `Alert` or muted Card rows |

### Token and styling drift signals

- `border-[var(--border)]` / `bg-[var(--background)]` in dialog shells instead of `border-border`, `bg-background`
- `rounded-xl` on dialogs vs Phase 38 `rounded-md` default
- `rounded-full` on settings close button, side panel toggle, stepper dots (some justified, some drift)
- `shadow-subtle` / `shadow-elevated` — app-specific shadow tokens not in shadcn defaults
- Raw `<button>` elements in `SettingsDialog`, `MetadataEditDialog` nav vs shadcn `Button`

---

## 7. Recommended Phase 38 Implementation Order

Mapped to the UI38 issue sequence and this audit.

| Issue | Safe starting targets | Avoid for now |
|-------|----------------------|---------------|
| **UI38-01** | `globals.css`, tokens, radius | Any component files |
| **UI38-02** | Replace custom `alert-dialog` with Radix shadcn; normalize `DialogContentCard`, `DialogPageHeader`, `EmptyState`, `LoadingSpinner`; align `SettingsDialog`/`MetadataEditDialog` to shadcn `Dialog` | Plot cards, damage viz |
| **UI38-03** | `ClientLayout`, `AppSidebar`, `SiteHeader`, `NavMain` — already sidebar-based; token/radius pass | Sidebar behavior changes |
| **UI38-04** | Database/inspect **chrome** (toolbars, filters, popovers); not table internals | Flex table rewrite, plot cards |
| **UI38-05** | Operation modals, settings, metadata dialog shells — unify on shared dialog layout | Workflow state logic |
| **UI38-06** | Guardrail greps from DESIGN.md §17 | Broad snapshots |

---

## 8. Key Risks for a Careful Rollout

1. **`alert-dialog.tsx` is not accessible shadcn** — operation modals depend on it heavily; replacing it is high impact but necessary for UI38-02 acceptance criteria.
2. **Two dialog implementations** (shadcn `Dialog` vs raw `DialogPrimitive`) — visual drift is intentional today; unifying is UI38-05 work.
3. **Custom tables are domain-critical** — token normalization (borders, text-sm, muted headers) is low risk; migrating to shadcn Data Table is high risk.
4. **Plot/chart surfaces are explicitly out of scope** — `PlotCardShell`, `SVGPlotCard`, all `features/inspect-damage-3d/*` plot components should only receive token-level changes if absolutely required.
5. **Missing shadcn primitives** — several DESIGN.md targets (`Empty`, `Sheet`, `Breadcrumb`, `Alert`) need installation before wrappers can be thin.

---

## 9. Related References

- `DESIGN.md` — visual contract and guardrail searches
- `SHADCN_BLOCK_MAPPING.md` — preferred block families by app area
- `IMPLEMENTATION_PROMPT.md` — agent prompt for refactors
- `../IMPLEMENTATION_MAP.md` — shared technical truth and invariants
- `../issues/UI38-02-shadcn-primitive-and-shared-layout-baseline.md` — first component-level slice after theme baseline
