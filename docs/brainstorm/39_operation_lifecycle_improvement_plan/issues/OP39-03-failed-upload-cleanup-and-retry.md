# OP39-03 — Failed Upload Cleanup And Safe Retry

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Phase 37 folder-upload progress and observability notes:
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-04-folder-upload-progress-and-cancellation.md`
  - `docs/brainstorm/37_codebase_refactor_plan/issues/REF37-12-golden-path-and-observability.md`
- Existing upload router, ingestion, storage, and upload hook tests

## Previous Slice Provides

Derived task access is scope-authorized and folder upload task status remains creator-scoped.

## What To Build

Make failed or interrupted folder uploads safely retryable without implementing restart-resumable upload jobs.

When a folder upload fails after partial commits, the uploader or an admin should be able to clean up data associated with that failed task. After cleanup, re-uploading the same dataset should not fail due to duplicate hashes left by the failed attempt.

## This Slice Changes

- Failed upload task result/status metadata needed to identify committed partial data.
- Cleanup endpoint/service behavior for failed folder upload tasks.
- Client/API helper behavior for showing cleanup/retry guidance.
- Tests proving cleanup is owner/admin-only and does not delete unrelated successful data.

## This Slice Must Not Rework

- Successful upload behavior.
- Channel reprocess or damage calculation behavior.
- Database administration.
- External queue/retry infrastructure.
- Scope delete behavior beyond what cleanup needs for failed task ownership.

## Acceptance Criteria

- [x] Failed/interrupted folder upload status clearly reports that cleanup may be needed before retry.
- [x] The uploader can clean up partial data from their failed folder upload task.
- [x] An admin can clean up partial data from any failed folder upload task.
- [x] An unrelated user cannot clean up another user's failed folder upload task.
- [x] Cleanup removes only data associated with the failed task's committed partial events/artifacts.
- [x] Cleanup does not remove successful unrelated data from the same program/version.
- [x] Re-uploading the same files after cleanup no longer fails due to duplicate hashes from the failed attempt.
- [x] Startup-reconciled failed folder uploads expose the same cleanup/retry guidance.
- [x] `docs/tasks/OP39-03.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [ ] GitNexus impact analysis is run before editing upload, ingestion, or cleanup symbols.
- [x] Focused tests pass.

## Blocked By

- `OP39-02`

## Next Slice Can Assume

Failed partial folder uploads can be cleaned up by the owner/admin and retried without adding durable upload resume.

## Completion Note

Implemented on 2026-06-17. See `docs/tasks/OP39-03.md` for behavior, interfaces, tests, and residual risks.
