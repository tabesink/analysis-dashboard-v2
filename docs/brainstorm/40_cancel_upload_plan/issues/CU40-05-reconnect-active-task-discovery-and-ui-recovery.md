# CU40-05 - Reconnect Active Task Discovery And UI Recovery

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- `docs/tasks/CU40-01.md` through `docs/tasks/CU40-04.md`
- Existing auth bootstrap, upload hook/store, derived task store, database page, and modal tests

## Previous Slice Provides

Every `upload_tasks` operation kind can be cancelled and eventually reaches a trustworthy terminal state. Status payloads include lifecycle timing and cleanup guidance.

## What To Build

Add a reconnect/recovery surface so browser close, reload, or transient network loss does not strand users behind lost modal state. The durable source of truth must be server task state, not `folderUploadInProgress`.

## This Slice Changes

- Authenticated active/recent task discovery endpoint:
  - `GET /api/v1/upload/tasks/active`
- Discovery response includes visible active tasks and recent terminal tasks needing user action.
- Discovery applies folder-upload creator scope and derived task admin-or-scope-owner scope.
- Discovery reconciles stale heartbeats before returning data.
- Client API helper and bootstrap hook for upload-task recovery.
- Folder upload UI restores active/cancelling progress after reload or shows a recovery banner with "View progress".
- Derived task UI restores active/cancelling scoped progress after reload when visible to the user.
- Terminal failed/cancelled partial uploads show cleanup/retry guidance after reconnect.
- Route/auth redirect logic no longer depends on `folderUploadInProgress` for cross-browser recovery.

## This Slice Must Not Rework

- Server cancellation semantics.
- Worker cooperative checkpoints.
- Failed/cancelled cleanup deletion scope.
- Database administration operation lanes.
- Login auth internals beyond avoiding stale UI flags.

## Acceptance Criteria

- [ ] Discovery returns current user's active folder uploads.
- [ ] Discovery does not return another user's folder upload details to unrelated users.
- [ ] Discovery returns derived tasks for admins or program/version scope owners.
- [ ] Discovery excludes derived tasks for unrelated users.
- [ ] Discovery returns recent terminal failed/cancelled folder uploads that still expose cleanup guidance.
- [ ] Discovery reconciles stale heartbeat tasks before building the response.
- [ ] Client app startup after auth bootstrap asks for recoverable upload-task operations.
- [ ] Reload/browser-close recovery restores active upload progress or presents a clear recovery banner/action.
- [ ] Reload/browser-close recovery restores active derived progress for visible scopes.
- [ ] `folderUploadInProgress` remains ephemeral and is not used as durable recovery or auth gating state.
- [ ] Focused server route tests cover discovery visibility and stale reconciliation.
- [ ] Focused client tests cover upload recovery, derived recovery, and cleanup guidance after reconnect.
- [ ] GitNexus impact analysis is run before editing discovery route, auth/bootstrap, store, hook, or modal symbols.
- [ ] `docs/tasks/CU40-05.md`, `HANDOFF.md`, `IMPLEMENTATION_MAP.md`, and `CHANGELOG.md` are updated.

## Blocked By

- `CU40-04`

## Next Slice Can Assume

Users can close/reload the browser and recover active or actionable upload-task operations from server state.

