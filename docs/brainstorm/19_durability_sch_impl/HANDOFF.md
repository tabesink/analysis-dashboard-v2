# Handoff — Durability Schedule Finish & Harden (DSC-19)

Use this document when picking up any issue in `issues/DSC-19-*.md`. Full product spec: [prd.md](./prd.md).

## What already exists (do not rebuild)

| Area | Status | Key locations |
|------|--------|----------------|
| `.sch` parser | DONE | `server/services/durability_schedule.py` — `DurabilityScheduleParser` |
| Artifact storage + active pointer | DONE | `DurabilityScheduleStorageService`, `durability_schedule_artifacts`, `active_durability_schedules` |
| Attach + read API | DONE | `POST/GET /api/v1/dashboard/program-version/schedule` in `server/routers/dashboard.py` |
| Client API client | DONE | `client/src/lib/api/dashboard.ts` — `getProgramVersionSchedule`, `attachProgramVersionSchedule` |
| Upload side panel | Wired | `client/src/components/edit-metadata/UploadScheduleSection.tsx` |
| Edit page wiring | Partial | `client/src/app/database/edit/page.tsx` — `handleExtractSchedule`, `scheduleQuery` |
| Review table | Presentational | `client/src/components/edit-metadata/DurabilityScheduleTable.tsx` |
| Row builder | **Needs v2 alignment** | `client/src/features/edit-metadata/lib/build-durability-schedule-rows.ts` |
| DEC / task notes | DONE | DEC-078, `docs/tasks/DB14-06.md` |

## What this PRD adds

1. **Client matching** aligned with `notebooks/rsp_file_name_extraction_v2.ipynb` (delimiter discovery + longest substring pattern match).
2. **Upload/review UX polish** (clear file after extract, empty/loading states, full row scroll).
3. **PUT save** for edited table rows → `parse_preview_json.event_rows` on active artifact (original `.sch` bytes stay immutable).
4. **Editable table** with draft/save/reset mirroring channel-map tab patterns on the same page.

## Architecture (DEC-078 — preserve)

- One **active** schedule per `(program_id, version)` via `active_durability_schedules`.
- **Immutable** `.sch` bytes at `artifact://schedules/sch_<sha256[:16]>/schedule.sch`.
- **Parse preview** JSON on artifact row; extend with `event_rows` and `delimiter_token` after save (no new tables).
- Permissions: `WriteUserDep` + `user_can_edit_program_version` for attach and save.
- Audit: `DURABILITY_SCHEDULE_ATTACHED`, `DURABILITY_SCHEDULE_REPLACED`, new `DURABILITY_SCHEDULE_EDITED` on save.

## Domain algorithms (v2 notebook — canonical)

**Delimiter discovery** (`discover_event_delimiter`):

- For each filename stem, split on `_`; count tokens across files (skip empty, skip duplicate token per file).
- Pick token with max `(file_count, -first_position)` → e.g. `bt1cc`.

**Event name:** join tokens before delimiter → `mf4e3_100_bt1cc_...` → `mf4e3_100`.

**Pattern match:** longest `pattern` where `pattern in stem` (bare patterns from server, not glob regex).

Prototype: `notebooks/rsp_file_name_extraction_v2.ipynb` — do not import notebook code into app; port logic to TypeScript/Python modules.

## API contracts

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/dashboard/program-version/schedule` | Multipart attach `.sch` (exists) |
| GET | `/api/v1/dashboard/program-version/schedule` | Active schedule context (exists) |
| PUT | `/api/v1/dashboard/program-version/schedule` | **New** — save `multiplier` + `event_rows` |

Extended `parse_preview` fields (see PRD JSON example): `event_rows[]`, `delimiter_token`.

## Frontend patterns to copy

| Pattern | Reference |
|---------|-----------|
| Channel map save + dirty state | `handleSaveChannelMap` in `client/src/app/database/edit/page.tsx` |
| Save button disabled when clean | Same page, metadata save section |
| Multipart upload tests | `client/src/lib/api/upload.test.ts` |
| Row builder unit tests | `client/src/features/edit-metadata/__tests__/build-durability-schedule-rows.test.ts` |

## Tests to keep green

- `tests/server/services/test_durability_schedule.py`
- `tests/server/routers/test_durability_schedule_router.py`
- `tests/server/services/test_roundtrip_regression.py` (transfer package includes schedules)
- `tests/server/services/test_transfer_package.py`

## Mandatory doc updates (when shipping user-facing changes)

1. `CHANGELOG.md` — `[Unreleased]`
2. `docs/master-build-plan.md` — mark DSC-19 issues DONE with date
3. `docs/tasks/DSC-19-*.md` — implementation notes per completed slice
4. `docs/decisions/log.md` — append entry if PUT save contract is finalized
5. `docs/database-schema.txt` — only if schema changes (not expected)

## Suggested skills

- `tdd` — red-green-refactor for row matching and API tests
- `diagnose` — if upload/save flows fail in integration
- `database-table` — only if table editing UX needs Workbench alignment audit
- `zoom-out` — if unfamiliar with edit-metadata page structure

## Out of scope (all DSC-19 issues)

Per-event override ledger table, schedule history UI, downstream analysis/plot consumption, folder glob import, mutating `.sch` artifact bytes on save.
