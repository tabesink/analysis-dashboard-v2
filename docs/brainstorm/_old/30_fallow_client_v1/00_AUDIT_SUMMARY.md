# Fallow Client v1 — Raw Audit Summary

**Tool:** Fallow v2.94.0  
**Install:** `client/package.json` → `devDependencies.fallow: ^2.94.0`  
**Root:** `Dashboard/client/`  
**Date:** 2026-06-12

## Commands

| Command | Purpose |
|---------|---------|
| `npx fallow --format markdown` | Full baseline |
| `npx fallow audit --format markdown` | Changed files vs `origin/master` merge-base |
| `npx fallow health --score --targets --format markdown` | Health score + refactor targets |

## Full-scan verdict

```
Failed: dead-code (268 issues), dupes (67 clone groups), health (119 above threshold)
Start with: src/components/ui/button-group.tsx
Health score: 74 (B)
```

## Vital signs

| Metric | Value |
|--------|------:|
| Total LOC | 38,551 |
| Functions analyzed | 2,742 |
| Avg Cyclomatic | 2.0 |
| P90 Cyclomatic | 4 |
| Dead Files | 3.8% |
| Dead Exports | 23.2% |
| Maintainability (avg) | 90.9 |
| Hotspots (6 months) | 0 |
| Circular Deps | 0 |
| Unused Deps | 4 |
| Duplication | 8.6% (3,247 lines across 66 files) |

## Dead code (268 issues)

### Unused files (14)

- `src/components/blocks/dialog/index.ts`
- `src/components/dashboard/index.ts`
- `src/components/layout/NavDocuments.tsx`
- `src/components/layout/index.ts`
- `src/components/ui/avatar.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/sheet.tsx`
- `src/lib/chart-utils/index.ts`
- `src/lib/utils/index.ts`
- `src/lib/utils/partition-sync.ts`
- `src/stores/index.ts`
- `src/types/index.ts`

### Unused dependencies (4)

- `@hookform/resolvers`
- `canvas-confetti`
- `react-hook-form`
- `zod`

### Other dead-code categories

| Category | Count |
|----------|------:|
| Unused exports | 160 |
| Unused type exports | 84 |
| Unresolved imports | 2 |
| Duplicate exports | 3 |
| Test-only production deps | 1 (`react-dom`) |

### Unresolved imports (actionable)

| File | Import |
|------|--------|
| `src/components/edit-metadata/DurabilitySchedulePanel.test.tsx:53` | `@/components/edit-metadata/DamageValidationReportSummary` |
| `src/features/edit-metadata/__tests__/channel-map-save.test.ts:3` | `@/features/edit-metadata/lib/channel-map-save` |

### Duplicate exports (3)

- `DamageCalculationScope` — `src/lib/damage-calculation-cache.ts`, `src/stores/damage-calculation-store.ts`
- `MetadataDialogSection` — `src/features/edit-metadata/lib/metadata-dialog-sections.ts`, `src/stores/metadata-edit-dialog-store.ts`
- `UploadProgressPhase` — `src/features/database-upload/upload-operation-types.ts`, `src/hooks/use-upload.ts`

## Changed-code audit (pass)

**Scope:** 9 changed files vs merge-base `612ef65` (`origin/master`)  
**Verdict:** `pass`  
**Attribution (new-only gate):**

| Category | Introduced | Inherited |
|----------|----------:|----------:|
| Dead code | 0 | 5 |
| Complexity | 0 | 6 |
| Duplication | 0 | 9 |

Inherited dead code in changed scope = 4 unused deps + 1 test-only dep (`react-dom`).  
All 9 duplication clone groups are `database/page.tsx` ↔ `inspect-damage/page.tsx` pairs.

## Duplication (67 clone groups, 46 families)

### Highest-impact families

| Family | Lines | Files | Recommendation |
|--------|------:|-------|----------------|
| 14 | 494 | `HierarchicalEventTree.tsx`, `DatabaseEventTree.tsx` | Extract shared event-tree module |
| 2 | 164 | `database/page.tsx`, `inspect-damage/page.tsx` | Extract shared table page utilities |
| 23 | 192 | `ScopeDeleteOperationModal.tsx`, `UploadOperationModal.tsx` | Shared operation-modal shell |
| 8 | 151 | `scope-delete-summary-panel.tsx`, `ScopeDeleteOperationModal.tsx` | Shared summary panel |
| 4–7 | 59–118 | Progress panels (`derived-data`, `scope-delete`, `upload`) | Shared progress panel primitives |
| 42 | 51 | `binary-decoder.ts`, `binary-decode.worker.ts` | Share decode logic |
| 13 | 35 | `PlotGrid.tsx`, `scales.ts` | Deduplicate axis limit calculation |
| 46 | 41 | `api.ts`, `upload.ts` | Consolidate type shapes |
| 1 | 18 | 3× route `error.tsx` files | Shared error boundary |

