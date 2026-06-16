# PRD — Durability Schedule Upload, Extract, and Review (Finish & Harden)

**Task ID:** DB14-06-harden (follow-on to DB14-06)  
**Status:** Ready for agent  
**Depends on:** DB14-06 (DONE), Edit Metadata durability schedule UI (wired)

**Implementation issues:** [README_INDEX.md](./README_INDEX.md) · **Agent handoff:** [HANDOFF.md](./HANDOFF.md)

## Problem Statement

The Database Edit page already exposes a Durability Schedule tab, side-panel `.sch` upload, and a review table wired to `POST/GET /api/v1/dashboard/program-version/schedule`. Backend parsing, checksum-deduped artifact storage, active `(program_id, version)` attachment, permissions, and audit logging were delivered in DB14-06 (DEC-078).

However, the end-to-end experience is not yet production-complete:

- **RSP event name extraction** on the client still uses the first underscore segment only, which breaks variant filenames like `mf4e3_100_bt1cc_...` (should be `mf4e3_100`, not `mf4e3`).
- **Filename-to-schedule matching** in the UI row builder does not follow the v2 notebook’s delimiter-discovery and longest-substring pattern rules validated against real program data.
- **Upload UX** does not reset the selected file after a successful extract; empty and loading states are thin.
- **The review table is readonly** after extract — analysts cannot correct auto-matched schedule fields (event name, pattern, weight, repeats, sequence, multiplier) without re-uploading a new `.sch` file.
- **Test coverage** gaps remain on GET route behavior, validation edge cases, delimiter discovery, upload/save flows, and editable-table behavior.

Analysts need a low-bloat finish pass: keep the existing storage model and API contracts, align client matching logic with `notebooks/rsp_file_name_extraction_v2.ipynb`, let users **edit the populated table and save** corrections without re-uploading, and harden validation and tests so a coding agent can complete the vertical slice without architectural churn.

## Solution

Finish and harden the existing durability schedule vertical slice:

1. User selects **Program ID** and **Version** on Database Edit.
2. User uploads an autodam `.sch` file in the side panel and clicks **Extract** (persist + parse in one step — no separate preview-only API).
3. Server parses `.sch`, stores immutable artifact bytes, sets the active schedule pointer, and returns parse preview metadata.
4. UI refetches the active schedule context and builds table rows by joining schedule entries to event `source_file` values for that program/version.
5. **RSP event names** are derived by auto-discovering the shared delimiter token across filenames (v2 notebook), not by hardcoding `_bt1cc` or taking only the first segment.
6. **Schedule pattern matching** uses longest substring containment on the filename stem (v2 notebook), with schedule sequence, repeats, and weight from the matched entry; global multiplier shown per row from schedule metadata.
7. After the table is populated, the user can **edit schedule fields inline**, then click **Save** to persist corrections on the active schedule artifact (original `.sch` bytes remain immutable; saved state lives in schedule preview metadata).
8. Re-uploading and extracting a new `.sch` replaces the active schedule and resets table rows to freshly parsed values (user edits on the prior attachment are not carried forward).

No new database tables, no schedule history manager in this slice. Per-event editable rows are in scope as saved preview metadata, not as a separate override ledger.

## User Stories

### Upload and attach

1. As a write user editing metadata, I want to upload a `.sch` durability schedule for the selected program/version, so that the version has one authoritative active schedule.
2. As a write user, I want **Extract** to parse and attach the `.sch` immediately (no preview-only upload step), so that the table can populate without a separate “confirm extract” flow.
3. As a write user, I want a loading state and toast while extraction runs, so that I know the server is processing my file.
4. As a write user, I want a success toast distinguishing first attach vs replacement, so that I know whether I overwrote a prior schedule.
5. As a write user, I want API errors surfaced as user-safe toast messages, so that I can correct bad files without reading server logs.
6. As a write user, I want the side-panel file picker cleared after successful extract, so that I do not accidentally re-upload the same file.
7. As a write user, I want only `.sch` files accepted in the upload control, so that invalid formats are rejected at the UI boundary.
8. As a write user, I want upload disabled until program ID and version are selected, so that I cannot attach a schedule without scope.
9. As a write user replacing a schedule, I want the prior artifact retained in the ledger with audit `DURABILITY_SCHEDULE_REPLACED`, so that replacement is traceable without losing history rows.
10. As a write user attaching identical bytes again, I want dedupe by checksum without spurious replacement audit, so that repeat uploads are stable.

### Permissions and security

