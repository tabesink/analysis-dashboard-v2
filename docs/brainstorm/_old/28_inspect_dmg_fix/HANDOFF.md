# Handoff — Per-Event Channel Resolution for Inspect Damage (IDM-28)

Use this document when picking up any issue in `issues/IDM-28-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Fix blank Inspect Damage cells caused by **channel title mismatch across events in the same program/version**. The channel map must remain **column-index based**; each event must resolve lookup names from **its own stored headers** when reading `measurements_raw` for damage and channel reprocess.

Do **not** fix this with filename heuristics or growing legacy string pattern lists.

## Confirmed Production Example

| Scope | `002` / `v02`, 57 events, active schedule |
|-------|---------------------------------------------|
| Working cohort | 18 files with titles like `1 1 LR LCA OtrBJ P_UG_X Force` → 12 `current` damage rows each |
| Failing cohort | 39 files with titles like `1 1 LR LBJ - Fx` at the same columns → 12 `error` rows each |
| Persisted error | `No measurements found for mapped channel '1 1 LR LCA OtrBJ P_UG_X Force'` |
| Raw data | Present for failing events; lookup string wrong |

Active dev database during investigation: `dashboard-test-20260609-152513.db` (not empty `dashboard.db`).

## What Already Exists

| Area | Status | Notes |
|------|--------|-------|
| Upload LTTB via column indices | Works | Uses dataframe `x_col`/`y_col` per file |
| Version-wide `dim_channel_map` | Problem | Stores first-artifact title strings |
| Damage raw lookup | Problem | Exact match on version-wide title strings |
| Channel reprocess raw lookup | Problem | Same string join as damage |
| Legacy `col_N` pattern matcher | Partial | Skipped when explicit titles persisted |
| Event preview headers | Exists | Stored at ingest; use as primary header source |
| Derived-data tasks / Inspect read model | OK | Orchestration and persisted reads are not the bug |

## Canonical Rule (target)

```
channel map: x_col, y_col  (version-wide)
event headers: from event preview (per event)
lookup name: headers[x_col], headers[y_col]
query measurements_raw by resolved names
```

## Issue Order

1. `IDM-28-01` — Shared per-event channel resolver + header provider.
2. `IDM-28-02` — Persist index-based channel map (`col_N`); stop freezing first-file titles.
3. `IDM-28-03` — Wire resolver into damage calculation / damage channel series lookup.
4. `IDM-28-04` — Wire resolver into channel reprocess LTTB extraction.
5. `IDM-28-05` — Recovery, partial-damage recalc behavior, docs, regression tests.

`IDM-28-01` is the foundation. `IDM-28-02` prevents new bad maps. `IDM-28-03` fixes Inspect Damage empties. `IDM-28-04` aligns cross-plot regeneration. `IDM-28-05` covers operator recovery and mixed-cohort recalculation policy.

## Recovery for Affected Versions

1. Re-save channel map (index-based / `col_N` persisted).
2. Run channel reprocess for the program/version.
3. Run damage calculation — automatic via Inspect Damage backfill (write users) or manual **Calculate Damage** when mixed `current`/`error` populations remain.

No re-upload needed when `measurements_raw` is already populated.

### Partial damage repair policy (IDM-28-05)

| Scope state | Auto backfill | Manual Calculate Damage |
|-------------|---------------|-------------------------|
| No persisted rows | Starts when prerequisites current | Starts when prerequisites current |
| All scheduled channels `current` | No-op | No-op (already complete) |
| Mixed `current` + `error` (e.g. `002/v02`) | Starts full recalculation | Starts full recalculation |
| Stale-only rows | No-op (values still inspectable) | Starts when user explicitly requests |

Server module: `server/services/scope_damage_repair.py`. Inspect scope exposes `needs_damage_repair` for client backfill planning.

## Key References

- Derived-data boundaries: `docs/architecture/derived-data-upload-pipeline.md`
- Assign Channels / channel reprocess: UP-24, AC-25
- Post-upload damage precompute: PPU-27
