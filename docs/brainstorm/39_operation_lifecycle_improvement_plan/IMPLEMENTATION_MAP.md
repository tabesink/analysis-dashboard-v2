# Phase 39 Implementation Map

This file is the shared technical truth for Phase 39 coding agents. Read it before any issue in this folder. Keep it updated when an issue changes a cross-slice contract.

## Mission

Harden long-running operation lifecycle behavior without introducing a heavyweight durable queue. Remove legacy database import, keep database administration exclusive, improve failed-upload retry safety, fix derived-task scope authorization, add lightweight active-user protection for database switching, and keep progress status visible.

## Current Anchors

- Phase 37 completed lane separation for folder upload, derived data, and database administration.
- Folder upload and derived-data tasks currently persist status in `upload_tasks`.
- Startup backfills currently terminalize stale active upload/derived tasks after restart.
- Database import is removed from active product behavior and runtime operation lanes; legacy API compatibility stubs remain `410 Gone`.
- Database create/connect/delete/export are admin-only database-administration operations.
- Channel reprocess and damage calculation reuse one active derived task per program/version scope.
- Folder upload polling is creator-scoped.
- Derived task polling and start/reuse authorization now use the same scope rule: admin or uploader/owner of the program/version scope.

## Operation Kinds

Canonical active operation kinds for this phase:

```text
folder_upload
channel_reprocess
damage_calculation
database_export
database_create
database_switch
database_delete
```

Removed operation kind:

```text
database_import
```

## Lifecycle Model

### Active States

```text
queued
running
```

### Terminal States

```text
completed
failed
cancelled
```

### Restart Policy

On backend startup, active operations from the previous process must fail closed:

- `queued` or `running` operations become `failed`.
- Error text must explain that the server restarted or the operation was interrupted.
- Folder uploads should provide cleanup/retry guidance when partial data may exist.
- Derived tasks should leave the one-active-task-per-scope guard clear after reconciliation.
- No task should claim to keep running after the process that owned its thread has died.

### Minimum Observability Contract

Lifecycle status surfaces must expose enough context to diagnose blocked/retry flows without a dedicated diagnostics dashboard.

- Upload/derived task status payloads expose operation identity and lifecycle state:
  - `task_kind`
  - `task_owner_user_id`
  - `scope`
  - `phase`
  - `status` and `terminal_state`
- Failed folder upload status includes cleanup/retry guidance:
  - `error_details.cleanup_required`
  - `error_details.cleanup_candidate_event_count`
  - `error_details.cleanup_endpoint`
  - `error_details.retry_guidance`
- Operation admission `409` payloads expose structured blockers:
  - `detail.operation`
  - `detail.blocked_by[].reason`
  - optional blocker `scope`
  - optional blocker `usernames` for active-user switch blocks

## Authorization Contracts

### Folder Upload Task Polling

Folder upload task polling remains creator-scoped.

```text
Can poll folder_upload task =
  current_user.id == task.created_by_user_id
```

Rationale: in-progress folder upload status can include file names, current file details, and partial import information that should not be exposed to unrelated users.

### Derived Task Start/Reuse/Poll

Derived tasks are scoped to program/version data, not only to the user who clicked the action.

```text
Can start/reuse/poll derived task =
  current_user.role == admin
  OR current_user uploaded/owns the program-version scope
```

Derived task kinds:

```text
channel_reprocess
damage_calculation
```

Requirements:

- Admins can start, reuse, and poll derived tasks for any program/version.
- Non-admin write users can start, reuse, and poll derived tasks only for program/version scopes they uploaded.
- Unrelated users cannot receive a reused task id for a scope they do not own.
- If an unrelated user somehow knows a task id, polling must return a forbidden/not-found response without leaking task details.
- Start/reuse authorization and polling authorization must use the same scope ownership rule.

### Database Administration

Database create, switch, delete, and export are admin-only.

Database switch and delete are exclusive operations and must be blocked by:

- active users on the current database
- active folder uploads
- active derived tasks
- another active exclusive database operation

Database export remains admin-only and long-running. It should not be treated as folder upload.

## Active-User Presence

Existing saved sessions are not sufficient for active-use detection. Presence should be lightweight and time bounded.

Recommended contract:

- Client sends periodic heartbeat while authenticated.
- Presence records include `user_id`, `username`, active route or area, active database identity, and `last_seen_at`.
- A user is active when `last_seen_at` is within a short threshold, for example 60 seconds.
- Admin database-switch checks return structured active-user data when blocked.
- Client toast should include active usernames.

