# Handoff — Database Metadata Dialog + Durability Schedule (DMD-23)

Use this document when picking up any issue in `issues/DMD-23-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Extend the Database table pencil popup dialog with a third left-nav section, **Durability Schedule**, directly below **Assign Channels**. Users should be able to inspect, upload/extract, edit, reset, and save the selected program/version's durability schedule without leaving the Database table.

This should feel like the current full-page Durability Schedule workflow opened in context, not a second schedule system.

## What already exists

| Area | Status | Notes |
|------|--------|-------|
| DMD-20 pencil + dialog | Existing | Version-row pencil opens the scoped metadata popup dialog and defaults to **Edit Metadata**. |
| DMD-21 Assign Channels in dialog | Existing | Dialog left rail already contains **Edit Metadata** and **Assign Channels**, with scoped panels and dirty-state tracking. |
| Full-page Durability Schedule tab | Existing | The full-page edit route loads active schedule data, hydrates matched RSP rows, renders the schedule table, edits rows, resets, saves, and shows feedback. |
| Schedule upload/extract | Existing | Full-page workflow uploads `.sch` files from the side panel and attaches/replaces the active schedule for the selected program/version. |
| Schedule table | Existing | The table shows RSP file name, RSP event name, schedule pattern, weight, repeats, schedule sequence, and global multiplier. |
| Schedule API contracts | Existing | Attach, get, and save program/version schedule contracts already exist with ownership/write checks. |
| Schedule row helpers | Existing | Helpers cover delimiter discovery, saved-row hydration, matched preview row building, and save-payload conversion. |

## Issue Order

1. `DMD-23-01` — Extract a reusable Durability Schedule panel while preserving the full-page route.
2. `DMD-23-02` — Add **Durability Schedule** to the popup dialog below **Assign Channels**.
3. `DMD-23-03` — Harden three-section dirty state, permissions, refresh behavior, and accessibility.

## Key Behavior

- Pencil opens the dialog on **Edit Metadata** by default.
- Left rail contains **Edit Metadata**, **Assign Channels**, and **Durability Schedule** in that order.
- **Durability Schedule** appears directly below **Assign Channels**.
- All sections are scoped to the clicked program/version.
- Users can switch sections freely; drafts persist in memory while the dialog is open.
- Close, Escape, outside click, or pending scope change prompts when any section is dirty.
- The Durability Schedule section exposes upload/extract inside the popup because the full-page side panel is not present.
- Schedule upload accepts `.sch` files and uses the existing attach/replace contract.
- Schedule save uses the existing save contract and refreshes the active schedule baseline.
- Read-only users can review schedules but cannot upload, edit, reset, or save.
- The full-page `/database/edit` workflow must continue to work for all three tabs.

## Boundaries

- Do not redesign the Database table pencil action.
- Do not add a separate Durability Schedule row action or direct table shortcut.
- Do not change the `.sch` parser, schedule artifact model, database schema, or backend schedule contracts unless a blocking gap is found.
- Do not change Assign Channels, channel-map upload, metadata fields, or custom-field behavior.
- Do not remove or redesign the full-page edit route.
- Do not implement bulk schedule editing, schedule deletion, schedule history, diffing, or restore from older schedules.
- Preserve existing authorization behavior: write permission and owner/admin checks gate mutations.

## Verification Focus

- Full-page Durability Schedule still loads, uploads/extracts `.sch`, edits, resets, and saves.
- Dialog opens on **Edit Metadata** and now exposes **Durability Schedule** below **Assign Channels**.
- Dialog Durability Schedule uses the clicked program/version scope.
- Table filters, expanded rows, scroll context, and selection survive opening, section switching, saving, and closing.
- No-schedule state and active schedule state both work in the popup.
- Successful schedule upload/save updates the table baseline and does not leave stale dirty state.
- Dirty-close and pending scope-change behavior covers metadata, channel-map, and schedule edits.
- Read-only users can inspect but cannot mutate schedules.
- Keyboard and screen-reader behavior remains consistent with the existing dialog conventions.

## Suggested Implementation Notes

- Prefer extracting one reusable Durability Schedule panel that owns query, upload/extract, row hydration, dirty tracking, reset, save, permissions, and feedback behind a small scoped interface.
- Keep schedule matching and save-payload conversion in the existing helper layer rather than duplicating row logic in the dialog.
- Keep backend parsing and ownership checks authoritative. The popup should call existing API contracts rather than inventing frontend-only schedule handling.
- If query invalidation needs to broaden beyond the active schedule query, mirror the smallest existing invalidation pattern needed to refresh visible Database/Dashboard state.

## Documentation Updates When Shipping

- Add an `[Unreleased]` `CHANGELOG.md` entry for Durability Schedule in the inline metadata dialog.
- Update `docs/master-build-plan.md` with DMD-23 task rows if this brainstorm becomes tracked build work.
- Create `docs/tasks/DMD-23-*.md` implementation notes for non-trivial completed slices.
- Append `docs/decisions/log.md` only if implementation makes a durable design decision beyond the PRD, such as introducing a new shared schedule editor boundary.
