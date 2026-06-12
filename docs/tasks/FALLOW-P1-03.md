# FALLOW-P1-03 — Upload API/type dead-export cleanup

**Status:** DONE (2026-06-12)

## Behavior added or changed

- No user-visible behavior changes.
- Reduced dead-type surface by removing unused type re-exports from upload API and de-exporting two unused file-local types.

## Interfaces changed

- `client/src/lib/api/upload.ts`
  - Removed type re-export line for:
    - `UploadResponse`
    - `UploadTaskStartResponse`
    - `UploadTaskEvent`
    - `DatasetInfo`
    - `UploadMetadata`
- `client/src/types/upload.ts`
  - Removed `export` from:
    - `PaginatedResponse<T>`
    - `UploadedFile`

## Safety checks

- GitNexus `impact` could not resolve the upload API re-export aliases directly (`target not found`), so safety was validated with whole-repo usage search:
  - no imports of those type names from `@/lib/api/upload`
  - all active type imports use `@/types/upload`
- GitNexus impact for `PaginatedResponse` and `UploadedFile` in `client/src/types/upload.ts` returned `risk: MEDIUM`; edits were limited to removing export-only surface (no structural/type-shape changes).
- GitNexus impact for remaining dead types in `client/src/types/api.ts` returned `risk: CRITICAL`; these were intentionally not changed in this slice.

## Verification

- `npm run build` -> pass
- `npx fallow audit --format json --quiet` -> `verdict: pass`
- `dead_code_introduced: 0`
- `dead_code_inherited: 3` (down from 10 before this slice)
- `ReadLints` on changed files -> no diagnostics

## Follow-on assumptions

- Remaining dead-code findings are concentrated in `client/src/types/api.ts` and require deeper symbol-level disambiguation before any export removals.
