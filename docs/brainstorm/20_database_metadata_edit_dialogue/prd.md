## Problem Statement

Database users can see program/version group rows in the database event tree, including the current event count in parentheses. When a program/version needs metadata correction, the user must leave the table context and navigate to the separate Edit Metadata route, then reselect the same program and version before making changes.

This is slow and error-prone for the exact workflow where the table already tells the user which program/version needs attention, such as rows marked with a channel-map-required warning or a pending status rollup.

## Solution

Replace the program/version group count affordance in the database event tree with a compact pencil icon action. Clicking the pencil opens a settings-style modal dialog pre-scoped to that program/version. The dialog initially exposes one tab, **Edit Metadata**, and renders the same editable metadata fields, phase checkboxes, raw weight inputs, and Copy/Reset/Save actions users already have in the Edit Metadata workflow.

The modal should keep users anchored in the database table: opening it must not navigate away, lose table filters, lose expanded rows, or clear current table selection. Saving metadata from the dialog should update the underlying program/version events and refresh database-dependent views consistently with the existing metadata save behavior.

## User Stories

1. As a database user, I want to click a pencil on a program/version row, so that I can edit that scope's metadata without leaving the database table.
2. As a write user, I want the dialog to open with the clicked program/version already selected, so that I do not need to reselect the same dataset.
3. As an admin user, I want privileged metadata fields such as Status to follow the same edit rules as the existing Edit Metadata page, so that permissions remain consistent.
4. As a read-only user, I want edit actions to be disabled or unavailable, so that I understand I cannot mutate metadata from the table.
5. As a user correcting multiple versions, I want closing the dialog to return me to the same table state, so that I can continue reviewing rows efficiently.

## Implementation Decisions

- The pencil replaces the visible event-count text in the database table group row where the count currently appears after the group label.
- The pencil is an explicit row action, not a replacement for expand/collapse or checkbox selection. Clicking it must not toggle the group open state and must not change selection.
- The action opens a modal dialog modeled on the settings dialog: constrained centered surface, subtle overlay, left-side navigation, right-side editable content area, and a close control.
- The initial left-side dialog navigation contains only one item: **Edit Metadata**. The design should leave room for future metadata-related tabs without implementing them now.
- The editable content should reuse the existing Edit Metadata behavior and field model rather than introducing a separate metadata editor. Required behavior includes dynamic metadata options, mixed-value placeholders, phase flags, raw weight fields, copy/paste values, reset/restore, save dirty-state handling, admin-only status editing, and existing toast feedback.
- The dialog opens with the clicked scope as the active program/version. A program-level pencil should either open a scope picker for versions or be deferred; this PRD primarily targets the version row shown in the request.
- Metadata save must use the existing program/version update contract and shared cache invalidation path so the database table, dashboard filters, and edit workflow do not diverge.
- The dialog should show the selected program/version context in its header or content summary so users know which scope they are editing.
- Keyboard and screen-reader behavior must match existing dialog conventions: focus is trapped inside the modal, Escape closes when safe, the pencil has a descriptive accessible label, and unsaved changes are not silently lost.
- The editable metadata fields live in the right panel. The tab/navigation rail lives on the left side of the dialog.

## Testing Decisions

- Add component coverage for the database event tree action: the event-count text is replaced by an accessible pencil button, clicking the button calls the open-dialog handler with the correct program/version, and the click does not toggle expansion or selection.
- Add dialog coverage for preselected scope: opening from a version row initializes the metadata editor with that program/version and enables fields according to the current user's permissions.
- Add save-path coverage around the dialog editor: dirty metadata values are submitted through the existing update contract, successful saves invalidate metadata-dependent queries, and buttons disable during save.
- Add permission coverage: non-admin users cannot edit admin-only fields, users without write access cannot save, and unavailable fields preserve the existing disabled state and explanatory messaging.
- Add regression coverage for unsaved changes: closing with dirty values should either prompt or use the app's established unsaved-change behavior; values must not be silently discarded if the existing route protects against that case.
- Reuse existing tests around metadata field helpers, metadata save cache invalidation, settings-dialog rendering, and database event tree grouping as examples for the new coverage.

## Out of Scope

- Adding Assign Channels or Durability Schedule tabs to the new dialog.
- Changing the backend metadata update schema or introducing new metadata fields.
- Changing upload, delete, import/export, or dashboard plotting behavior beyond normal cache refresh after metadata save.
- Reworking the full Edit Metadata route. The existing route should continue to work as the full-page workflow.
- Implementing bulk metadata edit across multiple program/version scopes from the table.

## Further Notes

- The user-facing behavior should feel like an inline shortcut into Edit Metadata, not a separate metadata system.
- The feature is especially useful for rows with pending or missing-channel-map indicators, but it should be available consistently for editable program/version rows.
- If the table still needs to expose event counts, consider moving the count into the pencil tooltip or accessible label rather than rendering it as adjacent text.
