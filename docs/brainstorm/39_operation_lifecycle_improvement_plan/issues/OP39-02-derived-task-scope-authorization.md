# OP39-02 — Authorize Derived Task Reuse And Polling By Scope

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Phase 37 contributor edit policy and derived-lane notes:
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-05-derived-lane-command-query-boundaries.md`
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-06-contributor-edit-policy.md`
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-09-task-kind-reconciliation.md`
- Existing dashboard, damage, channel reprocess, and derived-task hardening tests

## Previous Slice Provides

Database import remnants no longer affect the active operation set.

## What To Build

Fix the derived-task multi-user edge by making derived task start/reuse/poll authorization scope-based instead of creator-only.

Folder upload task polling must remain creator-scoped. Derived tasks must be visible to admins and to the uploader/owner of the program/version scope they mutate.

## This Slice Changes

- Derived task polling authorization.
- Derived task start/reuse authorization where reused active tasks are returned.
- Shared policy/helper code for "admin or program/version uploader/owner" checks.
- Regression tests that distinguish folder-upload task visibility from derived-task visibility.

## This Slice Must Not Rework

- Folder upload polling authorization.
- Database administration.
- Operation runner/admission behavior.
- Progress dialog design.
- Contributor delete policy.

## Acceptance Criteria

- [x] A folder upload task remains pollable only by its creator.
- [x] An admin can poll any active `channel_reprocess` or `damage_calculation` task.
- [x] A non-admin write user can start/reuse/poll a derived task only for a program/version scope they uploaded/own.
- [x] An unrelated write user cannot start/reuse/poll a derived task for another uploader's program/version scope.
- [x] Reusing an active derived task does not hand an unauthorized user a task id.
- [x] The one-active-derived-task-per-program/version guard remains intact.
- [x] Existing channel-map and schedule ownership rules are not weakened.
- [x] `docs/tasks/OP39-02.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] GitNexus impact analysis is run before editing derived-task or authorization symbols.
- [x] Focused tests pass.

## Blocked By

- `OP39-01`

## Next Slice Can Assume

Derived tasks are authorized by program/version scope ownership for admins and upload owners. Folder upload task status remains creator-scoped.

## Completion Note

Completed on 2026-06-17 with shared scope-based derived authorization across poll/start/reuse paths, focused route regressions, and documentation updates in `docs/tasks/OP39-02.md`.
