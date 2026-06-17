# Phase 40 Implementation Map

This file is the shared technical truth for Phase 40 coding agents. Read it before any issue in this folder. Keep it updated whenever an issue changes a cross-slice contract.

## Mission

Make upload-task operations cancellable, recoverable, and observable without introducing a heavyweight queue. Phase 40 builds on Phase 39's operation lifecycle hardening by adding a shared cancellation and reconnect contract for all tasks persisted in `upload_tasks`.

## Current Anchors

- Phase 39 completed failed-upload cleanup/retry, operation admission guards, active-user switch blocking, and non-dismissible active progress dialogs.
- `upload_tasks` stores task status for:
  - `folder_upload`
  - `channel_reprocess`
  - `damage_calculation`
- Folder upload starts in `server/routers/upload.py` and runs in `IngestionService.start_upload_task(...)`.
- Channel reprocess starts in `IngestionService.start_channel_reprocess_task(...)`.
- Damage calculation starts in `DamageCalculationTaskService.start_damage_calculation_task(...)`.
- Client folder upload now sends a server cancel request once a task id exists, continues polling until terminal state, and shows safe-cancellation progress copy while status is `cancelling`.
- Startup reconciliation marks stale active `upload_tasks` rows failed after backend restart. Phase 40 must also handle worker-heartbeat staleness while the backend process is still alive.

### CU40-01 Delivered Baseline

- `upload_tasks` now stores explicit lifecycle fields: `started_at`, `cancel_requested_at`, `finished_at`, `last_heartbeat_at`, and `runner_id`.
- Active-state constants now include `cancelling` everywhere shared `ACTIVE_TASK_STATUSES` is used.
- Request-time heartbeat reconciliation is available on `UnifiedStore.reconcile_stale_upload_tasks(...)` and is called:
  - before database switch/delete admission blockers are computed
  - before folder upload polling/SSE status payloads are returned
  - before active derived-task reuse checks by scope
- Startup reconciliation still fail-closes active rows and now handles `cancelling` plus `finished_at` stamping when available.
- Admission blocker payloads include `last_heartbeat_at` and `cancel_requested_at`; upload task polling payloads include lifecycle timestamps and `runner_id`.

### CU40-02 Delivered Baseline

- Added shared cancel authorization policy helper in `server/upload/policies.py` for:
  - owner/admin folder upload cancellation
  - admin-or-scope-owner derived-task cancellation
- Added canonical cancel endpoint:
  - `POST /api/v1/upload/tasks/{task_id}/cancel`
- Added compatibility cancel aliases:
  - `POST /api/v1/upload/folder/task/{task_id}/cancel`
  - `POST /api/v1/dashboard/derived-data/task/{task_id}/cancel`
- Added idempotent cancel-intent persistence helper (`UnifiedStore.request_upload_task_cancel(...)`):
  - `queued`/`running` -> `cancelling` + `cancel_requested_at`
  - `cancelling` and terminal states return without mutation
- Added typed cancel acknowledgement model (`UploadTaskCancelResponse`) plus client API helpers/tests.

### CU40-03 Delivered Baseline

- Folder upload workers now perform cooperative cancel checks at safe ingestion checkpoints (conversion/validation/commit boundaries) and keep heartbeats fresh while cancellation is pending.
- Folder upload task runner now transitions to terminal `cancelled` only when the worker cooperatively observes accepted cancel intent.
- Cancelled partial folder uploads now expose cleanup guidance in poll payloads the same way failed partial uploads do.
- Folder upload cleanup endpoint now accepts `failed` and `cancelled` tasks while keeping owner/admin authorization and task-scoped deletion semantics.
- Client upload cancel now requests server cancellation (after task id creation) and does not treat browser abort alone as authoritative task cancellation.

### CU40-05 Delivered Baseline

- Added authenticated upload-task reconnect discovery route:
  - `GET /api/v1/upload/tasks/active`
- Discovery now performs stale-heartbeat reconciliation before returning task rows.
- Discovery visibility rules:
  - folder upload task visibility remains creator-scoped
  - derived task visibility is admin-or-scope-owner scoped
- Discovery response now returns:
  - active tasks (`queued`/`running`/`cancelling`)
  - recent terminal failed/cancelled folder uploads for reconnect cleanup/retry guidance
- Client startup on the Database surface now fetches discovery and:
  - shows a reconnect banner for recoverable folder-upload tasks with **View progress**
  - restores derived task polling state for visible scopes
