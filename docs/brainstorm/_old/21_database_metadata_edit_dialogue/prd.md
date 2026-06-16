## Problem Statement

Database users can open a version-row pencil dialog (DMD-20) to edit metadata without leaving the Database table. That dialog currently exposes only **Edit Metadata**. When a program/version needs channel assignment — especially rows flagged with a channel-map-required warning — the user must still navigate to the separate `/database/edit` route, reselect the same program and version, and switch to the **Assign Channels** tab before mapping plot columns.

This duplicates the context-switching problem DMD-20 solved for metadata. Users who land on a version row from the table already know which scope needs work; forcing a route change to assign channels is slow and easy to get wrong.

## Solution

Extend the existing Database table pencil dialog so its left navigation rail offers two sections: **Edit Metadata** and **Assign Channels**. Clicking the pencil still opens the dialog pre-scoped to the clicked program/version and still defaults to **Edit Metadata**. Users can switch to **Assign Channels** in the left rail to map plot x/y column indices against the same CSV preview table, guidance copy, save action, and missing-channel-map messaging they already have on the full-page Edit Metadata route.

The modal must keep users anchored in the Database table: no route change, no lost filters, no lost expanded rows, and no selection changes. Saving from either section must use the existing backend contracts and shared cache invalidation paths so the Database table, Dashboard filters, and full-page edit workflow stay consistent.

## User Stories

1. As a database user, I want to open Assign Channels from the same version-row pencil dialog, so that I can map channels without leaving the Database table.
2. As a write user, I want the Assign Channels section to open with the clicked program/version already selected, so that I do not need to reselect the same dataset.
3. As a user fixing a channel-map-required row, I want the Assign Channels table and CSV preview to match the full-page workflow, so that I can trust the same mapping rules and save behavior.
4. As a read-only user, I want channel-map edit actions disabled or unavailable, so that I understand I cannot mutate channel maps from the table.
5. As a user working across sections, I want to switch between Edit Metadata and Assign Channels without losing in-progress edits, and be prompted before closing the dialog or changing scope when either section has unsaved changes.
6. As a user correcting multiple versions, I want closing the dialog to return me to the same table state, so that I can continue reviewing rows efficiently.

## Implementation Decisions

- The version-row pencil entry point from DMD-20 remains unchanged. It opens the same settings-style dialog pre-scoped to the clicked program/version.
- The dialog opens on **Edit Metadata** by default, even when the row shows a channel-map-required indicator.
- The left navigation rail gains a second item: **Assign Channels**, using the same visual pattern as the existing **Edit Metadata** nav item (icon, active state, `aria-current`).
- The right content area renders the active section. Only one section is visible at a time, but both sections should remain mounted (or otherwise retain draft state) while the dialog is open so users can switch freely without losing in-progress edits.
- **Assign Channels** content must reuse the existing full-page behavior rather than introducing a second channel-map editor. Required behavior includes:
  - Loading channel-map editor data for the scoped program/version
  - Plot column mapping table for the fixed plot keys
  - CSV preview with zero-based column index guidance
  - Save through the existing channel-map save contract
  - Loading, empty, disabled-save, and missing-channel-map footer states
  - Toast feedback consistent with the route
- Extract the Assign Channels tab UI and stateful behavior into a reusable scope-driven panel (mirroring DMD-20's `EditMetadataPanel` extraction). The full-page `/database/edit` route must continue to work through the same panel.
- Channel-map save must invalidate the same client queries used today after a successful save, including datasets, program-version events, channel-map editor data, and dashboard/event-catalog dependencies.
- Dirty-state handling:
  - Each section reports its own dirty flag to the dialog shell.
  - Users may switch between **Edit Metadata** and **Assign Channels** without a discard prompt; in-memory drafts persist while the dialog stays open.
  - Closing the dialog, pressing Escape, or applying a pending scope change must prompt when **either** section has unsaved changes, reusing the established discard-confirm pattern from DMD-20-03.
- Write permission gates channel-map mutation the same way as metadata mutation. Read-only users see the Assign Channels section in a non-mutating or disabled state consistent with the full-page route.
- The dialog header continues to show the selected program/version context for both sections.
- Keyboard and screen-reader behavior must match existing dialog conventions: focus trap, predictable Escape/close behavior, descriptive nav labels, and sensible initial focus.
- The dialog shell may be renamed internally for clarity (e.g., program/version editor dialog), but user-facing copy should remain task-oriented section names rather than introducing a new product surface.

## Testing Decisions

- Add panel coverage for the extracted Assign Channels panel: scope initialization, draft hydration from channel-map editor query, numeric input normalization, save enablement when `column_count` is missing, and successful save through the existing API contract.
- Add dialog coverage for two-section navigation: left rail shows **Edit Metadata** and **Assign Channels**, default section is **Edit Metadata**, clicking nav items switches visible content without changing program/version scope.
- Add cross-section dirty coverage: unsaved metadata or channel-map edits do not block section switching, but closing the dialog or changing scope prompts when any section is dirty.
- Add permission coverage: read-only users cannot save channel maps from the dialog; write users can.
- Add refresh coverage: successful channel-map save invalidates database-table and dashboard-dependent queries so channel-map-required indicators update without a manual refresh.
- Reuse existing tests for `MetadataEditDialog`, `EditMetadataPanel`, metadata discard prompts, `CsvPreviewTable`, and the current Assign Channels route behavior as examples.

## Out of Scope

- Adding **Durability Schedule** to the popup dialog.
- Changing backend channel-map schema or introducing new plot keys.
- Changing upload, delete, import/export, or dashboard plotting behavior beyond normal cache refresh after channel-map save.
- Removing or redesigning the full-page `/database/edit` route. It must continue to host all three tabs.
- Implementing bulk channel-map edit across multiple program/version scopes from the table.
- Adding a separate pencil action or entry point specifically for Assign Channels; the existing version-row pencil remains the single opener.

## Further Notes

- DMD-20 deliberately deferred Assign Channels; this PRD is the follow-on that completes the inline shortcut for the two most common post-upload corrections from the Database table.
- The feature is especially useful for channel-map-required rows, but Assign Channels should be available for any editable version row opened from the pencil.
- A recommended lean UX choice for section switching: persist drafts in memory and prompt only on close or scope change. This avoids discard prompts on every nav click while still protecting users from accidental data loss.
