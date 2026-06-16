# Handoff — Database Metadata Edit Dialog + Assign Channels (DMD-21)

Use this document when picking up any issue in `issues/DMD-21-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Extend the DMD-20 Database table pencil dialog with a second left-nav section, **Assign Channels**, that transplants the existing Assign Channels tab from `/database/edit` into the modal. Users stay on the Database table while editing metadata or mapping plot channels for the clicked program/version.

This should feel like the current Edit Metadata route opened in context, not a second channel-map system.

## What already exists

| Area | Status | Notes |
|------|--------|-------|
| DMD-20 pencil + dialog | DONE | Version-row pencil opens `MetadataEditDialog` with left nav and scoped `EditMetadataPanel`. |
| Edit Metadata panel | DONE | Reusable `EditMetadataPanel` with scope injection, dirty reporting, save/copy/reset. |
| Assign Channels route tab | Existing | Inline in `client/src/app/database/edit/page.tsx`: plot table, CSV preview, save, missing-map footer. Not yet extracted to a reusable panel. |
| Channel-map APIs | Existing | `getChannelMapEditor` + `saveChannelMap` with shared query invalidation on the route. |
| Dialog dirty-close | DONE (DMD-20-03) | Discard prompt on close and pending scope change for metadata dirty state. |

## Issue Order

1. `DMD-21-01` — Extract a reusable scoped Assign Channels panel while preserving the full-page route tab.
2. `DMD-21-02` — Add **Assign Channels** to the dialog left nav and render the scoped panel in the right content area.
3. `DMD-21-03` — Harden cross-section dirty state, permissions, save refresh, and accessibility.

## Key Behavior

- Pencil opens the dialog on **Edit Metadata** by default.
- Left rail contains **Edit Metadata** and **Assign Channels**.
- Both sections are scoped to the clicked program/version.
- Users can switch sections freely; drafts persist in memory while the dialog is open.
- Close or scope-change prompts when **either** section is dirty.
- Channel-map save uses the existing API contract and invalidates the same queries as the route.
- The full-page `/database/edit` workflow must continue to work for all three tabs.

## Boundaries

- Do not add Durability Schedule to this dialog.
- Do not change backend channel-map schema or add new plot keys.
- Do not create a new channel-map save endpoint unless a blocking gap is found.
- Do not add a second pencil action for channel mapping.
- Preserve existing authorization behavior: write permission gates mutation, read-only users cannot save.

## Verification Focus

- Full-page Edit Metadata route still loads, edits, and saves metadata.
- Full-page Assign Channels tab still loads, edits, and saves channel maps.
- Dialog opens on Edit Metadata; Assign Channels nav item shows the transplanted table and CSV preview.
- Table expanded state, filters, scroll context, and selection survive open/close and section switching.
- Successful channel-map save clears channel-map-required indicators without manual refresh.
- Dirty-close and pending scope-change behavior covers metadata and channel-map edits.

## Documentation Updates When Shipping

- Add an `[Unreleased]` `CHANGELOG.md` entry for Assign Channels in the inline dialog.
- Update `docs/master-build-plan.md` with DMD-21 task rows when promoted from brainstorm to tracked build work.
- Create `docs/tasks/DMD-21-*.md` implementation notes for non-trivial completed slices.
- Append `docs/decisions/log.md` only if implementation makes a durable design decision beyond the PRD.