- Client auth redirect and sync polling no longer rely on `folderUploadInProgress` as a durable cross-browser recovery gate.

### CU40-06 Delivered Baseline

- Auth login audit persistence now uses a bounded best-effort path so authentication remains responsive under dashboard DB lock contention.
- `POST /api/v1/auth/login` no longer fails if dashboard audit insert is unavailable/contended; login success proceeds and emits structured skip logging.
- Admission regression coverage now explicitly verifies:
  - active `cancelling` folder uploads still block database switch/delete
  - stale `cancelling` heartbeat rows are reconciled and no longer block database delete indefinitely.

## Upload-Task Operation Kinds

Phase 40 applies to every operation kind stored in `upload_tasks`:

```text
folder_upload
channel_reprocess
damage_calculation
```

Out of scope for this phase:

```text
database_export
database_create
database_switch
database_delete
```

Database export may later adopt the same lifecycle vocabulary, but this phase should not merge database administration and upload-task execution.

## Lifecycle Model

### Active States

```text
queued
running
cancelling
```

`cancelling` means the server has accepted a cancel request and the worker must stop at the next safe checkpoint. It is not terminal and should continue to block conflicting operations until the task becomes `cancelled`, `failed`, or `completed`.

### Terminal States

```text
completed
failed
cancelled
```

### Required Timestamps

Upload-task rows should expose enough lifecycle timing for recovery and stale detection:

```text
started_at
cancel_requested_at
finished_at
last_heartbeat_at
```

If schema churn is intentionally deferred, equivalent metadata may temporarily live in `result_json`, but the preferred durable contract is explicit columns because operation admission and reconciliation need queryable fields.

### Worker Identity

Persist a lightweight `runner_id` or equivalent worker token when a task starts. It is diagnostic only in this phase. It does not imply multi-process durable queues.

## Cancellation Contract

### Cancel Request

Canonical endpoint shape:

```text
POST /api/v1/upload/tasks/{task_id}/cancel
```

Compatibility aliases may be added when useful:

```text
POST /api/v1/upload/folder/task/{task_id}/cancel
POST /api/v1/dashboard/derived-data/task/{task_id}/cancel
```

If aliases are added, they must call the same service/policy path and return the same response shape.

### Authorization

Folder upload cancel:

```text
Can cancel folder_upload task =
  current_user.role == admin
  OR current_user.id == task.created_by_user_id
```

Derived task cancel:

```text
Can cancel channel_reprocess or damage_calculation task =
  current_user.role == admin
  OR current_user uploaded/owns the program-version scope
```

Unauthorized requests must not leak task details beyond the existing route authorization pattern.

### Idempotency

Cancel is idempotent:

- `queued`, `running` -> mark `cancelling` and record `cancel_requested_at`.
- `cancelling` -> return current task status.
- terminal states -> return current terminal status without mutation.
- unknown or unauthorized task -> follow existing not-found/forbidden conventions.

### Cooperative Checkpoints

Task code must check cancellation at safe boundaries:

- before CPU-heavy parsing/conversion for each file or artifact
- after each file conversion
- before validation for each file or artifact
- before committing each event/artifact
- after each committed event/artifact
- between measurement insertion chunks if chunking is introduced
- before starting post-upload derived work

Cancellation does not interrupt an in-flight DuckDB statement. If the worker is inside a large write, the UI must say it is finishing the current database write before stopping.

## Partial Data Semantics

Folder upload:

- If cancelled before any event commits, terminal state is `cancelled` and cleanup is not required.
- If cancelled after partial commits, terminal state is `cancelled` and cleanup/retry guidance must be exposed.
- Cleanup for cancelled partial uploads should reuse the failed-upload cleanup ownership and deletion semantics.
- Cleanup must remove only data associated with the cancelled task's recorded committed event ids.

Derived tasks:

- Channel reprocess and damage calculation should stop before starting the next artifact/event when cancellation is requested.
- Existing successfully committed artifacts before cancellation may remain if they are already consistent.
- Status payload must clearly say the task was cancelled and whether any follow-up action is needed.

## Heartbeat And Stale Reconciliation

Every running/cancelling upload-task worker should update `last_heartbeat_at` regularly:

- on state transition to `running`
- before/after each major phase
- before/after each file or event
- while waiting in longer loops if any are introduced

Recommended stale threshold:

```text
last_heartbeat_at older than 2-5 minutes for active upload-task states
```

