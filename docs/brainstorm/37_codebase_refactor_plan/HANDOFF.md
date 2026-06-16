# Phase 37 Handoff

## Mission

Implement the upload, derived-data, and database-management refactor in small TDD slices. Keep the product behavior stable while making the lanes explicit and testable.

## Required Reading

1. `docs/brainstorm/37_codebase_refactor_plan/prd.md`
2. `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
3. The current issue file under `docs/brainstorm/37_codebase_refactor_plan/issues/`
4. Reference docs only when deeper rationale is needed: `docs/brainstorm/37_codebase_refactor_plan/references/`
5. Repo agent rules in `AGENTS.md`

## Issue Order

1. `REF37-01-folder-upload-write-permission.md` (DONE 2026-06-16)
2. `REF37-02-server-upload-policy-contract.md` (DONE 2026-06-16)
3. `REF37-03-client-upload-policy-and-metadata.md` (DONE 2026-06-16)
4. `REF37-04-folder-upload-progress-and-cancellation.md` (DONE 2026-06-16)
5. `REF37-05-derived-lane-command-query-boundaries.md` (DONE 2026-06-16)
6. `REF37-06-contributor-edit-policy.md` (DONE 2026-06-16)
7. `REF37-07-remove-database-import.md` (DONE 2026-06-16)
8. `REF37-08-database-export-and-connection-lane.md` (DONE 2026-06-16)
9. `REF37-09-task-kind-reconciliation.md` (DONE 2026-06-16)
10. `REF37-10-server-orchestration-cleanup.md` (DONE 2026-06-16)
11. `REF37-11-client-module-migration.md` (DONE 2026-06-16)
12. `REF37-12-golden-path-and-observability.md` (DONE 2026-06-16)

## Current Baton

- Phase 37 issue chain is complete through `REF37-12`.
- `REF37-08` completed database-administration lane clarification:
  - list/connect/create/delete/export routes are now consistently admin-only.
  - admin settings copy explicitly frames whole-database administration as separate from folder upload.
  - export keeps modal-owned long-running status and now adds lightweight toasts for start/cancel/failure/completion.
- `REF37-09` completed task-kind/reconciliation hardening:
  - shared task-kind constants now define active folder/derived/database-export task kinds and removed `database_import`.
  - startup backfills now terminalize stale active upload/derived tasks (`queued`/`running` -> `failed/failed`) with restart-safe error semantics.
  - one-active-derived-task-per-program/version behavior remains enforced and stale restarted rows no longer block new work.
- `REF37-10` completed thin dashboard route orchestration extraction:
  - added `server/services/dashboard_orchestration.py` for contributor-edit permission checks, channel-map upload/save orchestration, and schedule damage-extension mapping.
  - dashboard channel-map/schedule routes now focus on auth/input/error mapping and delegate orchestration logic to service helpers.
  - route paths and response contracts are unchanged; existing route tests remain the coverage anchor.
- `REF37-11` completed client lane import migration:
  - added lane-oriented client entry points for upload, datasets, and database portability (`client/src/features/database/*`).
  - migrated active `/database`, settings, edit-metadata, inspect-damage-table, and scope-delete imports away from generic `@/components/upload/*` paths.
  - removed deprecated `UploadSidePanel` and `UploadContent` wrappers after confirming no active imports remained.
- `REF37-12` completed final golden-path/observability wrap-up:
  - upload task polling/SSE payload now exposes minimal structured observability (`task_owner_user_id`, `task_kind`, `scope`, `terminal_state`, `result_summary`, `error_details`) without breaking existing fields.
  - upload-router test coverage now verifies completed and failed task observability payload semantics.
  - event-level lane behavior and separate database-export lane verification remain covered by existing focused route tests; follow-on work is reliability/UX hardening rather than core Phase 37 boundary refactor.

## Resolved Product Decisions

- Folder upload is a write path and must require write/admin permission.
- Contributors with write permission can edit channel-map and schedule data only for datasets they uploaded.
- Contributors cannot edit or delete event channel-map or schedule data uploaded by someone else.
- Admins have CRUD permission for uploaded data.
- Only admins can create, connect, delete, and export databases.
- Database import is removed from the active product surface.
- Inspect Damage remains read-only. Explicit backfill remains the visible repair command.
- Toast notifications are the canonical lightweight user feedback channel for validation, permission, success, cancellation, and non-blocking error information.
- Upload and long-running operation dialogs remain the detailed status surface for progress, current phase, retry/cancel affordances, and terminal summaries.

## TDD Operating Notes

Use one red-green-refactor behavior at a time. Favor public route tests, hook/API helper tests, and pure policy tests. Do not write a broad test matrix before implementation.

Before editing code symbols, run GitNexus impact analysis for the target symbol and report the blast radius. Before committing, run GitNexus `detect_changes()` and focused tests.

## Recovery Notes

If an issue reveals a larger product decision, stop after the current green test and update this handoff with the blocker.

If a file move exposes stale imports, preserve compatibility exports until the active route/page has tests proving behavior parity.

If progress reporting still flip-flops after task-kind ordering is applied, do not invent client-side progress. Capture the backend task events needed to render a stable sequence and update `IMPLEMENTATION_MAP.md`.

## Completion Protocol

For each completed issue:

- update the issue file with a short completion note or link to `docs/tasks/{task-id}.md`
- create or update `docs/tasks/{task-id}.md`
- update this file with any new assumption for the next issue
- update `IMPLEMENTATION_MAP.md` if contracts changed
- run focused tests and lints
- run GitNexus `detect_changes()` before committing
