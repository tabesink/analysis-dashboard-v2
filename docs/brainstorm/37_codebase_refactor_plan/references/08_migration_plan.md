# 08 — Incremental Migration Plan

## Principle

Refactor behind the existing endpoints. Use vertical TDD slices: write one failing behavior test, make the smallest change to pass, then refactor while green.

## Phase 1 — TDD tracer bullets and hardening

- Add route-level test that read-only authenticated users cannot start folder upload.
- Change folder upload to require write/admin permission.
- Add a DB import cache test and clear runtime cache after successful import.
- Preserve endpoint URLs and response shapes.

Risk: Low

## Phase 2 — Extract pure upload policies

Move CSV/RSP exclusivity, channel-map filename detection, supported file classification, and task-kind constants into pure functions/constants.

Add each behavior test one at a time:

- CSV-only batch allowed
- RSP-only batch allowed
- CSV + RSP rejected
- channel map accepted only as an optional folder-upload companion
- unsupported file rejected
- unsupported folder contents ignored where the current route contract ignores them

Risk: Low

## Phase 3 — Client upload helper extraction

- Add tests for selected-file classification shared by `UploadDataSection` and `/database` submit handling.
- Add tests for required metadata and label-to-payload mapping.
- Extract shared helpers.
- Keep the UI behavior unchanged.

Risk: Low to Medium

## Phase 4 — Preserve explicit lane boundaries

- Document that folder upload, channel map, schedule/damage, DB import, and DB export remain separate.
- Keep `POST /damage/inspect` read-only.
- Keep `POST /damage/backfill` as an explicit write-user repair command.
- Preserve contributor edit semantics separately from exclusive-owner-or-admin delete semantics.

Risk: Medium

## Phase 5 — Small server orchestration cleanup

- Keep `IngestionService`, `DamageCalculationTaskService`, `ExportService`, and `UnifiedStore` concrete.
- Add a small orchestration function only if tests show route code remains too hard to reason about.
- Keep current endpoint URL and response shape.

Risk: Medium

## Phase 6 — Incremental task hardening

- Add shared task-kind constants.
- Add startup reconciliation for stale/running persisted `upload_tasks`.
- Preserve one-active-derived-task-per-program/version behavior.
- Defer a bounded shared runner.

Risk: Medium

## Phase 7 — Refactor client modules

- Move `/database` upload UI into `features/database/upload` after helper tests are green.
- Move DB import/export into `features/database/portability` separately.
- Move channel map and schedule logic into `features/edit-metadata` separately.
- Keep compatibility wrappers for legacy components.

Risk: Medium

## Phase 8 — Optional router splitting

Move endpoints into smaller router files while preserving route paths and imports.

Risk: Medium

## Phase 9 — Remove deprecated wrappers

After behavior parity is confirmed:

- delete `UploadSidePanel`
- delete `UploadContent`
- remove dead upload API helpers
- remove duplicate progress components

Risk: Low to Medium

## Phase 10 — Later reliability features

- Stream uploaded files to scratch/staging storage.
- Add scratch cleanup lifecycle tests.
- Consider a bounded in-process runner after existing task flows are stable.
- Add an admin diagnostics panel only if operators need it.

Risk: Medium to High

## Golden-path coverage

Build toward, but do not write all at once:

```text
folder upload → optional channel map → channel reprocess → schedule upload → damage calculation → Inspect Damage read
```

Keep DB export/import golden-path coverage separate because it is a whole-database portability lane, not an event-level upload lane.

Risk: Low

## First-wave implementation sequence

Run these as separate red-green-refactor slices:

| Slice | Red test | Green implementation | Refactor only after green |
|---|---|---|---|
| 1. Folder upload permission | Read-only authenticated user receives forbidden from `POST /api/v1/upload/folder/start` | Switch route dependency to write/admin permission | Rename/localize auth helper only if the test remains route-level |
| 2. Upload file policy | Pure helper accepts CSV-only and RSP-only, rejects mixed CSV/RSP | Extract file classification from router/client logic | Share names/constants across server helpers |
| 3. Client file policy | Side panel and submit path classify the same selected files identically | Extract `upload-file-policy` helper and consume it in both places | Move helper into feature folder |
| 4. Client metadata mapping | Required labels build the existing payload, including `Program ID` → `job_number` | Extract metadata payload builder | Reduce duplicate required-field handling |
| 5. Inspect Damage command/query boundary | Inspect read does not mutate; explicit backfill starts/reuses only when eligible | Preserve separate `inspect` and `backfill` paths | Clarify client naming if needed |
| 6. DB import cache | Query result changes after successful import without waiting for TTL | Clear runtime cache after import finalization | Keep cache clearing inside portability lane |
| 7. Task constants/reconciliation | Existing active derived task behavior is preserved after constants extraction | Add shared task-kind constants and stale-task reconciliation | Consider later runner only with coverage |

Stop after any slice if behavior reveals a larger product decision. Do not combine file moves with security, cache, or task-runner changes.
