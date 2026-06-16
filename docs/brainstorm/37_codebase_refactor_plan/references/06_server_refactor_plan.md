# 06 — Server Refactor Plan

## Goal

Refactor server upload behavior behind existing endpoint URLs, using small TDD slices. Preserve lane behavior except for the intentional hardening changes called out below.

## Step 1 — Add the first failing route test

Start with the smallest security behavior:

```text
read-only authenticated user cannot start folder upload
```

Expected public interface: `POST /api/v1/upload/folder/start` returns forbidden for users without write/admin permission.

Only after the test fails, change the route from authenticated-only to write/admin permission.

## Step 2 — Extract pure upload policies

```text
server/upload/domain/policies.py
```

or, for a leaner first pass:

```text
server/upload/policies.py
```

Move only pure rules out of routers/services:

- CSV/RSP exclusivity
- supported file extension detection
- task kind naming
- phase naming
- pending channel map semantics

Add each behavior through red-green-refactor:

- CSV-only batch allowed
- RSP-only batch allowed
- CSV + RSP rejected
- channel map recognized only as optional folder-upload companion
- unsupported files ignored or rejected according to the current route contract

## Step 3 — Keep current production services

Do not add a broad `ports.py` layer in the first wave. Keep these concrete services as the stable implementation surface:

- `IngestionService`
- `DamageCalculationTaskService`
- `ExportService`
- `UnifiedStore`
- `post_upload_precompute`

Introduce a small orchestration function only if a route remains hard to test after policy extraction.

## Step 4 — Preserve and name ownership policies

Keep current semantics but make the names explicit in docs and, if extracted, in helper names:

- contributor edit policy: channel-map and schedule edits
- exclusive-owner-or-admin policy: program/version scope delete
- admin portability policy: DB import/export

Do not hide these behind one generic scope policy unless tests prove the behavior remains distinct.

## Step 5 — Fix DB import cache staleness

Add a behavior test that proves a successful DB import does not serve stale program/event results from runtime query cache. Then clear the relevant cache, or the full runtime cache, after the import is safely applied.

This belongs with DB portability, not folder upload.

## Step 6 — Make derived task boundaries explicit

Channel map save/upload should start only `channel_reprocess`.

Schedule save/upload should persist schedule rows and then start `damage_calculation` only if channel prerequisites are current.

`POST /damage/inspect` should remain read-only. `POST /damage/backfill` remains an explicit write-user repair command that may start or reuse `damage_calculation`.

## Step 7 — Incremental task hardening

First add:

- shared task-kind constants
- startup reconciliation for stale/running persisted `upload_tasks`
- tests that one active derived-data task per program/version is preserved

Defer a bounded shared runner until after the route and client refactors are green. Do not merge DB import/export into the upload task runner in the first wave.

## Step 8 — Split router files only after coverage

Optional later structure:

```text
server/routers/upload/folder_router.py
server/routers/upload/dataset_router.py
server/routers/dashboard/channel_map_router.py
server/routers/dashboard/schedule_router.py
server/routers/dashboard/derived_task_router.py
server/routers/export/database_portability_router.py
```

## Route compatibility

The existing URLs should remain stable:

```text
POST /api/v1/upload/folder/start
GET /api/v1/upload/folder/task/{task_id}
GET /api/v1/upload/datasets
POST /api/v1/upload/events/delete
POST /api/v1/export/database/parquet/upload
POST /api/v1/export/database/parquet/import/{upload_id}
```

Do not rename public endpoints until the new internals are stable.
