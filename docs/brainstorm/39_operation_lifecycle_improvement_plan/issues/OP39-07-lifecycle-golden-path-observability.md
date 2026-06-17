# OP39-07 — Verify Lifecycle Golden Path And Observability

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Completion notes from `OP39-01` through `OP39-06`
- Existing integration tests for upload, derived-data, damage, database export, and settings/database administration

## Previous Slice Provides

Import removal, derived-task authorization, failed-upload cleanup, operation admission, active-user switch blocking, and non-dismissible progress dialogs are implemented.

## What To Build

Add final focused coverage and documentation updates proving the hardened operation lifecycle behaves coherently across the supported workflows.

Keep observability modest: task/status payloads and logs should make operation kind, owner/scope, phase, terminal state, block reason, cleanup guidance, and active-user blockers visible without adding a diagnostics dashboard.

## This Slice Changes

- End-to-end lifecycle regression coverage across supported operations.
- Minimal structured status/log fields where gaps remain.
- Final `HANDOFF.md`, `IMPLEMENTATION_MAP.md`, and task completion updates.
- Changelog entries for user-facing operation lifecycle behavior.

## This Slice Must Not Rework

- New operation infrastructure.
- Durable queues.
- Database import.
- UI redesign beyond lifecycle messaging gaps.
- New admin diagnostics panel.

## Acceptance Criteria

- [x] Regression coverage verifies database import is absent/unavailable and export still works.
- [x] Regression coverage verifies failed upload cleanup then re-upload.
- [x] Regression coverage verifies folder upload task polling remains creator-scoped.
- [x] Regression coverage verifies derived task polling is admin-or-scope-owner authorized.
- [x] Regression coverage verifies database switch is blocked by active operations.
- [x] Regression coverage verifies database switch is blocked by active users and reports usernames.
- [x] Regression coverage verifies active progress dialogs cannot be dismissed and summaries can be closed.
- [x] Task/status payloads or structured logs include enough context for operation kind, owner/scope, phase, terminal state, block reason, and cleanup guidance.
- [x] `HANDOFF.md` is updated with final completion notes and any remaining follow-up work.
- [x] `IMPLEMENTATION_MAP.md` is updated if any lifecycle contract changed during implementation.
- [x] `docs/tasks/OP39-07.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] `CHANGELOG.md` documents user-facing lifecycle hardening.
- [x] GitNexus impact analysis is run before editing task/status symbols.
- [x] Focused tests and the agreed broader regression suite pass.

## Blocked By

- `OP39-06`

## Next Slice Can Assume

Phase 39 operation lifecycle hardening is complete. Any remaining work should be explicit follow-on UX, diagnostics, or performance work rather than core lifecycle safety.

## Completion Notes

- Verified the lifecycle golden path with focused regression suites spanning import-removal compatibility stubs, failed-upload cleanup/retry semantics, creator-scoped folder polling, scope-authorized derived polling, switch admission blockers, active-user presence blockers, and active non-dismissible progress dialogs.
- Added explicit route regression coverage for failed-upload cleanup/retry (`test_failed_folder_upload_cleanup_allows_reuploading_same_file_hash`) to prove duplicate-hash re-upload fails before cleanup and succeeds after cleanup.
- Confirmed observability contract coverage remains coherent across upload task payloads and admission blocker payloads:
  - upload task payload fields (`task_kind`, `task_owner_user_id`, `scope`, `phase`, `terminal_state`, `error_details.cleanup_required`, `error_details.retry_guidance`)
  - operation blocker payload fields (`operation`, `reason`, optional `scope`, optional `usernames`)
- Ran GitNexus impact analysis for task/status symbol `_build_upload_task_event` before final task-status documentation updates (`risk=LOW`, `direct callers=2`, `modules affected=1`).
- Focused regression runs passed:
  - `uv run pytest tests/server/routers/test_export_router.py tests/server/routers/test_upload_router.py tests/server/routers/test_dashboard_router.py tests/server/routers/test_damage_router.py tests/server/routers/test_auth_routes.py tests/server/unit/routers/test_upload_policies.py`
  - `npm run test -- src/features/database-upload/UploadOperationModal.test.tsx src/components/upload/DatabaseOperationModal.test.tsx src/features/edit-metadata/__tests__/DerivedDataOperationModal.test.tsx`