Reconciliation must run in at least these places:

- backend startup, preserving Phase 39 fail-closed behavior
- before operation admission checks
- before active/recent task discovery responses
- before task status polling responses

Stale active tasks become `failed`, not `cancelled`, because no user cancel was acknowledged. Error text should say the worker stopped reporting progress and the task was marked failed for safety.

## Reconnect And Discovery Contract

Add an authenticated discovery route for upload-task operations:

```text
GET /api/v1/upload/tasks/active
```

Minimum behavior:

- returns active `queued`, `running`, and `cancelling` tasks visible to the current user
- returns recent terminal tasks that still need user action, such as cleanup guidance
- folder upload rows remain creator-scoped
- derived task rows use admin-or-scope-owner authorization
- stale heartbeat reconciliation runs before building the response

Client startup should use discovery after auth bootstrap:

- if an active folder upload exists, restore the upload operation modal or show a recovery banner with a "View progress" action
- if an active derived task exists, restore the existing derived progress surface for that scope
- if a terminal partial upload needs cleanup, show cleanup/retry guidance
- do not rely on `folderUploadInProgress` for cross-page or cross-browser recovery

## Auth And Database Responsiveness

Authentication must remain reachable while upload-task operations are active:

- `POST /api/v1/auth/login` and `GET /api/v1/auth/me` should not block behind long dashboard DB writes.
- Auth audit logging should be host-local, best-effort, or bounded by a short timeout.
- Failure to write dashboard audit during active upload work must not fail login.

Database route access should be blocked only by authorization and explicit operation-admission responses, not by stale client flags.

## Operation Admission

Admission guards should treat `cancelling` as active until the task is terminal.

Before building blockers, admission should reconcile stale upload-task heartbeats. A stale `running` or `cancelling` task should not indefinitely block database switch/delete.

Structured blocker payloads should include:

```text
operation
reason
task_id
status
scope
last_heartbeat_at
cancel_requested_at
```

## Progress UI Contract

Active progress dialogs remain non-dismissible unless there is a reliable recovery surface. Phase 40 adds that recovery surface for upload-task operations, but active modals may still stay non-dismissible to prevent accidental loss of context.

Cancel button rules:

- Show Cancel only when the server supports cancel for the task kind.
- Disable or replace Cancel after it is clicked.
- Show "Cancelling safely..." while status is `cancelling`.
- If the worker is in a non-interruptible DB write, show "Finishing current database write before stopping..."
- Terminal summaries remain closeable.

## Server Boundaries

- Route handlers authenticate/authorize, call lifecycle services, and map errors to HTTP responses.
- Cancellation policy should live behind a named helper/service, not duplicated per route.
- Task heartbeat/reconciliation helpers should be pure enough to test without FastAPI.
- Concrete task services may remain concrete; do not introduce an external queue.

## Frontend Boundaries

- Upload UI owns folder-upload progress, cancel, cleanup, and retry actions.
- Edit Metadata UI owns derived-task progress and cancel affordances for channel reprocess/damage calculation.
- Shared hooks/API helpers may handle polling, discovery, and status typing.
- Zustand UI flags are ephemeral only and must not be the durable source of truth for operation recovery.

## TDD Rules

Each issue should follow one vertical red-green-refactor loop at a time:

1. Add one behavior test through a public route, hook/API helper, rendered UI behavior, or pure policy function.
2. Make the smallest code change needed to pass.
3. Refactor only while green.
4. Repeat for the next behavior.

Do not write a broad test matrix up front. Avoid horizontal slices where an agent writes all tests first and then all implementation.

## Documentation Duties

Each completed issue must:

- update this map if it changes a shared contract
- update `HANDOFF.md` with completion and next-agent notes
- create or update `docs/tasks/{task-id}.md`
- update `CHANGELOG.md` for user-facing behavior changes
- add a durable decision entry only when the decision is hard to reverse or surprising without context

## Forbidden Shortcuts

- Do not add Celery, Redis, RQ, or external queue infrastructure.
- Do not call browser abort a successful server cancellation.
- Do not mark a task `cancelled` unless the server accepted cancel or the worker cooperatively stopped from a cancel request.
- Do not delete successful unrelated data during cancelled/failed upload cleanup.
- Do not allow stale active rows to block database administration indefinitely.
- Do not make upload recovery depend on a browser-local Zustand flag.
- Do not expose folder upload task details to unrelated users.

