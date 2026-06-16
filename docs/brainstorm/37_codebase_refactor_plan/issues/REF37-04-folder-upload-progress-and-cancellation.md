# REF37-04 — Stabilize Folder Upload Progress And Cancellation

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/05_upload_lane_design.md`
- Reference: `references/09_testing_observability_security.md`
- Existing folder-upload polling/SSE API, upload hooks, and operation modal tests

## Previous Slice Provides

Folder-upload classification and metadata behavior are shared and tested on the client.

## What To Build

Make folder-upload progress reporting stable, task-kind aware, and failure-aware. The upload operation modal should remain the detailed status surface and should not show downstream task percentages as if they were upstream folder-upload progress. If backend services become unavailable during polling, users should see a clear transient or terminal failure state in the dialog, with toast notifications reserved for high-level start, completion, cancellation, retry, or failure feedback. If the existing public hook supports cancellation, wire it through consistently; if not, define the smallest route/hook contract needed for explicit cancellation before implementing.

## This Slice Changes

- Folder-upload progress normalization.
- Polling failure behavior.
- Cancellation behavior where supported by existing public contracts.
- Toast notifications for high-level upload outcomes where appropriate.
- Tests around sequential progress, backend unavailability, terminal summaries, and cancellation.

## This Slice Must Not Rework

- Channel-map reprocess semantics.
- Damage calculation semantics.
- Generic task runner design.
- File staging.
- Broad client module moves.

## Acceptance Criteria

- [x] Progress tests prove folder-upload phases are displayed in the backend order defined by `IMPLEMENTATION_MAP.md`.
- [x] Progress tests prove downstream task progress is not rendered as folder-upload progress.
- [x] Polling tests cover transient backend unavailability and a user-readable recovery/failure state.
- [x] Terminal summary tests cover completed, failed, and cancelled states where cancellation is supported.
- [x] The operation dialog remains the source of detailed upload status, progress, retry/cancel affordances, and terminal summaries.
- [x] Toast notifications are used only for lightweight high-level outcomes and do not replace status content in the dialog.
- [x] Cancellation either uses an existing route/hook contract or documents the new minimal public contract before implementation.
- [x] UI progress components render task state and do not infer backend workflow rules.
- [x] `IMPLEMENTATION_MAP.md` is updated if progress state names change.
- [x] `docs/tasks/REF37-04.md` records behavior changed, interfaces changed, and tests added.
- [x] GitNexus impact analysis is run before editing hook/API/route symbols.
- [x] Focused tests pass.

## Blocked By

- `REF37-03`

## Completion Note (2026-06-16)

Implemented upload progress normalization and cancellation UX hardening in the existing client upload contract: upload progress now tracks backend folder phases (`upload_received`, `converting`, `validating`, `writing`) monotonically, ignores non-folder task updates, preserves transient connection-loss messaging from polling, and keeps detailed status in the operation dialog while using high-level toasts for start/completion/failure/cancel events. Cancellation uses the existing `useUpload` hook abort contract and now lands in an explicit cancelled terminal summary. Coverage added in `client/src/hooks/use-upload.test.ts`, `client/src/features/database-upload/upload-completion-result.test.ts`, and existing polling coverage in `client/src/lib/api/upload.test.ts`; details are recorded in `docs/tasks/REF37-04.md`.

## Next Slice Can Assume

Folder-upload status is reliable enough to separate downstream derived-data progress from raw-data ingestion progress.
