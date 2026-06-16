# Phase 37 Implementation Map

This file is the shared technical truth for Phase 37 coding agents. Read it before any issue in this folder. Keep it updated when an issue changes a cross-slice contract.

## Mission

Refactor upload, derived-data, and database-management workflows into explicit lanes without a broad rewrite. Preserve public behavior, route compatibility, and existing concrete services unless a slice explicitly changes a deprecated capability.

## Current Anchors

- Folder upload starts through the existing folder-upload route and client upload API/hook path.
- Channel-map and schedule workflows live in the dashboard/edit-metadata area and already have derived-task tests around channel reprocess and damage calculation.
- Damage calculation decisions are centered around post-upload precompute and schedule prerequisite logic.
- Database export/import code exists in the database portability service and export router. Phase 37 keeps export and database connection, but removes import from the active product surface.

## Lane Model

### Folder Upload

Purpose: ingest CSV or RSP load histories into canonical raw data.

Owns:

- CSV/RSP source validation
- RSP conversion
- event records
- raw measurements
- source artifacts
- upload task progress
- optional initial channel-map companion detection
- `pending_channel_map` summary semantics

Does not own:

- channel reprocess after explicit channel-map save
- schedule persistence
- damage calculation
- database export/import

Invariants:

- A batch can contain CSV files or RSP files, never both.
- Folder upload requires write/admin permission.
- Endpoint URLs and response shapes stay stable unless an issue explicitly says otherwise.

### Channel Map

Purpose: map raw columns into domain channels and regenerate plot-ready derived data.

Owns:

- channel-map validation
- channel assignment persistence
- channel reprocess task
- plot-ready LTTB derived rows
- contributor edit policy for data uploaded by the contributor

Does not own:

- raw folder ingestion
- schedule persistence
- damage calculation

Invariants:

- Channel-map upload/edit starts channel reprocess only.
- Contributors can edit channel-map data for datasets they uploaded.
- Contributors cannot edit or delete channel-map data uploaded by someone else.
- Admins can CRUD any uploaded channel-map data.

### Schedule And Damage

Purpose: persist schedule rows and calculate scheduled damage when prerequisites are ready.

Owns:

- schedule rows
- RSP event matching
- repeats, weight, multiplier, and scaling behavior
- damage calculation task eligibility
- persisted `event_channel_damage`
- stale/current/error damage state
- contributor edit policy for data uploaded by the contributor

Formula:

```text
scheduled_damage = base_damage * repeats * weight * multiplier
```

Invariants:

- Schedule upload/edit starts damage calculation only when channel prerequisites are ready.
- Contributors can edit schedule data for datasets they uploaded.
- Contributors cannot edit or delete schedule data uploaded by someone else.
- Admins can CRUD any uploaded schedule data.
- Inspect Damage reads persisted damage results only.
- Explicit backfill remains the visible write-user repair command.

### Database Administration

Purpose: manage whole-database operations.

Owns:

- database export
- database create
- database connect
- database delete
- admin-only database operation UI

Invariants:

- Database create/connect/delete are admin-only.
- Database export is admin-only.
- Database import is removed from the active product surface.
- Database export is not folder upload and must not share upload lane policy.

## State And Task Model

Canonical task kinds:

```text
folder_upload
channel_reprocess
damage_calculation
database_export
```

Deprecated or removed task kind:

```text
database_import
```

Folder upload phases should be monotonic and user-readable:

```text
upload_received -> converting -> validating -> writing -> completed
upload_received -> converting -> validating -> writing -> failed
upload_received -> cancelled
```

Derived-data phases should not be interleaved with folder-upload phases. UI progress should display the active task kind and the ordered phase from the backend. If several downstream tasks exist, the UI must not flip-flop between upstream and downstream percentages.

Startup reconciliation must mark stale/running persisted tasks as recoverable terminal or retryable states according to the existing task contract. Preserve the one-active-derived-task-per-program/version guard.
Implemented reconciliation contract:

- On startup, persisted `upload_tasks` rows with active lane kinds (`folder_upload`, `channel_reprocess`, `damage_calculation`) and active statuses (`queued`, `running`) are terminalized to `status=failed`, `phase=failed`.
- Reconciled rows clear transient progress fields (`sub_phase`, `progress_message`, `current_event`) and default `error` to `Task interrupted by server restart` when no explicit error exists.
- Completed/failed/cancelled rows are left untouched.
- Derived active-task reuse still only considers `channel_reprocess` and `damage_calculation` with active statuses, so startup reconciliation clears stale blockers and preserves one-active-derived-task-per-program/version behavior.
- Creator-scoped upload task status/SSE payloads include minimal observability metadata for troubleshooting without a diagnostics panel: `task_owner_user_id`, `task_kind`, `scope`, `phase`, progress fields, `terminal_state`, `result_summary`, and `error_details`.

