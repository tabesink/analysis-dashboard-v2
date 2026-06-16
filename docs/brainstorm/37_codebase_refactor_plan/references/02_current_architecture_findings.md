# 02 — Current Architecture Findings

## Finding 1 — Upload router owns too many responsibilities

The upload router currently acts as an HTTP adapter, validation layer, task launcher, ingestion coordinator, audit surface, polling/SSE surface, and lifecycle/delete controller.

### Why this matters

Large routers are hard to test and easy to accidentally break. A coding agent modifying upload behavior may change validation, task orchestration, or authorization without realizing it.

### Recommendation

First extract pure validation/classification helpers and write-route permission checks while leaving URLs stable. Split route modules only after behavior is covered by tests:  `DEVELOPER NOTES: Explace validation and classification helpers: what are they used for, how many do you plan to introduce; what will be their function?`

```text
server/api/v1/upload/folder_router.py
server/api/v1/upload/dataset_router.py
server/api/v1/dashboard/channel_map_router.py
server/api/v1/dashboard/schedule_router.py
server/api/v1/dashboard/derived_task_router.py
server/api/v1/export/database_portability_router.py
```

Each future router should be thin, but do not create a full use-case/ports layer before it removes real code pressure.

---

## Finding 2 — Upload logic is not lane-separated

Folder ingestion, channel mapping, schedule assignment, damage calculation, and DB import/export are conceptually different workflows, but they meet too closely in current upload-related code.

### Why this matters

The product mental model becomes unclear:

- Folder upload creates raw canonical data.
- Channel map creates channel interpretation and downsampled plot data.
- Schedule creates damage context and damage calculation.
- DB import/export moves the entire database.

These are not variants of the same thing.

### Recommendation

Represent these as separate lanes in names, tests, and docs. Keep the current concrete services in place initially:

- `IngestionService` for folder upload and channel reprocess.
- `DamageCalculationTaskService` plus `post_upload_precompute` for schedule/damage.
- `ExportService` for DB import/export.

Extract smaller functions only where a TDD slice needs them.

---

## Finding 3 — Large file handling risks API memory pressure

The current upload flow reads uploaded files in the request path. This is simple but can become risky when large CSV/RSP batches are uploaded or multiple users upload concurrently.

### Why this matters

A local LAN app can still crash under memory pressure. Reliability matters because upload is a high-value workflow.

### Recommendation

Defer streaming-to-staging to a reliability slice. The first refactor wave should preserve the current byte-based upload path so structure can change without also changing file lifecycle, cleanup, and adapter contracts.`DEVELOPER NOTES: would this code modification handle for early cancelation during upload? Does it fail gracefully incase backend services become unavailable? What about status polling and reporting to user that is uploading, currently I observe on the upload dialogue inaccurate completion status percentage reporting; i observe non-sequential task completion cases where polling would report on a downstream task and then start reporting on an upstream task and flip-flop between these - is it possible to ensure sequential upload / damage related task completion percentage reporting?`

---

## Finding 4 — In-process background tasks need stronger discipline

In-process background execution is appropriate for the current app size, but long-running tasks must be bounded, idempotent, and recoverable.

### Why this matters

Damage calculation and channel reprocess create persisted derived data. If the server restarts mid-task, users need a clear status and retry path.

### Recommendation

Keep in-process execution for now, but add:

- shared task-kind constants
- startup reconciliation for stale/running persisted `upload_tasks`
- preservation of the existing one-active-derived-task guard per program/version
- idempotent phase writes
- explicit retry semantics

Do not introduce one generic task runner for folder upload, derived tasks, DB import, and DB export in the first wave.

---

## Finding 5 — DB portability is a separate domain

DB import/export is not an event-level upload. It is a whole-database portability workflow.

### Why this matters

Mixing DB import with folder upload creates dangerous mental-model confusion. DB import may replace or restore the whole DuckDB state.

### Recommendation

Keep DB portability under the existing export/database boundary with its own API, progress modal, and admin permissions. Add a focused cache-invalidation test and fix so a successful import does not leave stale runtime query cache entries.

---

## Finding 6 — Folder upload permission is weaker than adjacent write paths

Folder upload currently accepts any authenticated user, while channel-map save/upload, schedule attach/save, program/version delete, and DB connect/import-style mutations require write/admin or admin permission.

### Why this matters

Folder upload creates events, raw measurements, source artifacts, ownership rows, audit entries, and cache invalidations. It is a write path in the shared DuckDB state.

### Recommendation

Change folder upload to require write/admin permission and add a route-level regression test for read-only users. `DEVELOPER NOTES: strongly agree with direction`

---

## Finding 7 — Ownership policies differ and should be named, not hidden

Channel-map and schedule edit currently allow a contributor who owns at least one item in the program/version scope. Scope delete is stricter and requires admin or exclusive ownership across the scope.

### Why this matters

A generic `DatasetScopePolicy` could accidentally loosen delete or tighten edit behavior during refactor.

### Recommendation

Preserve current behavior initially and name the policies separately, for example:

- contributor edit policy for channel-map and schedule  `DEVELOPER NOTES: contributors, as in those who have write permission (not considering admin here) should have full freedom to edit and modify channel-map and schedule IF they uploaded that dataset - this is the privilage of a writer: they can upload, edit data that they are responsible, they should not have the ability to delete or edit event channel-map and schedule data that they did NOT upload. Admin CRUD permissions for any data that is uploaded; ONLY admins will have permissions to create, connect or delete databases`
- exclusive-owner-or-admin delete policy for scope deletion
