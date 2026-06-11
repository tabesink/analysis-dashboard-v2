# Assign Channels progress dialog (AC-25)

## Problem Statement

When a user saves channel assignments in Edit Metadata, the app briefly shows a loading toast that dismisses as soon as the save API returns. Long-running work—raw load-history extraction and cross-plot LTTB generation—continues on the server, but the primary feedback feels like a fleeting toast rather than a durable, canonical progress experience.

The backend async `channel_reprocess` task and a derived-data progress modal were added in UP-24, but the Assign Channels UX still leads with toast noise, mounts the progress modal inside the metadata editor shell, and shares the same stacking layer as the editor dialog. Users who close Edit Metadata or navigate elsewhere on the Database page lose the progress dialog even though processing continues. That mismatch makes background work invisible and undermines confidence that channel assignment succeeded.

Engineers need the same predictable, import-data-style operation dialog used for folder upload: a focused modal with phase stepper, live messages, elapsed time, close-without-cancel semantics, and a completion summary—without adding a second progress system or increasing technical entropy.

## Solution

Finish the Assign Channels progress experience by aligning it with the existing import upload operation pattern, reusing the derived-data modal and store already built for UP-24 rather than inventing new UI.

Manual Assign Channels save and channel-map YAML upload should open the derived-data progress modal immediately after the start API returns a `channel_reprocess` task id. Remove transitional save/upload loading toasts so the modal is the single source of truth for in-flight work. Mount the modal at the Database page shell level alongside the existing upload operation modal so it remains visible above Edit Metadata, survives closing the metadata editor, and stays available while the user remains on the Database page.

While processing runs and the modal is dismissed, show scoped reopen affordances: the existing inline banner inside Edit Metadata when that dialog is open, and a lightweight database-page banner when Edit Metadata is closed but a channel reprocess task is still running for a program/version the user can act on. Closing the modal must not cancel server work; completion should still invalidate the same downstream queries as today and present a summary screen for success, partial failure, or hard failure.

Keep the implementation lean: no new task types, no new polling endpoints, no duplicate modal components, and no global app-shell task center.

## User Stories

1. As a database user, I want Assign Channels save to open a progress dialog like import data upload, so that I immediately see that long-running work started.
2. As a database user, I want channel-map YAML upload to use the same progress dialog, so that both channel assignment paths behave consistently.
3. As a database user, I want the progress dialog to show validating, extracting, and generating phases, so that I understand what the server is doing.
4. As a database user, I want live progress messages naming the current artifact, event, plot, and row counts, so that I know which file is being processed.
5. As a database user, I want a progress bar and percentage during channel reprocess, so that I can tell work is advancing on large program versions.
6. As a database user, I want elapsed time in the dialog header, so that I can gauge how long channel reprocess has been running.
7. As a database user, I want the dialog to explain that closing it does not cancel processing, so that I do not mistake dismiss for cancellation.
8. As a database user, I want a Close and continue in background action, so that I can return to the database table while work continues.
9. As a database user, I want the progress dialog to stay visible above the metadata editor, so that it is not hidden behind the larger Edit Metadata dialog.
10. As a database user, I want the progress dialog to remain available after I close Edit Metadata, so that I can reopen progress without re-saving channel assignments.
11. As a database user, I want an inline banner in Edit Metadata while channel reprocess runs in the background, so that I can reopen progress from the Assign Channels section.
12. As a database user, I want a database-page banner when Edit Metadata is closed but channel reprocess is still running, so that background work is not invisible.
13. As a database user, I want the database-page banner to identify the program/version being processed, so that I know which scope is active.
14. As a database user, I want Reopen progress on the banner to restore the same modal, so that I do not start duplicate work.
15. As a database user, I want starting another Assign Channels save while a task is active to reopen the existing task, so that duplicate competing writes do not start.
16. As a database user, I want a completion summary after channel reprocess finishes, so that I know whether all artifacts succeeded or some failed.
17. As a database user, I want partial-failure summaries to show processed and failed artifact counts, so that I can decide whether to inspect problem events.
18. As a database user, I want successful completion to refresh channel-map and related table data automatically, so that the UI reflects new derived data without manual refresh.
19. As a write user, I want no misleading success toast before reprocess completes, so that I do not assume cross-plot data is ready too early.
20. As a read-only user, I want to see active channel reprocess state without write actions, so that I understand the database is still processing even if I cannot save channel maps.
21. As an engineer, I want Assign Channels save to return quickly with only a task id, so that the browser does not block on large reprocessing work.
22. As an engineer, I want progress polling to use the existing derived-data task endpoint, so that the app does not add another polling contract.
23. As an engineer, I want one modal component for derived-data tasks, so that channel reprocess and damage calculation do not diverge visually.
24. As an engineer, I want one store mapping server task events to UI progress, so that phase bands and live messages stay consistent.
25. As an engineer, I want the modal mounted once at the Database page shell, so that lifecycle is identical to the import upload modal.
26. As a developer, I want client tests proving save and upload open the shell-mounted modal, so that regressions back to toast-only feedback are caught.
27. As a developer, I want client tests proving dismiss/reopen and banner behavior, so that background processing UX stays reliable.
28. As a developer, I want client tests proving active-task reuse, so that duplicate polls and duplicate tasks do not reappear.
29. As a database user, I want the progress dialog visual treatment to match import upload and scope delete modals, so that long-running database operations feel consistent.
30. As a database user, I want reset and unrelated toast success messages to remain for non-processing actions, so that only save/upload progress moves to the dialog.

