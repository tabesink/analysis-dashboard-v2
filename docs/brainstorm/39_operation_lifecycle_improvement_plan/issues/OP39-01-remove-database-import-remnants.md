# OP39-01 — Remove Database Import Remnants

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Phase 37 database lane notes:
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-07-remove-database-import.md`
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-08-database-export-and-connection-lane.md`
- Existing database export, database create/connect/delete, and import-removal tests

## Previous Slice Provides

Phase 37 removed database import from the active product surface and clarified database administration as an admin-only lane.

## What To Build

Delete or terminally isolate remaining database import implementation remnants while preserving database export, create, switch/connect, and delete.

The goal is to make the supported database-administration lane smaller and easier to reason about before adding operation lifecycle hardening.

## This Slice Changes

- Server import endpoints, models, service methods, task branches, and stale task-kind references that are no longer needed.
- Client import hooks, types, state, and API helpers that are no longer active.
- Tests and docs that still imply database import is supported.
- Export/import shared code only where import removal leaves dead branches.

## This Slice Must Not Rework

- Folder upload behavior.
- Channel-map, schedule, damage, or Inspect Damage behavior.
- Database export download/progress behavior.
- Database create/connect/delete semantics.
- Operation admission, active-user presence, or progress dialog behavior.

## Acceptance Criteria

- [x] Public behavior proves database import is unavailable or removed according to the existing Phase 37 contract.
- [x] Database export remains admin-only and still starts, polls, and downloads successfully in focused tests.
- [x] Database create/connect/delete remain admin-only and keep current response contracts.
- [x] Import-specific task kind branches are removed or unreachable from active code.
- [x] Client code no longer exposes database import controls, hooks, or active types except compatibility shims that tests prove are still needed.
- [x] Documentation no longer describes database import as a supported operation.
- [x] `docs/tasks/OP39-01.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] GitNexus impact analysis is run before editing database operation symbols.
- [x] Focused tests pass.

## Blocked By

- None.

## Next Slice Can Assume

Database administration contains only supported admin operations: create, switch/connect, delete, and export. Legacy import no longer shapes operation lifecycle code.

## Completion Note

Completed on 2026-06-17. See `docs/tasks/OP39-01.md` for behavior, interface, and test details.
