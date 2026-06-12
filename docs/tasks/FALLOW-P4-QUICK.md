# FALLOW-P4-QUICK — P4 quick deduplication slices

**Status:** DONE (2026-06-12)

## Behavior added or changed

- No user-visible behavior changes. Internal deduplication of duplicated client modules flagged by Fallow P4 triage (`docs/brainstorm/30_fallow_client_v1/TRIAGE.md`).

## Interfaces changed

- `RouteErrorFallback` in `client/src/components/shared/RouteErrorFallback.tsx` — shared App Router error UI.
- `client/src/types/event-metadata-fields.ts` — canonical optional metadata fields for `EventMetadata`, `DatasetInfo`, and `UploadMetadata`.
- `client/src/lib/utils/binary-decode-core.ts` — shared binary plot decode used by main thread and worker.
- `calculateRawAxisLimits` exported from `client/src/lib/chart-utils/scales.ts`.
- `client/src/lib/database-table/shared.ts` and `FilterableColumnHeader` — shared table-page helpers for database and inspect-damage routes.

## Tests added and what they prove

- No new tests. Existing suite: 378 passing; 2 pre-existing failures (`client.test.ts` timeout expectation, vitest picking up `.next/standalone` copies).

## Verification

- `npm run build` — pass
- `npx fallow dupes` — database ↔ inspect-damage, error boundaries, PlotGrid ↔ scales, binary decode, and api ↔ upload type clone groups eliminated (8 clone groups remain, unrelated families)

## Follow-on assumptions

- Deferred P4 items (event-tree unification, progress panels, operation modals) remain in triage for a later slice.
- `fallow init` + CI gate still outstanding (FALLOW-15).

## Decisions intentionally left unchanged

- Database page still defaults new sort columns to `desc`; inspect-damage defaults to `asc` (preserved via `toggleSortField` parameter).
