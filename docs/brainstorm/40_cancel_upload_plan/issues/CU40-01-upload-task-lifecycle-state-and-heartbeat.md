# CU40-01 - Upload Task Lifecycle State And Heartbeat

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- Phase 39 lifecycle contracts:
  - `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
  - `docs/tasks/OP39-03.md`
  - `docs/tasks/OP39-07.md`
- Existing upload task storage/backfill/admission tests

## Previous Slice Provides

Phase 40 planning only. No code changes are available yet.

## What To Build

Extend the `upload_tasks` lifecycle model so all upload-task operation kinds can report cancellation timing and worker heartbeat freshness. Add reconciliation helpers that fail stale active tasks closed before they indefinitely block admission or recovery surfaces.

## This Slice Changes

- Upload-task state model to include `cancelling` as an active state.
- Upload-task persistence for lifecycle timestamps:
  - `started_at`
  - `cancel_requested_at`
  - `finished_at`
  - `last_heartbeat_at`
- Optional diagnostic worker token such as `runner_id`.
- Startup and request-time stale heartbeat reconciliation helper.
- Operation admission active-task detection so `cancelling` remains active and stale rows are reconciled before blockers are returned.
- Status payload typing/models so heartbeat and cancel timing are observable.

## This Slice Must Not Rework

- Folder upload ingestion internals.
- Channel reprocess or damage calculation processing loops.
- Client modal behavior.
- Cancel endpoints.
- Failed-upload cleanup deletion behavior.
- External queue infrastructure.

## Acceptance Criteria

- [ ] `upload_tasks` can represent `queued`, `running`, `cancelling`, `completed`, `failed`, and `cancelled`.
- [ ] Active task queries treat `queued`, `running`, and `cancelling` as active.
- [ ] Task status payloads expose lifecycle timestamps where available.
- [ ] Workers can update `last_heartbeat_at` without changing terminal result behavior.
- [ ] Startup reconciliation still fails active rows closed after backend restart.
- [ ] Request-time reconciliation marks active rows with expired heartbeat as `failed` with clear interrupted-worker messaging.
- [ ] Operation admission runs stale reconciliation before returning blockers.
- [ ] Focused server tests cover active-state classification, stale reconciliation, and admission not being blocked by stale rows.
- [ ] GitNexus impact analysis is run before editing upload task storage/admission symbols.
- [ ] `docs/tasks/CU40-01.md`, `HANDOFF.md`, and `IMPLEMENTATION_MAP.md` are updated.

## Blocked By

- None.

## Next Slice Can Assume

Upload-task storage and status payloads have a shared lifecycle vocabulary and heartbeat reconciliation API. Active stale rows no longer need to be handled ad hoc by cancel endpoints.

## Completion Note

- Implemented in code and documented in `docs/tasks/CU40-01.md`.

