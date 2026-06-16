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

1. `REF37-01-folder-upload-write-permission.md`
2. `REF37-02-server-upload-policy-contract.md`
3. `REF37-03-client-upload-policy-and-metadata.md`
4. `REF37-04-folder-upload-progress-and-cancellation.md`
5. `REF37-05-derived-lane-command-query-boundaries.md`
6. `REF37-06-contributor-edit-policy.md`
7. `REF37-07-remove-database-import.md`
8. `REF37-08-database-export-and-connection-lane.md`
9. `REF37-09-task-kind-reconciliation.md`
10. `REF37-10-server-orchestration-cleanup.md`
11. `REF37-11-client-module-migration.md`
12. `REF37-12-golden-path-and-observability.md`

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