## Implementation Decisions

- This PRD completes the Assign Channels UX gap left after UP-24-02. It does not change server task orchestration, task storage, or channel reprocess business logic unless a minimal wiring fix is required for modal visibility.
- Reuse the existing derived-data operation modal, derived-data progress panel, channel reprocess store, and derived-task progress mapper. Do not create a second channel-specific modal or stepper.
- Remove `toast.loading` / `toast.dismiss` around Assign Channels save and channel-map YAML upload success paths. Keep `toast.error` for validation and API failures before a task starts. Keep unrelated toasts such as reset and pre-reset restore.
- Mount channel reprocess modal rendering at the Database page shell next to the existing upload operation modal, driven by the channel reprocess store. Do not duplicate modal instances in both the metadata editor and the page shell.
- Elevate derived-data operation modal stacking above Edit Metadata. Prefer a single shared z-index convention for shell operation modals rather than per-feature overrides scattered in feature code.
- When Edit Metadata is open, keep the scoped inline banner behavior from UP-24-02. When Edit Metadata is closed and a channel reprocess task is still running, show a compact database-page banner with program/version label and Reopen progress.
- The database-page banner should appear only while `status === running` and the modal is dismissed. It should not appear after completion unless the summary step has not yet been acknowledged; summary acknowledgment clears scoped store state as today.
- Modal close during progress sets `modalOpen = false` only. Polling continues until completion or failure. No cancel endpoint call.
- Active-task reuse remains: if save/upload receives the same active `channel_reprocess` task id, reopen the existing modal and resume polling without creating a second poll loop.
- Progress mapping remains coarse phase bands plus server `progress_message`, `completed_events`, and `total_events`. No per-plot or per-channel counters in UI or API.
- Locked live message vocabulary remains the UP-24 strings for validating artifacts, extracting raw load histories, and generating cross-plot data.
- Query invalidation remains on task completion via the existing channel-map save cache invalidation helper. Do not reintroduce immediate invalidation on save response.
- Deep modules to touch, all existing:
  - Assign Channels panel — trigger task tracking without toast-based progress.
  - Channel reprocess store — source of truth for modal, banner, polling, and completion summary.
  - Derived-data operation modal shell — shared visual/interaction pattern with upload import modal.
  - Database page shell — host operation modals and optional page-level banner.
  - Metadata edit dialog — retain section inline banner; remove duplicate modal mount.
- Out of scope for new abstractions: a generic operation-modal factory, a global task center, SSE, or a unified reducer across upload and derived tasks in this slice.

## Testing Decisions

- Test externally visible behavior, not private poll loop internals. Good tests assert which UI opens, what message/phase the user sees after mocked task events, and which queries invalidate after completion.
- Extend or add client tests for:
  - Assign Channels save opens shell-mounted derived-data modal with initial progress state.
  - Channel-map YAML upload opens the same modal.
  - No save/upload loading toast is emitted on success paths.
  - Modal stacks above metadata editor content in integration/DOM order tests where practical.
  - Close and continue in background hides modal but keeps polling updates in store.
  - Edit Metadata inline banner reopens modal.
  - Database-page banner appears when metadata editor is closed and task is running.
  - Active-task reuse reopens existing modal without duplicate poll registration.
  - Completion summary for success, partial failure, and hard failure.
- Prior art: `DerivedDataOperationModal.test.tsx`, `channel-reprocess-store.test.ts`, `ChannelReprocessBanner.test.tsx`, upload operation modal tests, and channel-map save/upload tests.
- Skip new server tests unless a wiring bug requires a minimal router regression. Server channel reprocess behavior is already covered by UP-24-01.

## Out of Scope

- New backend task types, schema changes, or channel reprocess algorithm changes.
- Cooperative or hard cancellation of channel reprocess.
- Global app-shell background task center beyond a single scoped database-page banner.
- Unifying upload and derived-data modals into one mega-component in this PRD.
- Damage calculation progress changes beyond shared modal stacking/mount conventions.
- Per-plot or per-channel stored progress counters.
- Changing channel-map domain model, YAML format, or LTTB algorithm.
- Navigation persistence outside the Database page; if the user leaves the Database route, background processing may continue server-side without a page-level banner on other routes.
- Replacing sonner toasts globally or redesigning non-assign-channels toast usage.

## Further Notes

- UP-24 introduced the right backend and modal primitives; this PRD closes the product gap where users still perceive toast-only feedback and lose visibility when the metadata editor closes.
- Lean implementation target: remove toast noise, relocate modal mount, fix stacking, add one page-level banner, and delete duplicate modal mount—likely a small diff if no new abstractions are introduced.
- If z-index elevation is done once for shell operation modals, apply the same rule to damage calculation modal hosting so derived-data tasks do not regress visually.
- Future work on a global task center or cross-route persistence should build on database-improvement roadmap items rather than expanding this slice.
