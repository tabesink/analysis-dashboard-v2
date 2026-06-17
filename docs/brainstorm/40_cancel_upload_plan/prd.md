# Phase 40 PRD - Cancel And Recover Upload-Task Operations

## Problem

Long-running upload-task operations can outlive the browser tab that started them. The current UI can block dismissal while work is active, but browser close, lost network, or a Cancel click does not reliably stop server work. For folder upload especially, the user can see a non-dismissible progress dialog with a Cancel button that only aborts client-side upload/polling while the backend thread may keep ingesting data.

This creates three user-visible failures:

- Cancel feels broken because the operation keeps running after the button is clicked.
- A returning user cannot reliably rediscover an active or recently terminal task after closing the browser.
- Active or stale upload-task rows can block database administration and make auth/database routes feel unavailable.

## Goals

- Add a shared upload-task lifecycle contract for every task stored in `upload_tasks`: `folder_upload`, `channel_reprocess`, and `damage_calculation`.
- Make Cancel a real server-side request with owner/admin authorization and clear terminal semantics.
- Make long-running task code cooperatively stop at safe checkpoints.
- Let users reconnect to active task status after browser close or reload.
- Fail stale active tasks closed when their worker heartbeat expires, not only after backend restart.
- Keep login/auth usable during long-running upload-task work.
- Preserve Phase 39 cleanup/retry safety for partial folder uploads.

## Non-Goals

- Do not add Celery, Redis, RQ, or another external queue.
- Do not implement restart-resumable upload jobs.
- Do not promise instant cancellation during an in-flight DuckDB write.
- Do not make folder upload task details visible to unrelated users.
- Do not merge database export/import style tasks into the upload-task contract in this phase.
- Do not redesign the upload UI beyond required lifecycle and recovery messaging.

## Users And Operators

- Uploading users need Cancel to stop future work and give a trustworthy result.
- Returning users need the app to restore active progress or show a terminal summary after a browser close.
- Admins need database switch/delete/export behavior to distinguish truly active work from stale abandoned tasks.
- Operators need status payloads and logs that explain task kind, owner, scope, phase, cancel state, heartbeat freshness, terminal state, and cleanup guidance.

## Desired Experience

When a user clicks Cancel during a folder upload:

1. The client sends a server-side cancel request for the task id.
2. The modal changes to "Cancelling safely..." and remains visible.
3. The worker stops at the next safe checkpoint.
4. If no data was committed, the task becomes `cancelled` with no cleanup required.
5. If partial data was committed, the task becomes `cancelled` with cleanup/retry guidance equivalent to failed partial upload guidance.

When a user closes the browser and returns:

1. Login and the app shell remain reachable.
2. The client discovers active/recent upload-task operations owned by the user.
3. Active tasks reopen progress or show a recoverable banner.
4. Terminal tasks show summary, cleanup, or retry guidance.
5. Stale tasks with expired worker heartbeat are terminalized before they can indefinitely block admission.

## Success Metrics

- Cancel route tests prove owner/admin cancellation and unrelated-user denial.
- Ingestion and derived task tests prove cancellation is observed at safe checkpoints.
- Browser-close/reload UI tests prove active task discovery restores status without relying on ephemeral Zustand flags.
- Admission tests prove stale heartbeat tasks no longer block database switch/delete indefinitely.
- Login route tests prove authentication is not blocked by active dashboard DB write contention.

