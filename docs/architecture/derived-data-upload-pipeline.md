# Derived-data upload pipeline

This document describes the lean derived-data task model introduced in Phase 24 (UP-24) and the post-upload precompute orchestration added in Phase 27 (PPU-27). It is the rollout reference for future agents working on channel assignment, schedule damage, or Inspect Damage.

## Product boundaries

- **Upload/canonicalization** owns raw load histories (`measurements_raw`). These rows are full-resolution canonical analytical data derived from the uploaded/converted CSV and are not rewritten by Assign Channels.
- **Channel assignment** owns channel-map state, cross-plot LTTB data (`measurements_lttb`), and channel-map lineage. Assign Channels save and channel-map YAML upload start a `channel_reprocess` task that reads existing `measurements_raw` and regenerates LTTB only. Channel assignment does **not** calculate load-history damage.
- **Durability schedule assignment** owns load-history damage. Schedule upload/replacement and schedule-row save persist editable event rows, then either start a `damage_calculation` task or return a prerequisite report when derived data is missing or stale.
- **Inspect Damage** reads persisted rows from `event_channel_damage`. It does not silently compute damage on read.

## Canonical channel lookup (IDM-28)

Plot mappings are defined **version-wide by zero-based column index** (`x_col`, `y_col`). Persisted channel-map lookup names use generic `col_N` values — not the first artifact’s human-readable titles.

At compute time (damage calculation, channel reprocess, and any other raw-measurement reader that shares plot mappings), resolve lookup channel names **per event** from that event’s stored preview headers:

```
channel map: x_col, y_col          (version-wide contract)
event headers: preview metadata    (per event)
lookup name: headers[x_col], headers[y_col]
query measurements_raw by resolved names
```

Header source priority:

1. Stored event preview metadata headers list (canonical ingest preview).
2. Retained ingestion artifact preview `#TITLES` row for that event’s source file.
3. Legacy fallback: generic `col_N` pattern matching against distinct raw channel names when headers are unavailable.

**Deprecated:** persisting the first retained artifact’s title strings in `dim_channel_map` as the version-wide lookup key. Re-save Assign Channels (or YAML upload) to normalize existing maps to index-based storage before rerunning derived tasks.

**Recovery for affected program/versions** (no re-upload when `measurements_raw` is already populated):

1. Re-save channel map so `dim_channel_map` stores index-based `col_N` lookup names.
2. Run **channel reprocess** for the program/version.
3. Run **Calculate Damage** (or open Inspect Damage as a write user to auto-backfill when eligible).

Mixed cohorts where some events have `current` damage and others have `error` rows are repairable: automatic backfill and channel-reprocess follow-up start a full scheduled recalculation when prerequisites are current. Stale-only scopes remain inspectable and do not auto-backfill.

## Task storage model

Derived-data tasks reuse the existing `upload_tasks` table with a `task_kind` discriminator:

| Kind | Trigger | Purpose |
|------|---------|---------|
| `folder_upload` | Folder/RSP upload | Existing ingestion pipeline (unchanged behavior) |
| `channel_reprocess` | Assign Channels save, channel-map YAML upload | Cross-plot LTTB + channel-map lineage |
| `damage_calculation` | Schedule upload/save (when prerequisites current), channel reprocess completion (when schedule exists), Inspect Damage backfill (write users, missing rows) | Validate schedule rows, compute scheduled damage, persist latest rows |

Only **one active derived-data task** (`queued` or `running`) is allowed per program/version. Starting another channel or schedule operation returns the existing task id with `reused_existing_task: true` and the **actual** stored `task_kind`.

Polling uses `GET /api/v1/dashboard/derived-data/task/{task_id}` and is **creator-scoped**: only the user who started the task can read its status.

## Progress UX contract

- Long-running work does not depend on a single synchronous browser request.
- The progress modal is **close-only**. Closing it hides the modal; processing continues.
- Active background work appears as a scoped inline banner in Edit Metadata with **Reopen progress**.
- Progress stores coarse phase bands, completed/total event counts, and one live message. Locked message vocabulary:

```text
Validating artifact 3/10: event_042.csv
Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)
Calculating load history damage: event_042 - BJ X Force
```

## Damage persistence model

`event_channel_damage` is a **latest-result cache**, not an audit ledger:

- One row per event/channel (latest successful or stale result).
- Status values: `current`, `stale`, `error`.
- Channel or schedule changes mark prior `current` rows as `stale` without deleting them.
- Failed recalculation preserves previous stale values for comparison.
- Scheduled damage = base damage × repeats × weight × multiplier.

**Failure reports** (validation/prerequisite issues) remain **transient** in task `result_json` until task expiry. They are not durably stored beyond what the UI needs during the repair loop.

## Repair loop

When damage validation fails inside a task:

1. The task fails with a compact `failure_report` in `result`.
2. The schedule editor reopens with the summary and highlighted editable fields (`repeats`, `weight`, `rspEventName`, etc.).
3. Saving corrected schedule rows automatically retries damage calculation when prerequisites are current.

## Post-upload precompute (PPU-27)

Phase 27 adds a small server-side orchestrator that connects upload, channel reprocess, schedule save, and Inspect Damage access without a new job framework.

### Automatic trigger points

