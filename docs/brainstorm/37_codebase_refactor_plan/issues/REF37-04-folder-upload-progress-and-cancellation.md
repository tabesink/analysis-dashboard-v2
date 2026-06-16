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

- [ ] Progress tests prove folder-upload phases are displayed in the backend order defined by `IMPLEMENTATION_MAP.md`.
- [ ] Progress tests prove downstream task progress is not rendered as folder-upload progress.
- [ ] Polling tests cover transient backend unavailability and a user-readable recovery/failure state.
- [ ] Terminal summary tests cover completed, failed, and cancelled states where cancellation is supported.
- [ ] The operation dialog remains the source of detailed upload status, progress, retry/cancel affordances, and terminal summaries.
- [ ] Toast notifications are used only for lightweight high-level outcomes and do not replace status content in the dialog.
- [ ] Cancellation either uses an existing route/hook contract or documents the new minimal public contract before implementation.
- [ ] UI progress components render task state and do not infer backend workflow rules.
- [ ] `IMPLEMENTATION_MAP.md` is updated if progress state names change.
- [ ] `docs/tasks/REF37-04.md` records behavior changed, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing hook/API/route symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-03`

## Next Slice Can Assume

Folder-upload status is reliable enough to separate downstream derived-data progress from raw-data ingestion progress.
