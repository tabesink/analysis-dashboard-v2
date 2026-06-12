# FALLOW-P1-02 — Canonical damage-calculation scope imports + upload modal dead re-export cleanup

**Status:** DONE (2026-06-12)

## Behavior added or changed

- No user-visible behavior changes.
- Fixed TypeScript build failures caused by stale type imports that referenced `DamageCalculationScope` from the wrong module.
- Removed two unused type re-exports from upload modal surface flagged by Fallow.

## Interfaces changed

- Updated import source for `DamageCalculationScope` in:
  - `client/src/features/edit-metadata/DatabaseDerivedDataOperationModals.tsx`
  - `client/src/features/edit-metadata/lib/apply-damage-task-response.ts`
  - `client/src/features/edit-metadata/lib/apply-schedule-damage-response.ts`
  - `client/src/features/edit-metadata/lib/channel-reprocess-follow-up.ts`
  - `client/src/features/inspect-damage/lib/apply-inspect-damage-calculate.ts`
- Removed re-exported types from `client/src/features/database-upload/UploadOperationModal.tsx`:
  - `UploadCompletionResult`
  - `UploadWizardStep`

## Safety checks

- GitNexus impact on `DatabaseDerivedDataOperationModals` before edits:
  - `risk: LOW`
  - `direct callers: 1`
- Attempted additional dead-type candidates in `client/src/types/api.ts` returned `CRITICAL` impact signals, so they were intentionally deferred from this slice.

## Verification

- `npm run build` -> pass (Next.js build + TypeScript complete)
- `npx fallow audit --format json --quiet` -> `verdict: pass`
- `dead_code_introduced: 0`
- `dead_code_inherited: 10` (down from 12 prior to this slice)
- `ReadLints` on changed client files -> no diagnostics

## Follow-on assumptions

- Continue P1 cleanup on low/medium risk symbols only.
- Revisit the remaining inherited unused type exports in `client/src/types/api.ts` with more precise symbol analysis before removal.
