# OP39-06 — Keep Active Progress Dialogs Non-Dismissible

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Existing upload operation modal, derived-data operation modal, database operation modal, and toast/dialog tests

## Previous Slice Provides

Database switch blocking and operation admission responses are available. Active operation behavior is clearer and safer.

## What To Build

Make active long-running progress dialogs non-dismissible unless a real cancel path exists and the user explicitly cancels.

Remove the "Close and continue in background" behavior from active derived-data progress. Keep detailed progress visible until terminal state. Terminal summaries remain closeable.

## This Slice Changes

- Derived-data progress modal close behavior and footer copy/actions.
- Upload/database operation modal consistency if any active close escape remains.
- Client tests for escape/backdrop/X/open-change blocking while active.
- Toast/dialog tests where progress outcomes are announced.

## This Slice Must Not Rework

- Server operation lifecycle.
- Active-user presence.
- Folder upload cleanup.
- Derived-task authorization.
- Visual redesign beyond required copy/action removal.

## Acceptance Criteria

- [x] Active channel reprocess progress cannot be dismissed through close button, escape, backdrop, or open-change callback.
- [x] Active damage calculation progress follows the same non-dismissible rule.
- [x] The "Closing this dialog..." label is removed from active derived-data progress.
- [x] The "Close and continue in background" button is removed from active derived-data progress.
- [x] Upload/import data active progress remains non-dismissible.
- [x] Database export active progress remains consistent with the operation lifecycle contract.
- [x] If cancel is displayed for any active operation, it maps to a real supported cancel path.
- [x] Terminal summary dialogs remain closeable.
- [x] Tests cover active and terminal modal behavior.
- [x] `docs/tasks/OP39-06.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] GitNexus impact analysis is run before editing modal or operation hook symbols.
- [x] Focused tests pass.

## Blocked By

- `OP39-05`

## Next Slice Can Assume

Active operation progress remains visible until terminal state, and lightweight toasts supplement rather than replace detailed dialogs.

## Completion Notes

- Derived-data progress dialogs now block dismissal while active and no longer show background-dismiss copy/action.
- Upload and database export modal tests now explicitly verify active non-dismissible behavior and summary closeability.
- Focused tests passed: `DerivedDataOperationModal.test.tsx`, `UploadOperationModal.test.tsx`, and `DatabaseOperationModal.test.tsx`.
