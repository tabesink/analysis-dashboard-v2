## Problem Statement

Database users can click the pencil icon on a program/version row to open the inline metadata popup dialog. That dialog now keeps the user in table context for **Edit Metadata** and **Assign Channels**, but **Durability Schedule** is still only available from the full-page edit workflow.

This recreates the same context-switching problem the popup dialog was built to solve. When a user is reviewing a database table row and needs to inspect, upload, extract, correct, reset, or save the selected program/version's durability schedule, they must leave the table, reselect the same scope, and use the full-page side panel and tab. That is slow, easy to mis-scope, and inconsistent with the metadata and channel-map correction workflows that are already available from the popup.

## Solution

Extend the existing pencil-icon popup dialog with a third left-navigation route: **Durability Schedule**. It should appear directly below **Assign Channels** and open in the same right-side content area, pre-scoped to the clicked program/version.

The popup must expose the current Durability Schedule capabilities from the full-page edit workflow: loading the active schedule, uploading a `.sch` schedule file, extracting and attaching/replacing the schedule for the selected program/version, showing the active schedule summary, rendering the matched RSP-event schedule table, allowing inline corrections for editable schedule fields, resetting dirty edits, saving corrected schedule rows, and preserving write/read-only permission behavior.

Users should be able to complete the durability-schedule correction loop without navigating away from the Database table. Opening, switching tabs, saving, or closing the dialog must not clear table filters, expanded rows, scroll position, or selection state.

## User Stories

1. As a database user, I want **Durability Schedule** available in the pencil popup dialog, so that I can manage the schedule for a program/version without leaving the Database table.
2. As a database user, I want the **Durability Schedule** route to appear below **Assign Channels**, so that the dialog navigation follows the same correction workflow order as the full-page edit route.
3. As a write user, I want the Durability Schedule section to open with the clicked program/version already selected, so that I do not need to reselect the same Job ID and Version.
4. As a user reviewing table rows, I want opening the Durability Schedule section to preserve Database table filters, expanded groups, current selection, and scroll context, so that I can continue reviewing after closing the dialog.
5. As a write user, I want to upload a `.sch` durability schedule from inside the popup, so that I can attach or replace the active schedule for the selected program/version in the same place I am reviewing it.
6. As a write user, I want the popup upload flow to extract the selected `.sch` schedule using the same parser and backend contract as the full-page route, so that schedule behavior does not diverge between entry points.
7. As a user, I want the popup to reject unsupported schedule files, empty files, and failed parses with clear feedback, so that I understand why the schedule was not attached.
8. As a user, I want the Durability Schedule section to show when no schedule is attached, so that I know I need to upload a `.sch` file before table rows can be reviewed.
9. As a user, I want to see the active schedule identifier or filename, pattern count, and multiplier, so that I know which schedule is currently attached to the selected program/version.
10. As a user, I want the same schedule table shown in the full-page workflow, so that RSP file names, RSP event names, schedule patterns, weights, repeats, schedule sequence, and global multiplier are displayed consistently.
11. As a write user, I want to edit schedule fields inline from the popup, so that I can correct event names, pattern matches, weights, repeats, schedule sequence, and multiplier before saving.
12. As a write user, I want unsaved schedule edits to be tracked, so that Reset and Save reflect whether there is anything to discard or persist.
13. As a write user, I want Reset to restore the last saved or extracted schedule table state, so that I can safely abandon bad edits without closing the dialog.
14. As a write user, I want Save to persist the corrected schedule rows through the existing schedule-save contract, so that corrections are stored for the active program/version schedule.
15. As a write user, I want saving to show the same loading, success, and error feedback as the full-page route, so that I know whether schedule edits were persisted.
16. As a read-only user, I want the Durability Schedule section to remain reviewable but non-mutating, so that I can inspect schedule mappings without being able to upload, reset, or save.
17. As a user switching between dialog sections, I want Edit Metadata, Assign Channels, and Durability Schedule drafts to remain available while the dialog is open, so that switching routes does not erase in-progress work.
18. As a user with unsaved schedule edits, I want closing the dialog, pressing Escape, clicking outside, or opening a different program/version scope to warn me before discarding changes, so that schedule edits are not lost silently.
19. As a user with unsaved metadata, channel-map, or schedule edits, I want one shared discard prompt that accounts for all dirty dialog sections, so that close behavior is predictable.
20. As a keyboard user, I want the Durability Schedule route to have an accessible label, active state, and normal focus behavior, so that the new route is usable without a mouse.
21. As a screen-reader user, I want the dialog title and section labels to identify the selected Job ID, Version, and Durability Schedule section, so that I know the scope and task I am editing.
22. As an implementation agent, I want the popup and full-page route to reuse one schedule editor module, so that schedule logic is not copied and tested twice.

## Implementation Decisions

