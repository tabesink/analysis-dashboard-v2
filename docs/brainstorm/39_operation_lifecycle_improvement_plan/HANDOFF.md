# Phase 39 Handoff

## Mission

Implement operation lifecycle hardening in small TDD slices. Keep the system lightweight for a 5-10 user team: fail closed after restart, provide cleanup/retry, prevent conflicting operations, remove legacy database import, and avoid heavyweight durable queue infrastructure.

## Required Reading

1. `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
2. `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
3. The current issue file under `docs/brainstorm/39_operation_lifecycle_improvement_plan/issues/`
4. Phase 37 context when needed:
   - `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
   - `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
5. Repo agent rules in `AGENTS.md`

## Issue Order

1. `OP39-01-remove-database-import-remnants.md`
2. `OP39-02-derived-task-scope-authorization.md`
3. `OP39-03-failed-upload-cleanup-and-retry.md`
4. `OP39-04-operation-admission-guards.md`
5. `OP39-05-active-user-presence-switch-block.md`
6. `OP39-06-non-dismissible-progress-dialogs.md`
7. `OP39-07-lifecycle-golden-path-observability.md`

## Current Baton

- OP39-01, OP39-02, OP39-03, OP39-04, OP39-05, OP39-06, and OP39-07 are complete.
- Decisions already resolved:
  - No durable restart-resumable queue.
  - Running operations after restart fail closed.
  - Failed partial uploads need cleanup before safe retry.
  - Database switch blocks when active users are present and reports usernames.
  - Operation control should be bounded and in-process.
  - Derived task access is admin or uploader/owner of the program/version scope.
- OP39-01 completion highlights:
  - Removed runtime database-import internals from server/client operation lanes.
  - Preserved `410 Gone` compatibility stubs on legacy import endpoints.
  - Preserved admin-only export/create/connect/delete contracts with focused regression tests.
  - Added completion note: `docs/tasks/OP39-01.md`.
- OP39-02 completion highlights:
  - Added shared derived-task scope authorization helper used by polling and start/reuse routes.
  - `GET /api/v1/dashboard/derived-data/task/{task_id}` now authorizes by admin-or-scope-owner, not creator-only.
  - `POST /api/v1/damage/backfill` and `POST /api/v1/damage/calculate` now enforce uploader/owner-or-admin scope authorization before start/reuse.
  - Added focused regression tests for admin polling, owner-noncreator polling, and unauthorized reuse denial.
  - Added completion note: `docs/tasks/OP39-02.md`.
- OP39-03 completion highlights:
  - Failed folder-upload task polling now exposes cleanup/retry guidance (`cleanup_required`, candidate count, cleanup endpoint, retry guidance text).
  - Added `POST /api/v1/upload/folder/task/{task_id}/cleanup` with owner/admin authorization and focused failed-task partial-data deletion.
  - Folder upload tasks now persist partial committed `event_ids` during ingestion so failed/interrupted tasks can be cleaned safely before retry.
  - Added completion note: `docs/tasks/OP39-03.md`.
- OP39-04 completion highlights:
  - Added shared operation-admission guards that block conflicting folder upload/derived/export/database-admin starts with structured `409` blocker payloads.
  - Added exclusive database operation in-process lock for create/switch/delete.
  - Added focused route coverage for switch/delete/export/create/upload/damage conflict paths.
  - Added completion note: `docs/tasks/OP39-04.md`.
- OP39-05 completion highlights:
  - Added runtime-only active-user presence heartbeat endpoint (`POST /api/v1/auth/presence/heartbeat`) with short TTL expiry.
  - Database switch admission now blocks when other active users are present on the current database and returns blocker usernames in structured response data.
  - Client now sends authenticated periodic heartbeats and shows active-username toasts on switch-blocked responses.
  - Added focused auth/export route coverage for heartbeat auth contract, active-user blocking, and expiry behavior.
  - Added completion note: `docs/tasks/OP39-05.md`.
- OP39-06 completion highlights:
  - Derived-data progress dialogs now block active dismiss attempts through `onOpenChange` and no longer render the "Close and continue in background" affordance.
  - Upload and database export progress behaviors are now regression-tested for active non-dismissible vs terminal closeable states.
  - Added completion note: `docs/tasks/OP39-06.md`.
- Phase 39 is complete. Remaining work should be explicit follow-on UX/diagnostics/performance improvements, not core lifecycle safety.

- OP39-07 completion highlights:
  - Added explicit failed-upload cleanup/retry route regression proving duplicate-hash re-upload is blocked before cleanup and succeeds after cleanup.
  - Ran the final focused lifecycle regression gate across server route/policy coverage and client operation-modal coverage.
  - Verified lifecycle observability payloads remain coherent for task status and operation-admission blockers without adding new diagnostics surfaces.
  - Added completion note: `docs/tasks/OP39-07.md`.

## Resolved Product Decisions

- Database import is not a supported product capability.
- Database create, switch/connect, delete, and export remain exclusive admin operations.
- Folder upload task polling remains creator-scoped.
- Derived task start/reuse/poll is allowed for admins or the uploader/owner of the program/version scope only.
- Backend restart does not resume work; stale active operations become failed with retry/cleanup guidance.
- Active long-running progress dialogs should not be dismissible unless a durable status surface and recovery path exists.
- Active-user presence is lightweight heartbeat state, not saved session state.

## TDD Operating Notes

Use one red-green-refactor behavior at a time. Favor public route tests, hook/API helper tests, and pure policy/service decision tests. Do not write a broad test matrix before implementation.

Required cycle for every issue:

1. Pick one observable behavior from the acceptance criteria.
2. Add one failing test through the public interface that owns that behavior.
3. Implement the smallest change needed to pass.
4. Refactor only after the focused test is green.
5. Repeat for the next behavior.

Do not use horizontal slices. Do not write all tests first, then all code. Tests should describe what the system does for users/operators, not private function names or implementation shape.

Before editing code symbols, run GitNexus impact analysis for the target symbol and report the blast radius. Before committing, run GitNexus `detect_changes()` and focused tests.

## Recovery Notes

If an issue reveals that retry safety requires replacing rather than cleaning up failed partial data, stop after a green test and update the implementation map with the chosen behavior before continuing.

If active-user presence proves too broad for one slice, keep the server-side block response first and defer richer UI to the progress-dialog/user-feedback slice.

If database import removal exposes shared export/import code that is too tangled to delete safely, preserve export behavior with focused route tests and delete import-only branches incrementally.

## Completion Protocol

For each completed issue:

- update the issue file with a short completion note or link to `docs/tasks/{task-id}.md`
- create or update `docs/tasks/{task-id}.md`
- update this file with any new assumption for the next issue
- update `IMPLEMENTATION_MAP.md` if contracts changed
- update `CHANGELOG.md` for user-facing behavior changes
- run focused tests and lints
- run GitNexus `detect_changes()` before committing