11. As a read-only user, I want attach rejected with 403, so that I cannot mutate schedules.
12. As a write user who is not owner/admin for the program/version, I want attach rejected with 403, so that ownership rules match other write paths.
13. As an admin, I want to attach schedules for program/versions I do not own, so that I can support users operationally.
14. As any authenticated user, I want to read the active schedule context for a program/version I can view, so that I can review attached schedules.
15. As a write user, I want empty or non-`.sch` uploads rejected with 400, so that corrupt inputs fail fast.

### Schedule parsing (server)

16. As the system, I want autodam `.sch` files parsed for `*id`, `*multiplier`, and ordered `*pattern* repeats weight` entries until `*summary`, so that preview metadata matches autodam semantics.
17. As the system, I want `#` comments and blank lines ignored, so that annotated schedule files parse cleanly.
18. As the system, I want original `.sch` bytes stored under checksum-deduped artifact URIs, so that identical schedules share storage.
19. As the system, I want exactly one active schedule per `(program_id, version)`, so that downstream consumers have a single resolution path.
20. As the system, I want parse preview JSON stored on the artifact row including full `entries` plus capped `entries_preview`, so that UI and audit have lightweight and complete views.

### Review table (client)

21. As a data analyst, I want the Durability Schedule tab to show a table of RSP files for the selected program/version joined to schedule metadata, so that I can verify event coverage against the schedule.
22. As a data analyst, I want columns for RSP file name, RSP event name, schedule pattern, weight, repeats, schedule sequence, and global multiplier, so that the table matches domain review needs.
23. As a data analyst, I want **RSP event names** derived by discovering the shared delimiter token across filenames (e.g. `bt1cc`), then taking all tokens before that delimiter, so that variant codes like `mf4e3_100` are correct without hardcoding vehicle tokens.
24. As a data analyst, I want schedule patterns matched by longest substring containment in the filename stem, so that short codes like `4e1` match inside `mf4e1` while longer patterns like `mf4e3_100` win when appropriate.
25. As a data analyst, I want unmatched events to appear with empty pattern and null schedule fields, so that I can see gaps in schedule coverage.
26. As a data analyst, I want rows sorted by schedule sequence then filename, so that table order follows the schedule file.
27. As a data analyst, I want schedule patterns displayed with surrounding `*` when the stored pattern has no glob markers, so that display matches autodam convention.
28. As a data analyst, I want the active schedule summary line (schedule id or source filename, pattern count, multiplier) above the table when attached, so that I know which schedule is active.
29. As a data analyst, I want a clear empty state when no schedule is attached, so that I know I must upload and extract first.
30. As a data analyst, I want a loading state while schedule context loads, so that the UI does not flash incorrect empty content.
31. As a data analyst, I want the table to scroll beyond a fixed 12-row cap when many events exist, so that I can review full program/version coverage without hidden rows.
32. As a data analyst, I want global multiplier shown per row consistently from schedule metadata, so that I can compare ballast scaling across events.

### Edit and save (after extract)

33. As a write user, I want to edit schedule fields in the populated table after extract, so that I can correct auto-matching mistakes without preparing a new `.sch` file.
34. As a write user, I want **RSP File Name** to remain readonly (sourced from event `source_file`), so that row identity stays tied to ingested events.
35. As a write user, I want to edit **RSP Event Name**, **Schedule Pattern**, **Weight**, **Repeats**, **Schedule Sequence**, and **Global Multiplier**, so that I can fix delimiter or pattern matching errors inline.
36. As a write user, I want a **Save** action on the Durability Schedule tab (mirroring channel-map save UX), so that I can persist edits explicitly rather than on every keystroke.
37. As a write user, I want Save disabled when there are no unsaved changes, so that I do not accidentally submit duplicate writes.
38. As a write user, I want a loading toast while save runs and a success toast on completion, so that I know persistence succeeded.
39. As a write user, I want save errors surfaced as user-safe toast messages, so that I can fix validation issues without reading server logs.
40. As a write user, I want saved edits to survive page refresh and return visits, so that corrections are durable program/version state.
41. As a write user, I want re-extracting a new `.sch` to replace auto-populated values, so that a fresh upload is an intentional reset of schedule content.
42. As a read-only user, I want the table readonly with no Save action, so that I cannot mutate schedule data.
43. As a write user who is not owner/admin, I want save rejected with 403, matching attach permissions.
44. As a data analyst, I want optional **Reset** (or discard changes) to revert the table to the last saved or freshly extracted state before save, so that I can undo local edits safely.
45. As the system, I want schedule edits audited (e.g. `DURABILITY_SCHEDULE_EDITED`), so that manual corrections are traceable separately from attach/replace.

### Event inheritance (existing, verify only)

