# OP39-04 — Add Lightweight Operation Admission Guards

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Existing upload task, derived task, database export, and database connection tests

## Previous Slice Provides

Failed uploads can be cleaned up and retried. Derived task authorization is scope-based. Database import has been removed from active lifecycle behavior.

## What To Build

Add explicit admission guards for conflicting operations using the existing in-process and persisted task state. Keep it lightweight: no external queue and no restart-resumable durable workers.

The first implementation can be a named operation-admission service/helper that checks active operations and returns allow/block decisions. A bounded in-process runner may be introduced only if it simplifies current thread spawning without changing public behavior.

## This Slice Changes

- Operation admission helper/service.
- Active operation checks for folder upload, derived tasks, database export, database create, database switch, and database delete.
- API error responses for blocked operations.
- Tests proving conflicts are blocked before new work starts.

## This Slice Must Not Rework

- Active-user presence. That is handled in `OP39-05`.
- Progress dialog UI.
- Database import.
- Durable queue infrastructure.
- Retry/resume semantics after restart.

## Acceptance Criteria

- [x] One active derived task per program/version remains enforced.
- [x] Database switch/delete are blocked when active folder uploads exist.
- [x] Database switch/delete are blocked when active derived tasks exist.
- [x] Database switch/delete are blocked by another active exclusive database operation.
- [x] Database create remains admin-only and does not race with another exclusive database operation.
- [x] Database export remains admin-only and preserves existing progress/download behavior.
- [x] Blocked operation responses are structured enough for client to show a toast.
- [x] Startup-reconciled failed operations do not block new work.
- [x] No external queue, Redis, Celery, or restart-resumable worker system is added.
- [x] `docs/tasks/OP39-04.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] GitNexus impact analysis is run before editing operation, upload, derived-task, or database symbols.
- [x] Focused tests pass.

## Blocked By

- `OP39-03`

## Next Slice Can Assume

Conflicting operations are rejected by named admission rules before work starts, but active-user presence is not yet part of database-switch blocking.
