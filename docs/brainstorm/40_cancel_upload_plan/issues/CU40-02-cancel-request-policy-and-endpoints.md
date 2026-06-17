# CU40-02 - Cancel Request Policy And Endpoints

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- `docs/tasks/CU40-01.md` after completion
- Existing upload, dashboard derived-data, and damage route tests

## Previous Slice Provides

Upload-task lifecycle state and heartbeat fields are available. `cancelling` is an active state. Stale active tasks are reconciled before admission and status responses.

## What To Build

Add the server-side cancel request contract for every task stored in `upload_tasks`. This slice should authorize and record cancellation intent, but it does not yet require workers to stop cooperatively.

## This Slice Changes

- Shared cancel policy/helper for `folder_upload`, `channel_reprocess`, and `damage_calculation`.
- Canonical cancel endpoint:
  - `POST /api/v1/upload/tasks/{task_id}/cancel`
- Compatibility endpoints only if they keep client adoption simple:
  - `POST /api/v1/upload/folder/task/{task_id}/cancel`
  - `POST /api/v1/dashboard/derived-data/task/{task_id}/cancel`
- Response model/API helper typing for cancel acknowledgements.
- Task mutation from `queued` or `running` to `cancelling` with `cancel_requested_at`.
- Idempotent responses for `cancelling` and terminal tasks.

## This Slice Must Not Rework

- Worker loop internals.
- Folder upload cleanup behavior.
- Derived task result semantics.
- Modal copy/UX beyond adding API helper coverage.
- Database export cancellation.
- Queue infrastructure.

## Acceptance Criteria

- [ ] Owner can cancel their own `folder_upload` task.
- [ ] Admin can cancel any `folder_upload` task.
- [ ] Unrelated user cannot cancel another user's `folder_upload` task.
- [ ] Admin or program/version scope owner can cancel `channel_reprocess` and `damage_calculation`.
- [ ] Unrelated user cannot cancel derived tasks for scopes they do not own.
- [ ] Cancel on `queued` or `running` task returns status `cancelling` and records `cancel_requested_at`.
- [ ] Cancel on an already `cancelling` task is idempotent.
- [ ] Cancel on terminal tasks returns current terminal status without mutation.
- [ ] Unknown or unauthorized task responses follow existing not-found/forbidden conventions without leaking private task details.
- [ ] Client API helper tests cover cancel request paths and typed response handling.
- [ ] GitNexus impact analysis is run before editing route/service symbols.
- [ ] `docs/tasks/CU40-02.md`, `HANDOFF.md`, and `IMPLEMENTATION_MAP.md` are updated.

## Blocked By

- `CU40-01`

## Next Slice Can Assume

The backend can accept and persist cancel intent for every upload-task kind. Worker code can check that intent and transition to `cancelled` when safe.

## Completion Note

Implemented in `docs/tasks/CU40-02.md`.