## Permissions

Use named policies, not a single vague scope rule:

- Folder upload write policy: write/admin only.
- Contributor edit policy: write users can edit channel-map and schedule data only for datasets they uploaded.
- Uploaded-data admin policy: admins can CRUD uploaded data.
- Scope delete policy: preserve existing exclusive-owner-or-admin or stricter behavior.
- Database admin policy: only admins can create, connect, delete, and export databases.
- Canonical helper names:
  - `has_contributor_edit_uploaded_data_policy`
  - `has_uploaded_data_admin_policy`
  - `has_scope_delete_uploaded_data_policy`

Do not weaken delete while extracting edit policy. Do not tighten contributor edit so much that owners lose the ability to maintain their uploaded datasets.

## Server Boundaries

Pure policy helpers may be introduced for:

- upload file classification
- CSV/RSP exclusivity
- optional channel-map companion detection
- task kind constants
- ordered phase mapping
- contributor ownership predicates if they stay pure

Pure helpers must not import FastAPI, DuckDB, pandas, filesystem adapters, React, browser `File`, or request/response types.

Existing services remain concrete anchors:

- folder ingestion service
- damage calculation task service
- post-upload precompute decisions
- dashboard orchestration service helpers for channel-map/schedule route workflows
- database export service
- DuckDB store

Add orchestration functions only when route behavior remains hard to test after pure helpers are extracted.

## Frontend Boundaries

The `/database` route should own folder upload and database administration UI.

The edit-metadata area should own channel-map, schedule, and derived-data operation UI.

Shared client helpers should make display and submit behavior agree on:

- selected-file classification
- CSV/RSP exclusivity
- optional channel-map companion detection
- unsupported file handling
- required metadata
- label-to-payload mapping, including `Program ID` to `job_number`

Progress components render backend task state. They do not infer workflow rules or manufacture progress percentages from unrelated tasks.
Folder-upload progress UI renders the backend folder phases in order (`upload_received`, `converting`, `validating`, `writing`) and ignores non-folder task kinds instead of interleaving downstream derived-task progress.

Use the existing toast notification system as the canonical lightweight user feedback channel. Toasts are appropriate for validation errors, permission failures, ignored-file notices, completed actions, cancellation acknowledgement, and non-blocking success/error feedback.

Keep operation dialogs/modals for upload status and other long-running operation content. Dialogs own detailed progress, current phase, task messages, retry/cancel affordances, and terminal summaries. Toasts may mirror high-level start/completion/failure outcomes, but must not replace the dialog for status-bearing workflows.

Legacy upload components can remain as compatibility wrappers during migration. Do not add new behavior to them.

## Cross-Layer Contracts

- Folder-upload start accepts the existing form payload and returns the existing task response for authorized write/admin users.
- Read-only users receive a forbidden response before folder-upload validation work happens.
- Folder-upload polling and SSE remain creator-scoped.
- Channel-map upload/edit returns channel reprocess task information without implying damage calculation.
- Schedule upload/edit returns schedule persistence results and damage task eligibility/result information.
- Inspect Damage response is produced from persisted damage rows.
- Backfill response is a write command response and may start or reuse a damage calculation task.
- Database export responses remain admin-only and database-operation scoped.
- Database import endpoints, client controls, and task flows are removed from active behavior; compatibility response is `410 Gone` with guidance to use database export plus create/connect workflow.
- Client feedback uses toast notifications for routine information and validation, while upload and long-running database operation dialogs remain the detailed status surface.

## TDD Rules

Each issue should follow one vertical red-green-refactor loop at a time:

1. Add one behavior test through a public route, hook/API helper, or pure policy function.
2. Make the smallest code change needed to pass.
3. Refactor only while green.
4. Repeat for the next behavior.

Do not write all tests first. Do not move files in the same slice as security or task semantics changes unless the issue explicitly asks for that combination.

## Documentation Duties

Each completed issue must:

- update this map if it changes a shared contract
- update `HANDOFF.md` with completion and next-agent notes
- create or update `docs/tasks/{task-id}.md`
- update `CHANGELOG.md` for user-facing behavior changes
- add a durable decision entry only when the decision is hard to reverse, surprising without context, and the result of a real trade-off

## Forbidden Shortcuts

- Do not introduce a full clean-architecture ports/adapters layer in the first wave.
- Do not merge folder upload, channel-map, schedule, damage, and database export into one generic upload abstraction.
- Do not keep database import alive as an undocumented fallback.
- Do not make Inspect Damage mutate data.
- Do not rename public endpoints for cosmetic reasons.
- Do not bypass permission tests when moving route code.
- Do not replace existing services with new abstractions before tests prove the current boundary blocks safe change.