- The existing pencil icon remains the only entry point from the Database table. Clicking it opens the same scoped popup dialog for the clicked program/version.
- The dialog continues to default to **Edit Metadata** when opened. **Durability Schedule** is a third route in the left navigation and appears directly below **Assign Channels**.
- The Durability Schedule route uses the same settings-style dialog shell as the existing routes: left navigation rail, scoped Job ID/Version header, and right-side scrollable content area.
- Extract the full-page Durability Schedule behavior into a reusable, scope-driven panel that accepts a program/version scope, write permission, and a dirty-state callback.
- The full-page edit workflow should use the same reusable Durability Schedule panel after extraction. It must continue to expose all current tabs and existing schedule behavior.
- The popup panel must include the schedule upload/extract affordance because the full-page side panel is not present inside the dialog. Uploading from the popup should be part of the Durability Schedule route, not hidden in another dialog route.
- The upload affordance accepts `.sch` schedule files and calls the existing attach/replace schedule contract for the scoped program/version.
- Schedule attach, load, row hydration, inline edit, reset, and save behavior must match the existing full-page route. This includes delimiter discovery, matching schedule entries to RSP source files, using saved event rows when present, and falling back to matched preview rows when needed.
- The table capabilities must remain wired in from the popup: active schedule summary, scrollable schedule table, editable cells for mutable fields, global multiplier editing, no-schedule empty state, loading state, Reset, and Save.
- Save must use the existing program/version schedule-save contract and invalidate the active schedule query for the scoped program/version. Any additional database or dashboard invalidation should match existing schedule behavior if implementation reveals dependent UI that must refresh.
- Dirty-state handling expands from two sections to three sections. Metadata, Assign Channels, and Durability Schedule each report their own dirty flag to the dialog shell.
- Users may switch between dialog routes without a discard prompt. Drafts should remain mounted or otherwise retain state while the dialog stays open.
- Closing the dialog, pressing Escape, clicking outside, or applying a pending scope change must prompt if any dialog route has unsaved changes, including Durability Schedule edits.
- The schedule upload/extract operation should not mark the section dirty after a successful attach. It should hydrate the new attached schedule as the clean baseline, matching the full-page route's current behavior.
- Write permission gates schedule mutation. Users without write access may inspect the active schedule and table but cannot upload, edit, reset, or save.
- Backend schedule contracts, parser behavior, ownership checks, and persistence schema are expected to remain unchanged. This PRD is primarily a frontend extraction and dialog integration unless implementation uncovers a missing API behavior.
- User-facing copy should keep the same task language as the full-page route: **Edit Metadata**, **Assign Channels**, and **Durability Schedule**. Avoid introducing a new product name for the popup.

## Testing Decisions

- Tests should focus on externally visible behavior: route availability, correct scoped data loading, upload/save/reset behavior, dirty-close prompts, permission gating, and query/API calls. Avoid testing private component state directly.
- Add dialog coverage showing the left navigation renders **Edit Metadata**, **Assign Channels**, and **Durability Schedule** in that order, with **Durability Schedule** below **Assign Channels** and **Edit Metadata** active by default.
- Add dialog coverage showing the Durability Schedule panel receives the active program/version scope from the pencil popup and remains scoped correctly when the dialog is opened for a different version.
- Add panel coverage for the reusable Durability Schedule panel: loading state, no-attached-schedule state, active schedule summary, table rendering, read-only review mode, and write-enabled edit mode.
- Add upload coverage for the panel: selecting a valid `.sch` file calls the existing attach schedule contract with the scoped program/version, success hydrates the returned schedule as the clean baseline, and errors remain visible without corrupting existing table state.
- Add save coverage for inline edits: edited schedule rows and multiplier are converted to the existing save payload, Save is disabled when there are no changes, Save shows in-progress feedback, and successful save resets the dirty baseline.
- Add reset coverage showing dirty schedule edits restore to the current baseline and clear the dirty flag.
- Add cross-section dirty coverage: schedule edits do not block switching to Edit Metadata or Assign Channels, but they do trigger the shared discard prompt on close, Escape, outside click, or pending scope change.
- Add permission coverage showing read-only users cannot upload, edit, reset, or save from the popup while still being able to view schedule details.
- Reuse existing schedule row-helper tests as the foundation for delimiter discovery, saved-row hydration, pattern formatting, row sorting, and save-payload conversion.
- Reuse existing dialog tests for nav rendering, mounted hidden sections, scoped panel props, write-permission propagation, and accessible labels.
- Reuse backend schedule route and service tests as the authority for parser, ownership, attach, replace, and save behavior. Add backend tests only if the frontend integration exposes a missing server contract.

## Out of Scope

- Redesigning the Database table pencil entry point.
- Adding a separate Durability Schedule pencil icon, row action, or direct table shortcut.
- Changing the durability schedule parser, `.sch` file format support, schedule database schema, or stored artifact model.
- Changing channel-map behavior, plot-key mappings, or Assign Channels upload behavior.
- Changing metadata field definitions, metadata save contracts, or custom-field behavior.
- Removing the full-page edit route. The full-page route must continue to support Edit Metadata, Assign Channels, and Durability Schedule.
- Implementing bulk schedule editing across multiple program/version scopes.
- Adding schedule version history, diffing, restore from older schedules, or schedule deletion.
- Changing dashboard plotting behavior beyond normal refreshes caused by schedule attach/save.

## Further Notes

- DMD-20 brought Edit Metadata into the popup. DMD-21 brought Assign Channels into the popup. DMD-23 should complete the same transplant pattern for Durability Schedule.
- The likely deep module is a reusable Durability Schedule panel that owns schedule query, upload/extract, row hydration, dirty tracking, reset, save, permissions, and feedback behind a small scoped interface.
- The key UX difference from the full-page route is placement of schedule upload. In the full-page workflow upload lives in the side panel; in the popup it must be reachable from the Durability Schedule route itself.
- Keep the feature narrow: this is an inline shortcut to the existing schedule workflow, not a new schedule management system.
