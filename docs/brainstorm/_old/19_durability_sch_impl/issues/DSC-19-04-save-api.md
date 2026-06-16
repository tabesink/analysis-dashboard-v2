# DSC-19-04: PUT save schedule edits API

**Type:** AFK  
**Effort:** Medium  
**Labels:** `ready-for-agent`

## Parent

[prd.md](../prd.md) · [HANDOFF.md](../HANDOFF.md)

## What to build

Add **`PUT /api/v1/dashboard/program-version/schedule`** so write users can persist edited durability schedule table state without re-uploading `.sch` files.

**Behavior**

- JSON body: `program_id`, `version`, `multiplier`, `event_rows` (per-event rows with `event_id`, `rsp_file_name`, `rsp_event_name`, `pattern`, `repeats`, `weight`, `schedule_sequence`).
- Auth: same as attach — `WriteUserDep` + `user_can_edit_program_version`.
- 404 if no active schedule for program/version.
- Updates `parse_preview_json` on the **active** artifact row: preserve original parsed `entries` from `.sch`; store `event_rows`, optional `delimiter_token`; update `multiplier` / `entry_count` as needed.
- **Do not** mutate original `.sch` artifact bytes.
- Audit log: `DURABILITY_SCHEDULE_EDITED`.
- Response: `DurabilityScheduleContextResponse` (same as GET).

**Models**

- `DurabilityScheduleSaveRequest`, `DurabilityScheduleEventRow` (or equivalent) in `server/models/dashboard.py`.
- Extend client types in `client/src/types/api.ts` and stub `saveProgramVersionSchedule` in `dashboard.ts` (full UI wiring in DSC-19-05).

**Tests**

- PUT 200 round-trip: save → GET returns `event_rows`.
- 403 non-owner; 404 no active schedule; 400 invalid numeric payload.
- Validate `event_id` values belong to program/version event set.

## Acceptance criteria

- [ ] PUT endpoint registered and documented in OpenAPI via existing router
- [ ] `save_schedule_edits` (or equivalent) service method updates preview JSON only
- [ ] Audit entry `DURABILITY_SCHEDULE_EDITED` on successful save
- [ ] Router tests cover 200, 403, 404, 400 cases
- [ ] GET returns saved `event_rows` after PUT
- [ ] Transfer package / roundtrip regression tests remain green
- [ ] Client API method + types added (no editable UI required in this slice)

## Blocked by

- DSC-19-01 (recommended — attach/read tests stable)

## Agent handoff

**Read first:** [HANDOFF.md](../HANDOFF.md), `DurabilityScheduleStorageService`, `upsert_durability_schedule_artifact` / `get_active_durability_schedule` in `database.py`, channel-map PUT handler in `dashboard.py` for permission pattern.

**User stories:** 40, 45, 53 (API portion).

**Preview JSON extension (from PRD):**

```json
{
  "schedule_id": "...",
  "multiplier": 1.0,
  "entry_count": 60,
  "entries": [...],
  "entries_preview": [...],
  "event_rows": [
    {
      "event_id": "evt-1",
      "rsp_file_name": "...",
      "rsp_event_name": "mf4e3_100",
      "pattern": "mf4e3_100",
      "repeats": 16,
      "weight": 0.15,
      "schedule_sequence": 2
    }
  ],
  "delimiter_token": "bt1cc"
}
```

**Do not implement:** editable table UI, row matching changes.

**Doc updates:** `CHANGELOG.md`, `docs/decisions/log.md` if save contract finalized, `docs/tasks/DSC-19-04.md`.

**Suggested skill:** `tdd`
