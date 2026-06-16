# REF37-12 — Verify Golden Path And Add Minimal Observability

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/08_migration_plan.md`
- Reference: `references/09_testing_observability_security.md`
- Existing integration tests for folder upload, channel reprocess, schedule save/upload, damage calculation, Inspect Damage, and database export

## Previous Slice Provides

Server and client modules follow the lane model.

## What To Build

Add final golden-path coverage and minimal structured task observability needed to verify the refactor. Build toward the event-level path separately from database export. Keep observability modest: task events should make status, owner, task kind, scope, phase, progress, result summary, and failure reason visible to logs or task status without adding a full diagnostics panel.

Verify the user feedback contract across the golden path: lightweight validation, permission, success, cancellation, and failure messages use toast notifications, while upload and long-running operation dialogs retain detailed status content.

## This Slice Changes

- Golden-path integration coverage for event-level upload through Inspect Damage read.
- Separate database export verification.
- Minimal structured task event/status fields where missing.
- Final user feedback verification for toast notifications and operation dialogs.
- Final documentation updates marking Phase 37 ready for implementation completion.

## This Slice Must Not Rework

- Upload staging.
- Admin diagnostics panel.
- External queues or generic task runner.
- New product workflows.
- Database import.

## Acceptance Criteria

- [ ] Integration coverage verifies folder upload to raw data.
- [ ] Integration coverage verifies channel-map upload/edit to channel reprocess.
- [ ] Integration coverage verifies schedule upload/edit to damage calculation when prerequisites are ready.
- [ ] Integration coverage verifies Inspect Damage reads persisted damage rows without mutation.
- [ ] Database export coverage remains separate from the event-level golden path.
- [ ] Task status or structured logs include task owner, task kind, scope, phase, progress, terminal state, result summary, and error details where applicable.
- [ ] User feedback verification confirms toasts report lightweight validation, permission, success, cancellation, and failure outcomes.
- [ ] User feedback verification confirms dialogs still report detailed upload and long-running operation status.
- [ ] Security regression coverage confirms folder upload write/admin, contributor edit ownership, database admin operations, and removed database import behavior.
- [ ] `HANDOFF.md` is updated with final completion notes and any remaining follow-up work.
- [ ] `docs/tasks/REF37-12.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [ ] GitNexus impact analysis is run before editing task/status symbols.
- [ ] Focused tests and the agreed broader regression suite pass.

## Blocked By

- `REF37-11`

## Next Slice Can Assume

Phase 37 has end-to-end behavior coverage and any remaining work is a follow-on reliability or UX enhancement, not core refactor completion.
