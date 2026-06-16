# DSC-19-03: Extract-to-review vertical slice

**Type:** AFK  
**Effort:** Medium  
**Labels:** `ready-for-agent`

## Parent

[prd.md](../prd.md) · [HANDOFF.md](../HANDOFF.md)

## What to build

Wire the **full extract → populate table → review** path on Database Edit using the v2 row matcher from DSC-19-02. User uploads `.sch`, clicks Extract (persist + parse), and sees a correct readonly review table for the selected program/version.

**Client**

- Use `buildDurabilityScheduleRows` from DSC-19-02 in `database/edit/page.tsx`.
- After successful extract: clear side-panel selected file (`UploadScheduleSection` callback or `selectionKey` bump).
- Show active schedule summary (id/filename, pattern count, multiplier) when attached.
- Empty state when no schedule; loading state while `scheduleQuery` fetches.
- Remove hard 12-row cap on `DurabilityScheduleTable` — scroll all event rows.
- Keep extract flow: `attachProgramVersionSchedule` → invalidate `['program-version-schedule', programId, version]` → toast.

**Not in this slice:** inline editing, Save button, PUT API (DSC-19-04/05).

## Acceptance criteria

- [ ] Extract attaches schedule and populates table with v2-matched rows for sample `.sch` + events
- [ ] Variant filenames show correct event names (`mf4e3_100`, not `mf4e3`)
- [ ] Side-panel file cleared after successful extract
- [ ] Empty and loading states are explicit (no misleading blank table)
- [ ] Table shows all rows for large program/versions (no 12-row data cap)
- [ ] Read-only users cannot extract (existing page/API guards)
- [ ] Manual QA: upload `data/raw/13999/v58_data_processing/gmw17287_95per_bt1cc_iver.sch` for a program with matching events

## Blocked by

- DSC-19-02

## Agent handoff

**Read first:** [HANDOFF.md](../HANDOFF.md), `client/src/app/database/edit/page.tsx` (`handleExtractSchedule`, `scheduleQuery`, durability tab ~1307+), `UploadScheduleSection.tsx`, `DurabilityScheduleTable.tsx`.

**User stories:** 1–10, 21–22, 28–31, 52.

**Copy UX from:** `handleSaveChannelMap` toast/loading patterns on same page.

**Do not implement:** editable cells, `event_rows` hydration from GET (until DSC-19-05), PUT save.

**Suggested skills:** `tdd` (upload handler tests if added), `design-guidelines` (empty states only if unsure)
