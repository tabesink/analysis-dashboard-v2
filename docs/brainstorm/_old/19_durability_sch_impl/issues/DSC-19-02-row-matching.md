# DSC-19-02: v2 notebook schedule row matching module

**Type:** AFK  
**Effort:** Medium  
**Labels:** `ready-for-agent`

## Parent

[prd.md](../prd.md) · [HANDOFF.md](../HANDOFF.md)

## What to build

Replace the current first-segment / glob-first-match logic with a **pure client module** that mirrors `notebooks/rsp_file_name_extraction_v2.ipynb`:

1. `discoverEventDelimiter(fileNames)` — shared underscore token marking end of event name (max file_count, then earliest position).
2. `rspEventNameFromFile(sourceFile, delimiterToken)` — join tokens before delimiter; fallback to full stem if delimiter missing.
3. `matchSchedulePattern(stem, patterns)` — longest substring match (`pattern in stem`).
4. `buildDurabilityScheduleRows(events, entries)` — discover delimiter once from all event `source_file` values; match each event; sort by schedule sequence then filename; format display patterns with `*` when absent.

This slice is **demoable via unit tests** without page wiring changes (page integration is DSC-19-03).

**Prototype reference (delimiter pick logic):**

```
Pick delimiter token = max over tokens by (file_count, -first_position)
Event name = tokens before delimiter joined with "_"
Pattern = longest pattern in stem
```

## Acceptance criteria

- [ ] `discoverEventDelimiter` returns `bt1cc` for standard fixture filenames in PRD
- [ ] `mf4e3_100_bt1cc_....rsp` → event name `mf4e3_100` (not `mf4e3`)
- [ ] `mf4e1_bt1cc_....rsp` with pattern `4e1` in schedule → matches `4e1` via substring
- [ ] Unmatched events appear with empty pattern and null schedule fields
- [ ] `build-durability-schedule-rows.test.ts` updated; all cases pass
- [ ] No React/page changes required in this slice (lib + tests only)

## Blocked by

None — can start immediately

## Agent handoff

**Read first:** [HANDOFF.md](../HANDOFF.md), `notebooks/rsp_file_name_extraction_v2.ipynb` (cells with `discover_event_delimiter`, `match_schedule_file_names`), current `build-durability-schedule-rows.ts`.

**User stories:** 23–27, 49.

**Fixture table (PRD):**

| Filename | Delimiter | Event name | Pattern |
|----------|-----------|------------|---------|
| `mf4e1_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp` | `bt1cc` | `mf4e1` | `4e1` |
| `mf4e3_100_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp` | `bt1cc` | `mf4e3_100` | `mf4e3_100` |
| `unmatched_event.rsp` | — | per rules | null |

**Do not implement:** PUT API, editable cells, upload UX polish.

**Suggested skill:** `tdd`