46. As the system, I want events to inherit the active schedule via their `program_id` and `version` without per-event duplication, so that schedule resolution stays version-scoped (DEC-078).
47. As a maintainer, I want `get_durability_schedule_for_event` to remain the DB resolution helper, even if downstream analysis does not consume it yet in this slice.

### Portability (existing, verify only)

48. As an admin, I want schedule artifacts included in transfer package export/import with checksum validation, so that program/version schedules survive environment moves (DB14-07/08 — already implemented; regression tests must stay green).

### Testing and maintainability

49. As a maintainer, I want delimiter discovery and row building in a pure client module with unit tests, so that filename logic is testable without React.
50. As a maintainer, I want router tests for GET schedule 200/404 and POST validation edge cases, so that API contracts stay enforced.
51. As a maintainer, I want service tests for parser edge cases (`*summary` stop, missing id/multiplier, zero repeats), so that autodam quirks do not regress.
52. As a maintainer, I want upload-flow behavior tested or manually QA’d (invalidate query, toast, clear file), so that REF-12-23 acceptance criteria are met.
53. As a maintainer, I want save-flow tests for PUT validation, permission checks, and persisted preview round-trip, so that editable table behavior does not regress.

## Implementation Decisions

### Scope posture: finish, not rebuild

- **Preserve DEC-078:** immutable `durability_schedule_artifacts` rows (original `.sch` bytes), `active_durability_schedules` pointer, artifact URI layout, owner/admin attach permissions, audit actions, event inheritance by program/version.
- **One new write endpoint** for saving edited table state (see below). Attach (`POST`) and read (`GET`) remain as implemented.
- **No new tables** expected; extend `parse_preview_json` on the active schedule artifact to carry saved event rows and edited multiplier.

### Existing API contracts (do not break)

**POST** `/api/v1/dashboard/program-version/schedule`  
- Multipart: `program_id`, `version`, `schedule_file` (`.sch` only, non-empty).  
- Auth: `WriteUserDep` + `user_can_edit_program_version`.  
- Response: `DurabilityScheduleAttachResponse` with `replaced_previous`, `previous_schedule_id`, and `parse_preview`.

**GET** `/api/v1/dashboard/program-version/schedule?program_id=&version=`  
- Auth: authenticated (`CurrentUserDep`).  
- 404 when no active schedule; 200 with `DurabilityScheduleContextResponse` when attached.

**PUT** `/api/v1/dashboard/program-version/schedule` *(new)*  
- JSON body: `program_id`, `version`, `multiplier`, `event_rows` (array of per-event schedule row payloads).  
- Auth: `WriteUserDep` + `user_can_edit_program_version` (same as attach).  
- Requires an active schedule for the program/version; 404 if none attached.  
- Updates `parse_preview_json` on the active artifact: preserves original parsed `entries` from `.sch` where possible, stores user-facing state in `event_rows`, updates `multiplier` and `entry_count` as needed.  
- Returns `DurabilityScheduleContextResponse` (same shape as GET).  
- Audit: `DURABILITY_SCHEDULE_EDITED` with actor, program/version, schedule_id, row count.

**Parse preview shape** (`DurabilitySchedulePreview`) — extended for edit/save:

