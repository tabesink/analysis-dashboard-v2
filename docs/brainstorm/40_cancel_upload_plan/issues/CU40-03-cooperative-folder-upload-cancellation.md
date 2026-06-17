# CU40-03 - Cooperative Folder Upload Cancellation

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- `docs/tasks/CU40-01.md`
- `docs/tasks/CU40-02.md`
- Phase 39 failed-upload cleanup notes:
  - `docs/tasks/OP39-03.md`
- Existing folder upload route, ingestion service, and cleanup tests

## Previous Slice Provides

Upload tasks support shared lifecycle timestamps, stale heartbeat reconciliation, and persisted cancel intent through server endpoints.

## What To Build

Make folder upload workers cooperatively observe cancel requests and stop at safe checkpoints. A Cancel click should produce a trustworthy server terminal state rather than only aborting browser polling.

## This Slice Changes

- `folder_upload` worker heartbeat updates during major phases.
- Cancellation checks in folder upload processing:
  - before per-file conversion
  - before per-file validation
  - before event/artifact commits
  - after each committed event
  - before post-upload derived/precompute work
- Terminal transition to `cancelled` when the worker stops due to accepted cancel intent.
- Cancelled partial folder uploads expose cleanup/retry guidance equivalent to failed partial uploads.
- Cleanup endpoint accepts cancelled partial folder upload tasks when cleanup candidates exist.
- Client folder upload flow calls the server cancel endpoint after a task id exists, then keeps polling until terminal state.
- Upload modal copy changes from immediate cancellation to safe cancellation progress.

## This Slice Must Not Rework

- Derived task cancellation.
- Database export cancellation.
- Full upload resume.
- Failed-upload cleanup deletion scope beyond supporting cancelled partial uploads.
- Operation admission rules beyond consuming `cancelling` as active from previous slices.

## Acceptance Criteria

- [ ] Cancelling before any event commits marks the task `cancelled` with no cleanup required.
- [ ] Cancelling after partial commits marks the task `cancelled` and exposes cleanup candidate count, cleanup endpoint, and retry guidance.
- [ ] Cleanup route can clean up cancelled partial folder uploads with the same owner/admin authorization as failed uploads.
- [ ] Cleanup does not delete successful unrelated data from the same program/version.
- [ ] Folder upload worker records heartbeat progress while running and while cancelling.
- [ ] Client Cancel sends the server cancel request when `task_id` is known.
- [ ] Client shows "Cancelling safely..." or equivalent while polling a `cancelling` task.
- [ ] Client does not present a server task as cancelled merely because the browser request was aborted.
- [ ] Focused server tests cover pre-commit cancel, partial-commit cancel, cleanup, and retry safety.
- [ ] Focused client tests cover cancel request, cancelling UI state, and terminal summary.
- [ ] GitNexus impact analysis is run before editing ingestion, cleanup, upload hook, or modal symbols.
- [ ] `docs/tasks/CU40-03.md`, `HANDOFF.md`, `IMPLEMENTATION_MAP.md`, and `CHANGELOG.md` are updated.

## Blocked By

- `CU40-02`

## Next Slice Can Assume

Folder upload has real cooperative cancellation and cancelled partial uploads are retry-safe through the existing cleanup path.

## Completion Note

Implemented via `docs/tasks/CU40-03.md` with cooperative worker checkpoints, cancelled terminal semantics, cancelled-partial cleanup/retry parity, and client cancel polling behavior aligned to server task state.