Example blocked switch message:

```text
Cannot switch database while Alice, Bob are active. Ask them to finish or retry when idle.
```

## Failed Partial Upload Cleanup

The app should not require durable upload resume. It should make retry safe.

Required behavior:

- Failed/interrupted folder upload status must tell the user whether cleanup is needed.
- Cleanup must remove data committed by the failed task before retry.
- Re-uploading the same dataset after cleanup should not fail due to duplicate hashes from the failed attempt.
- Cleanup must respect ownership: the uploader or an admin can clean up a failed upload task.
- Cleanup must not delete successful unrelated data with the same program/version.
- Cleanup contract endpoint: `POST /api/v1/upload/folder/task/{task_id}/cleanup`.

## Operation Admission

Phase 39 should avoid a heavyweight durable queue. Use bounded in-process controls and explicit admission decisions.

Recommended rules:

- One active folder upload write pipeline at a time per active database, unless tests prove safe parallel writes.
- One active derived task per program/version scope.
- Database switch/delete require no active users and no active mutating operations.
- Database create can remain admin-only and non-switching, but it should not race with another exclusive admin operation.
- Database export can be long-running and admin-only; it should be blocked by database switch/delete if they target the same active database.

The implementation may begin with status-table admission guards before introducing a local runner abstraction. Do not introduce external queue infrastructure.

## Progress Dialog Contract

Active operation dialogs must remain the detailed status surface.

- Active progress dialogs should not offer "Close and continue in background" unless there is a reliable status surface after dismissal.
- For Phase 39, keep upload and derived progress dialogs open while active.
- If a real cancel path exists, show `Cancel`.
- If cancellation is not supported, show no active action until terminal state.
- Terminal summaries may be closed.
- Toasts announce high-level outcomes but must not replace detailed progress.

## Legacy Removal Contract

Database import must be removed from active product behavior and old code should be deleted when safe.

Targets include:

- server import endpoints
- import-specific models and response types
- import task handling in database export/import service code
- client import hooks/state/types
- stale docs/tests that imply import is supported

Keep database export, database create, database switch/connect, and database delete.

## Frontend Boundaries

- Database page/settings own admin database-operation UI.
- Upload UI owns folder-upload progress and cleanup/retry actions.
- Edit Metadata owns channel-map and schedule derived-task progress.
- Shared progress components may render task state, but they must not own workflow authorization or admission rules.

## Server Boundaries

- Route handlers should authenticate/authorize, parse input, call operation/service helpers, and map responses/errors.
- Operation admission and scope authorization should live behind named helpers or services so route tests can verify behavior without duplicating policy.
- Pure helpers should not import FastAPI, DuckDB, pandas, or React.
- Keep concrete services unless tests prove they block safe change.

## TDD Rules

Each issue should follow one vertical red-green-refactor loop at a time:

1. Add one behavior test through a public route, hook/API helper, or pure policy function.
2. Make the smallest code change needed to pass.
3. Refactor only while green.
4. Repeat for the next behavior.

Do not write a broad test matrix up front. Avoid horizontal slices where an agent writes all tests first and then all implementation. Every slice should be a tracer bullet: one failing behavior test, one minimal implementation, then the next behavior.

Per cycle checklist:

- The test describes observable behavior, not implementation shape.
- The test uses a public interface only.
- The test would survive an internal refactor.
- The implementation is minimal for the current test.
- No speculative future behavior is added while green is still narrow.

## Documentation Duties

Each completed issue must:

- update this map if it changes a shared contract
- update `HANDOFF.md` with completion and next-agent notes
- create or update `docs/tasks/{task-id}.md`
- update `CHANGELOG.md` for user-facing behavior changes
- add a durable decision entry only when the decision is hard to reverse, surprising without context, and the result of a real trade-off

## Forbidden Shortcuts

- Do not add Celery, Redis, RQ, or an external queue.
- Do not implement restart-resumable task phases.
- Do not preserve database import as an undocumented fallback.
- Do not let unrelated write users start/reuse/poll derived tasks for scopes they did not upload.
- Do not hide active work behind dismissible dialogs with no persistent status surface.
- Do not allow database switch while active users are present.
- Do not delete successful data during failed-upload cleanup.
- Do not merge folder upload, derived data, and database administration into one generic operation abstraction.