```json
{
  "schedule_id": "string | null",
  "multiplier": 1.0,
  "entry_count": 60,
  "entries": [{ "pattern": "4e1", "repeats": 16, "weight": 0.75 }],
  "entries_preview": [/* first 5 entries */],
  "event_rows": [
    {
      "event_id": "evt-1",
      "rsp_file_name": "mf4e3_100_bt1cc_....rsp",
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

**Table population rule:**  
- If `event_rows` is present and non-empty on GET → hydrate table from saved rows (source of truth for display).  
- Else → build rows client-side from `entries` + events using v2 delimiter/pattern logic, then allow edit/save to persist `event_rows`.

UI consumes **full `entries`** for pattern reference; **`event_rows`** when saved edits exist.

### Backend modules (harden only)

| Module | Responsibility |
|--------|----------------|
| `DurabilityScheduleParser` | Parse autodam `.sch` bytes → metadata + ordered entries + preview JSON. Already mirrors notebook `parse_autodam_schedule`. |
| `DurabilityScheduleStorageService` | Write artifact bytes, upsert ledger row, set active pointer, audit attach/replace. |
| Dashboard router handlers | Form validation, permission checks, map storage result to response models. |

**Hardening tasks (backend):**

- Add router test: GET returns 200 with active schedule; GET returns 404 without.
- Add router tests: reject non-`.sch`, empty file; admin attach on non-owned program/version allowed.
- Add service/router test: re-attach identical checksum → same `schedule_id`, `replaced_previous=false`.
- Add parser tests: stops at `*summary`, handles missing `*id`/`*multiplier`, zero repeats entry.
- Implement PUT save handler + `DurabilityScheduleSaveRequest` / response models.
- Service method: `save_schedule_edits(...)` updates `parse_preview_json` on active artifact, validates numeric fields, logs audit.
- PUT router tests: 200 round-trip, 404 without active schedule, 403 non-owner, 400 invalid numeric payload.
- Optionally reject schedules with zero parsed entries on attach (400) — default **allow** empty entry list but surface `entry_count=0` in UI.

**Do not add** streaming upload, separate preview-only endpoint, or cache invalidation for filter options (schedules do not affect filter caches).

### Frontend modules (primary work)

Extract a **deep client module** for schedule row logic (extend or split from `build-durability-schedule-rows.ts`):

| Function | Interface | Notes |
|----------|-----------|-------|
| `discoverEventDelimiter(fileNames: string[])` | `string \| null` | From v2 notebook; see algorithm below. |
| `rspEventNameFromFile(sourceFile: string, delimiterToken: string \| null)` | `string` | Join tokens before delimiter; fallback to full stem if delimiter absent. |
| `matchSchedulePattern(stem: string, patterns: string[])` | `string \| null` | Longest pattern where `pattern in stem` (bare patterns from server). |
| `buildDurabilityScheduleRows(events, entries)` | `DurabilityScheduleRow[]` | Discover delimiter once from all event filenames; match each event; sort by sequence then filename. |

**Delimiter discovery algorithm** (from `rsp_file_name_extraction_v2.ipynb`):

```
For each filename:
  stem = basename without extension
  tokens = stem.split("_")
  For each token at position p (skip empty, skip duplicate tokens within same file):
    increment file_count for token
    track minimum first_position seen

