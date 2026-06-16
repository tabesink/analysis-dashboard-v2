# REF37-09 — Add Task Kind Constants And Stale Task Reconciliation

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/02_current_architecture_findings.md`
- Reference: `references/08_migration_plan.md`
- Reference: `references/09_testing_observability_security.md`
- Existing upload task, derived task, startup, and service tests

## Previous Slice Provides

Folder upload, derived-data, and database administration lanes have explicit behavior boundaries.

## What To Build

Introduce shared task-kind constants and startup reconciliation for stale/running persisted tasks. Preserve the existing one-active-derived-task-per-program/version behavior. Do not introduce a generic shared runner in this slice.

## This Slice Changes

- Shared constants for active task kinds.
- Startup reconciliation for stale/running upload or derived tasks according to existing storage semantics.
- Tests proving active derived-task reuse and stale task recovery.
- Documentation of task kind and phase behavior.

## This Slice Must Not Rework

- Task execution internals beyond constants/reconciliation.
- Database import, which has been removed from the active surface.
- A bounded shared runner.
- Upload file staging.
- Progress UI beyond consuming stable task kinds if needed.

## Acceptance Criteria

- [x] Tests prove task-kind constants preserve current folder-upload and derived-task behavior.
- [x] Tests prove one active derived task per program/version remains enforced.
- [x] Tests prove folder-upload tasks are not returned or reused as derived tasks.
- [x] Startup reconciliation tests prove stale/running tasks do not remain misleading after restart.
- [x] Removed database-import task kinds are not used by active flows.
- [x] `IMPLEMENTATION_MAP.md` is updated with final task-kind names and reconciliation semantics.
- [x] `docs/tasks/REF37-09.md` records behavior changed, interfaces changed, and tests added.
- [x] GitNexus impact analysis is run before editing task/store/service symbols.
- [x] Focused tests pass.

## Blocked By

- `REF37-08`

## Next Slice Can Assume

Task kinds are stable constants and stale task status is reconciled before deeper server cleanup.
