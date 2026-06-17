# UI38-04 — Data And Analysis Surface Standardization

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
- Database page/table components
- Inspect Damage page/table/filter components
- Relevant dashboard/analysis page containers

## Previous Slice Provides

The theme baseline, shared wrappers, and app shell are standardized.

## What To Build

Standardize dense data and analysis surfaces around shadcn table, filter, card, tab, and status patterns while preserving existing data behavior.

## This Slice Changes

- Database table/page visual structure, filters, batch action surfaces, loading/error/empty states, and page section containers.
- Inspect Damage surrounding layout, filters, tables, tabs, and non-plot surfaces.
- Data status badges and muted secondary regions.
- Component tests for sorting/filtering/selection/expansion behavior if touched.

## This Slice Must Not Rework

- Dashboard card internals.
- Damage plot cards or chart internals.
- Backend data contracts.
- Table behavior such as sorting, filtering, selection, expansion, pagination, or batch actions except where a focused test proves preservation.

## Acceptance Criteria

- [x] Database and inspect-data surfaces use shadcn table/card/filter patterns or documented local equivalents.
- [x] Dense technical pages remain readable without decorative styling.
- [x] Existing table interactions continue to work.
- [x] Loading, empty, error, and destructive states use semantic tokens.
- [x] Chart colors remain limited to visualization regions.
- [x] Dashboard and damage plot cards are visually unchanged unless explicitly documented as untouched surrounding-layout changes.
- [x] Focused tests or manual verification cover the highest-risk table interactions touched by this slice.
- [ ] Focused lint/type checks for edited frontend files pass.
- [x] `docs/tasks/UI38-04.md` records behavior changed, interfaces changed, verification, and follow-on assumptions.
- [x] GitNexus impact analysis is run before editing code symbols.

## Blocked By

- `UI38-01-design-contract-and-theme-baseline.md`
- `UI38-02-shadcn-primitive-and-shared-layout-baseline.md`
- `UI38-03-app-shell-and-navigation-standardization.md`

## Next Slice Can Assume

Core data and analysis pages have standardized containers, table treatments, and status surfaces while preserving domain interactions.

## Completion Note

- See `docs/tasks/UI38-04.md` for implementation details, verification, and preserved contracts.
- Focused tests passed; focused ESLint surfaced pre-existing `react-hooks/set-state-in-effect` findings in `DamageTableView` that were not introduced by this slice.
