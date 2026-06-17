# Phase 39 PRD — Operation Lifecycle Hardening

## Problem Statement

Phase 37 clarified the upload, derived-data, and database-administration lanes, but long-running operations still have lifecycle risks that can confuse users or create avoidable concurrency hazards.

The app is intended for a small team of roughly 5-10 users. A full durable queue with restart-resumable idempotent phases would overbuild the system. The product needs a lighter hardening pass: remove remaining legacy database import code, fail interrupted operations honestly after restart, let users clean up failed partial uploads before retrying, prevent conflicting derived/database operations, and block database switching while users are actively using the app.

## Solution

Introduce a lightweight operation lifecycle model around the existing modular monolith:

1. Remove the legacy database import path completely while keeping database create, switch, delete, and export as exclusive admin operations.
2. Keep folder upload task polling creator-scoped.
3. Make derived task start/reuse/poll authorization scope-based: admins or the uploader/owner of the program/version only.
4. Add bounded in-process operation control with per-scope and exclusive database-operation guards. Do not add Celery, Redis, or restart-resumable durable workers.
5. On backend restart, mark previously running operations failed and guide the user to retry or clean up.
6. Add cleanup for failed partial folder uploads so users can re-upload the same dataset without confusing duplicate-file failures.
7. Add active-user presence and block admin database switch when other users are active, returning usernames for toast notification.
8. Make active progress dialogs non-dismissible unless a real cancel path exists.

## User Stories

1. As an admin, I want database import removed from the app and API surface, so that risky restore behavior is not available as a hidden legacy path.
2. As an admin, I want database create, switch, delete, and export to remain admin-only, so that whole-database operations stay controlled.
3. As an admin, I want database switch/delete blocked while users or mutating operations are active, so that I do not disrupt active work.
4. As an admin, I want a toast naming active users when database switch is blocked, so that I know who to coordinate with.
5. As a contributor, I want a failed or interrupted upload to give clear cleanup/retry guidance, so that I can re-upload without duplicate-file confusion.
6. As a contributor, I want upload task status to remain visible only to the user who started that upload, so that in-progress file details are not exposed.
7. As a contributor, I want to start, reuse, and poll derived tasks only for program/version scopes I uploaded, so that my own data can be maintained safely.
8. As an admin, I want to start, reuse, and poll derived tasks for any program/version scope, so that I can operate and repair shared data.
9. As a user watching a long-running operation, I want the progress dialog to stay open while work is active, so that work is not hidden with no status surface.
10. As an operator, I want server-restarted tasks to fail closed instead of pretending to continue, so that task state remains honest.
11. As a coding agent, I want operation lifecycle rules captured in small issue batons, so that implementation can proceed without broad rewrites.

## Implementation Decisions

- Keep the app as a FastAPI, DuckDB, Next.js modular monolith.
- Do not introduce an external queue, Redis, Celery, RQ, or restart-resumable durable worker system.
- Use the existing `upload_tasks` table as the canonical status surface for folder upload and derived-data tasks unless a slice proves a narrower operation table is needed.
- Startup reconciliation should mark active `queued` or `running` operations as failed with clear retry/cleanup guidance.
- Folder upload polling remains creator-scoped.
- Derived task polling changes from creator-scoped to scope-authorized. A user can poll a derived task when they are an admin or when they own/uploaded the underlying program/version scope.
- Derived task start/reuse must use the same scope authorization as polling. Unauthorized users must not receive or reuse another uploader's task id.
- Preserve one active derived task per program/version scope.
- Bounded in-process operation control should be intentionally small: admission checks and a limited local runner are acceptable; durable lease/retry recovery is not.
- Database switch/delete are exclusive database-administration operations. They must be blocked by active users, active uploads, active derived tasks, and other exclusive admin operations.
- Database export remains admin-only. It may run as a long-running operation, but it must not be confused with folder upload.
- Failed partial folder uploads should have a cleanup path that removes committed partial data from the failed task before retry. Re-upload should not silently create duplicate sibling events.
- Active-user presence should be lightweight and host-local. Existing saved sessions are not enough because they can outlive active browser use.
- Presence should expose active usernames to admin database-switch responses. The client should show those names in a toast.
- Active progress dialogs should not expose "close and continue in background" for operations that have no durable status surface after dismissal. If cancellation is supported, show cancel; otherwise keep the modal open until terminal state.

## Testing Decisions

- Use TDD tracer bullets: one public behavior test, minimal implementation, refactor while green.
- Do not use horizontal slices. Agents must not write all tests first and then all implementation.
- Each test should verify observable behavior through a public interface and should survive internal refactors.
- Prefer server route tests for authorization, database-switch blocking, startup reconciliation, and cleanup behavior.
- Prefer focused service tests for operation admission decisions and failed-upload cleanup.
- Prefer client hook/component tests for non-dismissible progress dialogs and database-switch blocked toasts.
- Add regression coverage for the existing derived-task edge: an admin or scope owner can poll a reused derived task; unrelated users cannot.
- Add regression coverage that folder upload task polling remains creator-scoped.
- Add regression coverage that database import endpoints/client paths are removed or return the agreed gone/unavailable behavior until fully deleted.
- Do not build a large imagined matrix before implementation.

## Out of Scope

- Restart-resumable jobs.
- A durable distributed queue.
- Multi-process worker orchestration.
- A full admin diagnostics dashboard.
- Replacing DuckDB.
- Allowing database import as a fallback.
- Letting non-admin users run derived tasks for program/version scopes they did not upload.
- Force-switching databases while users are active.

## Further Notes

The key engineering trade-off is deliberate simplicity: fail closed after restart and make cleanup/retry reliable, rather than making every task phase idempotent and resumable.

This PRD continues the Phase 37 lane model. Phase 39 should harden operation lifecycle behavior without re-merging folder upload, derived data, and database administration into a generic upload/task abstraction.
