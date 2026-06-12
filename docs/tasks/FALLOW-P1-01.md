# FALLOW-P1-01 — Remove unused inspect-damage table preference export

**Status:** DONE (2026-06-12)

## Behavior added or changed

- No user-visible behavior changes.
- Removed one dead exported constant flagged by Fallow from inspect-damage table preference helpers.

## Interfaces changed

- `client/src/lib/inspect-damage-table-preferences.ts`
  - Removed `INSPECT_DAMAGE_TABLE_PREFS_STORAGE_KEY` export.

## Safety checks

- GitNexus impact (upstream) on `INSPECT_DAMAGE_TABLE_PREFS_STORAGE_KEY`:
  - `risk: LOW`
  - `direct callers: 0`
  - `processes affected: 0`
- Workspace grep confirmed no in-repo references to the symbol before removal.

## Verification

- `npx fallow audit --format json --quiet` -> `verdict: pass`
- `dead_code_introduced: 0`
- `dead_code_inherited: 12` (down from 13 before this slice)
- `npm run build` still fails on a pre-existing type error unrelated to this slice:
  - `src/features/edit-metadata/DatabaseDerivedDataOperationModals.tsx`
  - missing exported member `DamageCalculationScope` from `@/stores/damage-calculation-store`

## Follow-on assumptions

- Next low-risk dead-code slices should continue to prefer symbol-level removals with GitNexus impact checks before broader file deletions.
