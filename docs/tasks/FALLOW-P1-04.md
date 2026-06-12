# FALLOW-P1-04 — Final dead-code disambiguation and cleanup

**Status:** DONE (2026-06-12)

## Behavior added or changed

- No user-visible behavior changes.
- Completed dead-code cleanup for this branch by resolving the last reported findings through targeted suppressions and one safe de-export.

## Interfaces changed

- `client/src/types/api.ts`
  - Added targeted suppressions:
    - `// fallow-ignore-next-line unused-type` above `ChannelMapProcessResult`
    - `// fallow-ignore-next-line unused-type` above `APIErrorResponse`
    - `// fallow-ignore-next-line unused-type` above `SVGPlotDataResponse`
- `client/src/features/inspect-damage-3d/lib/damage-color-scale.ts`
  - Removed `export` from `getDamageColorBandColors` (function remains file-local).

## Safety checks

- GitNexus impact was run for all three remaining `types/api.ts` interfaces.
  - Result remained `risk: CRITICAL`, but by-depth results showed broad file-level import dependencies for `client/src/types/api.ts` rather than concrete callsites for each individual type.
  - Based on this, suppressions were chosen over symbol removal to avoid accidental API-surface regressions.
- For `getDamageColorBandColors`, whole-repo usage search showed no references before de-exporting.

## Verification

- `npm run build` -> pass
- `npx fallow audit --format json --quiet` -> `verdict: pass`
- Dead-code gate status:
  - `dead_code_issues: 0`
  - `dead_code_introduced: 0`
  - `dead_code_inherited: 0`
- `ReadLints` on changed files -> no diagnostics

## Follow-on assumptions

- Dead-code cleanup for this branch is complete from Fallow’s changed-code perspective.
- Remaining Fallow work is now in duplication/complexity categories rather than dead code.