Pick delimiter = token with max (file_count, -first_position)
```

Example: 57 files with token `bt1cc` at consistent early position → delimiter `bt1cc` → `mf4e3_100_bt1cc_...` → event name `mf4e3_100`.

**Pattern matching algorithm** (v2 notebook, replaces current glob-first-match):

```
matches = [p for p in patterns if p in stem]
return longest match by len(matches) or null
```

Display: wrap pattern as `*pattern*` when no `*` present (keep existing `formatSchedulePattern`).

**Page integration** (`database/edit/page.tsx`):

- Keep `scheduleQuery` + `handleExtractSchedule` flow; invalidate `['program-version-schedule', programId, version]` on success.
- After successful extract, clear `UploadScheduleSection` selected file (callback prop or `selectionKey` bump).
- Hydrate table from `parse_preview.event_rows` when present; otherwise build from `entries` + events via row builder.
- Show empty state when `scheduleQuery.data === null` (404 normalized).
- **Draft state:** mirror channel-map pattern — `scheduleDraftRows` + `baselineScheduleRows` + dirty tracking after initial hydrate/extract.
- **Save handler:** `handleSaveSchedule` → `dashboardApi.saveProgramVersionSchedule(...)` → invalidate schedule query → toast success/error.
- Disable Save when not dirty or while saving; hide/disable Save for read-only users.

**Table** (`DurabilityScheduleTable`):

- Remove or raise `maxVisibleRows=12` default so all rows are visible inside scroll container (padding blank rows optional only for visual minimum height, not as a hard cap on data rows).
- Support **editable mode** when `onRowChange` / `editable` props provided (write users only).
- Readonly column: **RSP File Name**.
- Editable columns: RSP Event Name, Schedule Pattern, Weight, Repeats, Schedule Sequence; Global Multiplier editable once (schedule-level — updating one control updates draft multiplier for all rows on save).
- Use inline `<input>` cells styled like Workbench data cells (not Handsontable); no sorting/filtering in v1.
- Optional Reset control to restore baseline draft from last GET/extract.

**Prior art for save UX:** channel-map tab `handleSaveChannelMap` + Save button disabled-when-clean pattern on the same edit page.

### Deliberately unchanged

- Schedule history list/download UI.
- Wiring schedule into ingestion, plotting, or fatigue analysis pipelines.
- Server-side RSP filename matching on initial build (client-side row builder; server stores saved `event_rows` after save).
- `preload` column (always null until a future schema/parser extension).
- Regenerating or mutating original `.sch` artifact bytes on save (bytes stay immutable; edits are metadata only).

### Reference prototype

Domain exploration lives in `notebooks/rsp_file_name_extraction_v2.ipynb`. Production code should match its **delimiter discovery** and **longest-substring pattern matching** semantics; server parser already matches its `parse_autodam_schedule` cell.

## Testing Decisions

### What makes a good test

- Assert **observable behavior**: API status codes and response shapes, parsed preview fields, row objects returned from pure functions, toast/query invalidation triggers.
- Do **not** test React flex layout, column widths, or internal regex implementation details beyond fixture inputs/outputs.

### Modules to test

| Layer | Module / surface | Priority |
|-------|------------------|----------|
| Client | `discoverEventDelimiter` | High — new logic |
| Client | `rspEventNameFromFile` with discovered delimiter | High |
| Client | `matchSchedulePattern` / longest substring | High |
| Client | `buildDurabilityScheduleRows` | High — update existing test |
| Client | Upload success clears file + invalidates query | Medium — component or handler test |
| Client | Save disabled when clean; save persists and refetches | High |
| Client | Editable cells update draft; RSP file name stays readonly | Medium |
| Server | `DurabilityScheduleParser` edge cases | Medium |
| Server | GET `/program-version/schedule` router | High |
| Server | POST validation + admin + dedupe re-attach | Medium |
| Server | PUT save round-trip + 403/404/400 cases | High |
| Server | Existing attach permission tests | Keep green |

### Prior art

- `client/src/features/edit-metadata/__tests__/build-durability-schedule-rows.test.ts`
- `tests/server/services/test_durability_schedule.py`
- `tests/server/routers/test_durability_schedule_router.py`
- `client/src/lib/api/upload.test.ts` — multipart mock patterns
- `notebooks/rsp_file_name_extraction_v2.ipynb` — fixture filenames for delimiter `bt1cc` and variant event names

### Fixture expectations (minimum)

| Filename | Delimiter | Event name | Pattern (from sample schedule) |
|----------|-----------|------------|--------------------------------|
| `mf4e1_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp` | `bt1cc` | `mf4e1` | `4e1` |
| `mf4e3_100_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp` | `bt1cc` | `mf4e3_100` | `mf4e3_100` |
| `unmatched_event.rsp` | — | per delimiter rules | null |

### Manual QA checklist

1. Database Edit → select program/version with events → Durability Schedule tab.
2. Upload sample `.sch` from `data/raw/13999/v58_data_processing/` → Extract → success toast.
3. Summary line shows schedule id, pattern count, multiplier.
4. Table rows show correct event names for `_100`/`_400` variants.
5. Replace with second `.sch` → replacement toast; active pointer updates.
6. Edit weight/repeats on a row → Save → refresh → values persist.
7. Re-extract new `.sch` → table resets to parsed values (prior manual edits on old attachment gone).
8. Read-only user cannot attach or save (403).
9. Transfer package roundtrip tests remain green.

## Out of Scope

- Separate per-event override table distinct from saved `event_rows` preview metadata.
- Schedule history manager, list API, or download-original UI.
- Server-side filename-to-pattern join on initial build (client row builder; server persists saved rows).
- Downstream consumption in analysis, plotting, or damage inspection.
- Folder glob import of `.rsp`/`.csv` from disk (notebook inventory step — events already in DB).
- Changing artifact storage model, active pointer schema, or DEC-078 decisions.
- E2E Playwright suite (optional follow-up).
- Parsing or displaying `preload` from `.sch`.
- Rate-limit category changes unless missing from route audit (verify only).

## Further Notes

- **DB14-06** marked core backend DONE; this PRD is the **hardening, client-alignment, and editable-save** slice for the wired UI.
- **Extract = persist parsed `.sch`** on attach; **Save = persist user edits** to preview metadata without re-uploading the file.
- When no schedule is attached, the table may show only empty padded rows or an explicit empty message — prefer explicit empty copy plus table shell per Workbench patterns in `docs/brainstorm/18_table_ui/`.
- Global multiplier is schedule-level metadata displayed per row; editing it updates one schedule-level value on save (not per-row weight multiplication).
- If delimiter discovery returns `null` (no filenames or no recurring token), fall back to full stem as event name and still attempt pattern matching.
- Saved `event_rows` should include `event_id` for stable round-trip; server validates rows belong to the program/version event set.
- Coding agent should update `CHANGELOG.md` under `[Unreleased]`, `docs/database-schema.txt` only if schema changes, and append implementation notes to `docs/tasks/` if non-trivial; append DEC entry if save contract is finalized.
- Vertical slices for coding agents: five AFK issues `DSC-19-01` … `DSC-19-05` in `issues/` (publish to GitHub with `ready-for-agent` when `gh` is available).