Full clone listing: captured in `npx fallow --format markdown` output (1,417 lines).

## Complexity hotspots (top 10 by CRAP)

| File | Function | Cyclomatic | Cognitive | CRAP | Lines |
|------|----------|----------:|----------:|-----:|------:|
| `DatabaseOperationModal.tsx:477` | `renderImportProgress` | 72 | 73 | 1191.7 | 191 |
| `DatabaseOperationModal.tsx:151` | `DatabaseOperationModal` | 61 | 60 | 73.6 | 840 |
| `DatabaseOperationModal.tsx:339` | `renderExportProgress` | 56 | 53 | 733.4 | 137 |
| `DatabaseSwitchDialog.tsx:43` | `DatabaseSwitchDialog` | 37 | 35 | 41.6 | 238 |
| `SelectDatasetSection.tsx:32` | `SelectDatasetSection` | 23 | 12 | 552.0 | 103 |
| `AssignChannelsPanel.tsx:62` | `AssignChannelsPanel` | 22 | 14 | — | 335 |
| `UploadDataSection.tsx:37` | `UploadDataSection` | 20 | 17 | — | 271 |
| `DatabaseOperationModal.tsx:742` | `renderImportConfirm` | 19 | 21 | 97.0 | 122 |
| `use-database-operation.ts:380` | `confirmImport` | 18 | 19 | 88.0 | 135 |
| `EditMetadataPanel.tsx:326` | `handleSave` | 18 | 14 | 88.0 | 77 |

**119** functions above default thresholds (cyclomatic > 20, cognitive > 15, CRAP ≥ 30).

Notable page-level complexity (changed in current branch):

| File | Function | Cyclomatic | Cognitive | CRAP | Lines |
|------|----------|----------:|----------:|-----:|------:|
| `database/page.tsx:142` | `DatabasePage` | 12 | 11 | 156.0 | 906 |
| `inspect-damage/page.tsx:120` | `InspectDamagePage` | 12 | 11 | 156.0 | 282 |
| `inspect-damage/page.tsx:468` | `DamageTable` | 10 | 13 | 110.0 | 683 |

## Refactoring targets (Fallow-ranked, top 12)

| Efficiency | Category | File | Recommendation |
|-----------:|----------|------|----------------|
| 24.0 | dead code | `button-group.tsx` | Remove 4 unused exports (100% dead file) |
| 22.8 | dead code | `avatar.tsx` | Remove 3 unused exports (100% dead file) |
| 13.2 | dead code | `color-picker.tsx` | Remove 9 unused exports (75% dead) |
| 13.0 | high impact | `build-program-version-draft.ts` | Split high-impact file (4 dependents) |
| 12.3 | dead code | `pagination.tsx` | Remove 7 unused exports (100% dead file) |
| 12.2 | dead code | `sheet.tsx` | Remove 8 unused exports (100% dead file) |
| 12.2 | dead code | `version.ts` | Remove 4 unused exports (67% dead) |
| 11.6 | dead code | `dropdown-menu.tsx` | Remove 10 unused exports (67% dead) |
| 11.2 | dead code | `canvas-renderer.ts` | Remove 5 unused exports (71% dead) |
| 10.5 | dead code | `filters.ts` | Remove 6 unused exports (86% dead) |
| 9.1 | complexity | `PlotGrid.tsx` | Extract `calculateRawAxisLimits` (cognitive 38) |
| 6.7 | complexity | `DatabaseOperationModal.tsx` | Extract render functions (cognitive 73/60) |

## Notes for agents

- Fallow uses **syntactic** analysis (no type-checker). Verify with grep and tests before deleting.
- Config/codegen exports (`filters.ts`, `settings.ts`, `version.ts`) may be consumed by `scripts/generate-*.js` — use `fallow-ignore` or `.fallowrc.json` entry points rather than blind deletion.
- Shadcn UI files with 100% dead-file verdict and zero imports are safe deletion candidates.
- Re-run `npx fallow --format markdown` after each cleanup slice to confirm counts drop.
