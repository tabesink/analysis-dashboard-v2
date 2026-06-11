# Handoff — Database Metadata Edit Dialog (DMD-20)

Use this document when picking up any issue in `issues/DMD-20-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Give users an inline shortcut from the Database table to the existing Edit Metadata workflow. Replace the program/version row event-count text with a pencil action that opens a settings-style modal: left navigation rail, right editable metadata panel, preselected to the clicked program/version.

This should feel like the current Edit Metadata route opened in context, not a second metadata system.

## What already exists

| Area | Status | Notes |
|------|--------|-------|
| Database table tree | Existing | Program/version rows already render group labels, selection, expand/collapse, status rollups, and event counts. |
| Edit Metadata route | Existing | Full-page workflow already loads program/version events, builds draft metadata values, saves through the program-version metadata update API, and invalidates shared metadata-dependent queries. |
| Metadata field layout | Existing | The right-panel layout requested in the PRD matches the current Edit Metadata tab: status, configured metadata selects, phase checkboxes, raw weight inputs, Copy/Reset/Save actions. |
| Settings dialog shell | Existing | Use the same visual pattern: restrained overlay, centered constrained modal, left nav rail, scrollable right content panel, close control. |
| Cache invalidation | Existing | Metadata saves should continue to use the shared metadata-save invalidation path. |

## Issue Order

1. `DMD-20-01` — Extract a reusable scoped Edit Metadata panel while preserving the full-page route.
2. `DMD-20-02` — Add the Database table pencil action and settings-style dialog.
3. `DMD-20-03` — Harden permissions, dirty-close behavior, accessibility, and refresh polish.

## Key Behavior

- The pencil replaces the visible `(<event count>)` text on version group rows.
- Clicking the pencil must not toggle expand/collapse and must not change row selection.
- The dialog opens with the clicked program/version already selected.
- The left rail has one initial item: **Edit Metadata**.
- The editable metadata fields live in the right panel.
- Save/copy/reset behavior should match the existing Edit Metadata route.
- The full-page `/database/edit` workflow must continue to work.

## Boundaries

- Do not add Assign Channels or Durability Schedule tabs to this dialog in DMD-20.
- Do not change backend metadata schema or add new metadata fields.
- Do not create a new metadata update endpoint unless a blocking gap is found.
- Do not implement bulk metadata editing across multiple program/version scopes.
- Preserve existing authorization behavior: admin-only fields remain admin-only, write permission gates mutation, read-only users cannot save.

## Verification Focus

- Existing Edit Metadata route still loads, edits, resets, copies, and saves metadata.
- Database version-row pencil opens the modal for the correct program/version.
- Table expanded state, filters, scroll context, and current selection survive open/close.
- Successful save updates metadata and invalidates database/dashboard metadata-dependent queries.
- Non-admin and read-only behavior remains consistent with the full-page workflow.

## Documentation Updates When Shipping

- Add an `[Unreleased]` `CHANGELOG.md` entry for the new inline metadata edit dialog.
- Update `docs/master-build-plan.md` with DMD-20 task rows if this feature is promoted from brainstorm to tracked build work.
- Create `docs/tasks/DMD-20-*.md` implementation notes for non-trivial completed slices.
- Append `docs/decisions/log.md` only if implementation makes a durable design decision beyond the PRD, such as a new shared metadata editor boundary.