| Milestone | Entry point | Typical outcome |
|-----------|-------------|-----------------|
| Channel reprocess completion | `decide_after_channel_reprocess_completion()` | Start/reuse `damage_calculation` when an active schedule exists and prerequisites pass; `no_op` when unscheduled or damage already current; `blocked` when prerequisites fail |
| Schedule attach/save | `decide_after_schedule_save()` | Start/reuse `damage_calculation`, `rescale_scheduled_damage` for scaling-only edits with current base damage, or `blocked` when channel prerequisites missing |
| Inspect Damage access (write users) | `decide_after_inspect_damage_access()` via `POST /damage/backfill` | Start/reuse `damage_calculation` when scheduled events lack complete current damage; `no_op` when all scheduled channels are `current` or when only `stale` rows exist; read-only users never call this path |

### Idempotency rules

- Given the same program/version state and active task state, orchestrator decisions are deterministic.
- Repeated completion events or repeated backfill calls reuse the active `damage_calculation` task instead of creating duplicates.
- Only one active derived-data task (`channel_reprocess` or `damage_calculation`) is allowed per program/version at a time.
- Schedule save with missing channel prerequisites persists valid schedule rows but returns `blocked` without starting a doomed task; later channel completion finishes damage when prerequisites become current.

### Damage model constraints enforced by precompute

- Damage calculation uses **schedule-matched events only** (`pattern` non-blank in saved `event_rows`). Unscheduled uploaded events are ignored.
- Missing or invalid schedule prerequisites never produce partial scheduled damage rows; validation fails the whole task and prior successful values remain inspectable as `stale`.
- Rescale-only schedule edits (`repeats`, `weight`, `multiplier`) reuse current persisted base damage synchronously. Missing, stale, or error base damage and event-match changes fall back to full `damage_calculation`.
- Automatic failures preserve previous successful damage rows as `stale`; they are never mistaken for current results.

### Workflow-order independence

These orderings converge to the same current derived state:

1. **Schedule before channel assignment** — schedule save is blocked or no-ops on damage until channel reprocess completes; channel completion then auto-starts damage.
2. **Channel assignment before schedule** — channel reprocess completes with no damage task; schedule attach/save starts damage when prerequisites are current.
3. **Inspect Damage repair** — write users with missing or incomplete persisted rows (errors or partial `current` populations) and ready prerequisites auto-start/reuse damage; repeated visits no-op once all scheduled channels are `current`. Stale-only scopes remain inspectable without automatic recalculation.
4. **Read-only Inspect Damage** — inspect reads persisted rows only; `POST /damage/backfill` returns 403 and never mutates.

### Follow-up exclusions (out of scope)

- No generic background processing platform, global task center, or new public task kind.
- No durable audit history for every automatic precompute attempt.
- No cooperative cancellation of running derived-data tasks.
- Toast-only visibility for blocked automatic precompute; detailed repair UX remains in schedule editor and manual Calculate Damage flows.

## What this deliberately avoids

- No separate job framework or generic processing task table.
- No durable history for every damage attempt or failure report.
- No cooperative/hard cancellation of running tasks.
- No per-plot/per-channel progress counters in the database.
- No global background task center; scoped Edit Metadata banner only.

## Key modules

| Area | Module |
|------|--------|
| Task orchestration helpers | `server/services/derived_data_task.py` |
| Post-upload precompute orchestrator | `server/services/post_upload_precompute.py` |
| Schedule-only damage rescale | `server/services/schedule_damage_rescale.py` |
| Channel reprocess worker | `server/services/ingestion.py` |
| Damage calculation worker | `server/services/damage_calculation_task.py` |
| Schedule validation | `server/services/schedule_damage_validation.py` |
| Persisted inspect reads | `server/services/damage_inspect.py` |
| Partial damage repair policy | `server/services/scope_damage_repair.py` |
| Client progress modal | `client/src/features/edit-metadata/DerivedDataOperationModal.tsx` |
| Channel reprocess store | `client/src/stores/channel-reprocess-store.ts` |
| Damage calculation store | `client/src/stores/damage-calculation-store.ts` |

## Verification entry points

- Post-upload precompute orchestrator: `tests/server/services/test_post_upload_precompute.py`
- Precompute idempotency and workflow permutations: `tests/server/services/test_post_upload_precompute_hardening.py`
- Schedule-only rescale: `tests/server/services/test_schedule_damage_rescale.py`
- Server hardening: `tests/server/services/test_derived_data_task_hardening.py`
- Channel reprocess: `tests/server/services/test_channel_reprocess_task.py`
- Damage calculation: `tests/server/services/test_damage_calculation_task.py`
- Creator-scoped poll: `tests/server/routers/test_dashboard_router.py`
- Folder upload regression: `tests/server/routers/test_upload_router.py`
- Client cross-flow: `client/src/features/edit-metadata/__tests__/derived-data-cross-flow.test.ts`
- Inspect Damage backfill planning: `client/src/features/inspect-damage/__tests__/plan-inspect-damage-backfill-attempts.test.ts`
- Mixed cohort partial repair: `tests/server/services/test_scope_damage_repair.py`
- Mixed cohort recovery e2e: `tests/server/services/test_idm28_mixed_cohort_recovery.py`
- Damage router backfill/idempotency: `tests/server/routers/test_damage_router.py`
