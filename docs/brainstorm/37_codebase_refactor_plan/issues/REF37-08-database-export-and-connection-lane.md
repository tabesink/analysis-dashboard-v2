# REF37-08 — Clarify Database Export And Connection Lane

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/03_target_folder_structure.md`
- Reference: `references/07_client_refactor_plan.md`
- Reference: `references/09_testing_observability_security.md`
- Existing database export, database create/connect/delete, and admin UI tests

## Previous Slice Provides

Database import is removed or unreachable from the active product surface.

## What To Build

Make database export and database create/connect/delete read as one admin database-administration lane, separate from folder upload. Preserve admin-only enforcement and keep export progress/download behavior intact.

Use toast notifications for lightweight database administration feedback such as admin-required errors, create/connect/delete success, export start/completion, and non-blocking failures. Keep database operation dialogs for export progress, cancellation, download readiness, and any long-running status content.

## This Slice Changes

- Database operation UI/API naming that distinguishes export/connect/delete from folder upload.
- Tests proving only admins can use database export and database create/connect/delete.
- Toast notification behavior for lightweight database administration outcomes.
- Client code cleanup after import removal, without large unrelated file moves.

## This Slice Must Not Rework

- Folder upload policy or progress.
- Channel-map, schedule, damage, or Inspect Damage behavior.
- Export package internals unless naming or import removal leaves dead code.
- Broad settings/database page redesign.

## Acceptance Criteria

- [ ] Behavior tests prove database export remains admin-only.
- [ ] Behavior tests prove database create/connect/delete remain admin-only.
- [ ] Client UI labels distinguish whole-database administration from event-level folder upload.
- [ ] Export progress, cancellation, and download behavior remain compatible with existing public tests.
- [ ] Database operation dialogs remain responsible for long-running export status and download readiness.
- [ ] Toast notifications report lightweight admin-required, success, cancellation, and failure outcomes where appropriate.
- [ ] Import removal from `REF37-07` leaves no active import UI affordance.
- [ ] `docs/tasks/REF37-08.md` records behavior changed, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing database operation symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-07`

## Next Slice Can Assume

Database administration is a separate admin-only lane with export and database connection behavior preserved.
