# DSC-19-05: Editable schedule table and save UX

**Type:** AFK  
**Effort:** High  
**Labels:** `ready-for-agent`

## Parent

[prd.md](../prd.md) · [HANDOFF.md](../HANDOFF.md)

## What to build

Complete the PRD: after extract populates the table, write users can **edit schedule fields inline**, **Save** to persist, and **Reset** to discard local changes. Read-only users see a readonly table with no Save action.

**Hydration rule**

- If GET `parse_preview.event_rows` is non-empty → hydrate table from saved rows (source of truth).
- Else → build from `entries` + events via DSC-19-02 row builder (extract path).

**Editable columns**

- Readonly: RSP File Name (`source_file`)
- Editable: RSP Event Name, Schedule Pattern, Weight, Repeats, Schedule Sequence, Global Multiplier (schedule-level — one value applied on save)

**Page state** (mirror channel-map tab)

- `scheduleDraftRows` + baseline + dirty tracking
- `handleSaveSchedule` → `dashboardApi.saveProgramVersionSchedule` (PUT from DSC-19-04)
- Save disabled when clean or saving; loading/success/error toasts
- Optional Reset restores baseline from last GET/extract
- Re-extract new `.sch` resets draft to freshly parsed values (prior manual edits on old attachment not carried forward)

**Table component**

- `DurabilityScheduleTable` editable mode: inline `<input>` cells styled like Workbench data cells (not Handsontable)
- `onRowChange` / `editable` props for write users only

## Acceptance criteria

- [ ] Write user can edit row fields after extract and Save persists via PUT
- [ ] Refresh / revisit page shows saved values from `event_rows`
- [ ] Save disabled when no dirty changes; toasts on save success/failure
- [ ] Reset (or discard) reverts unsaved local edits
- [ ] Read-only user: no Save, cells not editable
- [ ] Non-owner write user gets 403 on save (API + UI guard)
- [ ] Re-extract replaces table with new parsed values
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] Manual QA items 6–9 from PRD checklist pass

## Blocked by

- DSC-19-03 (extract-to-review UX and table display)
- DSC-19-04 (PUT save API + client API method)

## Agent handoff

**Read first:** [HANDOFF.md](../HANDOFF.md), `handleSaveChannelMap` + dirty metadata save patterns in `database/edit/page.tsx`, `DurabilityScheduleTable.tsx`, DSC-19-04 PUT contract.

**User stories:** 33–39, 41–44, 42–43, 53.

**Prior art:** Channel map tab Save button placement and disabled-when-clean on same edit page.

**Regression:** Run full server test suite; confirm `test_roundtrip_regression.py` and `test_transfer_package.py` still pass.

**Doc updates:** `docs/tasks/DSC-19-05.md`, `docs/master-build-plan.md` when all DSC-19 slices complete.

**Suggested skills:** `tdd`, `design-guidelines` (inline input styling if needed)
