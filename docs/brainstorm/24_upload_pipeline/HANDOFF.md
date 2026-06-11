# Handoff — Upload Pipeline Derived Data Tasks (UP-24)

Use this document when picking up any issue in `issues/UP-24-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Make channel assignment, cross-plot LTTB generation, and schedule-driven load-history damage visible, durable, and repairable without turning the app into a heavyweight job system.

The product boundary is strict:

- **Upload/canonicalization** owns raw load histories. **Channel assignment** owns cross-plot data and channel-map lineage.
- **Durability schedule assignment** owns load-history damage calculation.
- **Inspect Damage** reads persisted current/stale damage states rather than silently calculating on read.

Keep the implementation lean. Reuse the existing upload task storage/polling pattern, persist only latest damage rows, and keep failure reports transient.

## What Already Exists

| Area | Status | Notes |
|------|--------|-------|
| Folder upload async task | Existing | Folder upload already starts a background ingestion task and the client polls task status. |
| Upload progress modal | Existing | Upload UI already has a blocking progress/summary modal that can be generalized. |
| Channel-map save/upload | Existing, sync | Assign Channels save and YAML upload already persist channel maps and reprocess retained artifacts, but currently wait synchronously behind toasts. |
| LTTB storage | Existing | `measurements_lttb` already stores cross-plot LTTB data. |
| Raw measurements | Existing | `measurements_raw` stores mapped raw load-history values. |
| Derived-data lineage | Existing | Event derived-data lineage tracks measurement/LTTB current/stale/absent state. |
| Durability schedule upload/save | Existing | Schedule upload, editable event rows, multiplier, reset, and save behavior already exist. |
| Damage calculation | Existing, on demand | Base fatigue damage calculation exists, but is currently called synchronously by Inspect Damage. |
| Damage persistence | Missing | This plan adds a latest-result `event_channel_damage` table. |

## Issue Order

1. `UP-24-01` — Add lean async channel reprocess tasks.
2. `UP-24-02` — Show channel reprocess progress in Assign Channels.
3. `UP-24-03` — Persist latest schedule-driven load-history damage.
4. `UP-24-04` — Add schedule damage progress and repair-report UX.
5. `UP-24-05` — Read persisted damage states in Inspect Damage.
6. `UP-24-06` — Harden derived-data task flows and document rollout.

`UP-24-01` is the foundation. `UP-24-02` can proceed after it. `UP-24-03` can also proceed after it and is the backend foundation for `UP-24-04` and `UP-24-05`. `UP-24-06` closes the loop after the UI slices land.

## Key Behavior

- Public derived task kinds are `channel_reprocess` and `damage_calculation`.
- Do not add a new job framework or separate task table for the first implementation.
- Extend the existing upload-task pattern with a small `task_kind` discriminator and lean progress fields.
- Only one active derived-data task may run per program/version.
- Starting a second operation for the same program/version returns the existing active task id.
- Channel reprocess starts from Assign Channels save and channel-map YAML upload.
- Channel reprocess reads canonical raw load histories, generates cross-plot data, and updates channel-map lineage.
- Channel reprocess does **not** calculate load-history damage.
- Schedule upload/replacement and schedule-row save trigger damage calculation when prerequisites are current.
- Schedule upload must persist generated editable event rows before damage starts.
- Saved schedule event rows are the source of truth for event matching, repeats, weight, and multiplier.
- Damage calculation uses only events matched by saved schedule rows.
- Unscheduled uploaded events are ignored.
- Unmatched schedule rows, blank repeats, blank weight, unresolved channels, and missing/stale prerequisites are hard failures for damage calculation.
- Blank schedule pattern and schedule sequence are UI/reporting metadata and do not fail damage calculation.
- Scheduled damage formula is `base_damage * repeats * weight * multiplier`.
- Persist only latest damage rows in `event_channel_damage`.
- Previous successful damage remains visible as stale after channel/schedule changes or failed recalculation.
- Failure reports remain transient in task result JSON until task expiry.
- The progress modal close action hides the modal only. Processing continues.
- Active background work appears in the scoped Edit Metadata dialog as an inline banner with Reopen progress.
- Inspect Damage reads persisted current/stale/missing damage state. It should not silently fall back to compute-on-read.

## Locked Live Messages

Use this exact domain vocabulary for progress messages:

```text
Validating artifact 3/10: event_042.csv
Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)
Calculating load history damage: event_042 - BJ X Force
```

Keep source strings ASCII unless the surrounding UI already standardizes typographic punctuation.

## Lean Contracts

### Task status payload

Expose only:

- `task_id`
- `task_kind`
- `status`
- `phase`
- `sub_phase`
- `progress_message`
- `completed_events`
- `total_events`
- `current_event`
- `error`
- `result`

Do not expose full task table internals by default.

### Channel reprocess start response

```ts
{
  task_id: string;
  task_kind: 'channel_reprocess';
  reused_existing_task: boolean;
}
```

### Schedule response extension

Schedule upload/save keeps the normal schedule response and adds one of:

```ts
damage_task_id?: string;
damage_prerequisite_report?: DamageFailureReport;
```

If prerequisites are missing/stale, save/upload still succeeds and no task row is created.

### Damage failure report

```ts
{
  summary: string;
  issues: Array<{
    event_id?: string;
    event_name?: string;
    field: 'repeats' | 'weight' | 'rspEventName' | 'schedulePattern' | 'event_id' | 'channel';
    code: string;
    message: string;
  }>;
}
```

`event_name` should prefer saved RSP event name, then RSP file name, then event id.

### Damage latest-result row

The durable table is `event_channel_damage`. Store one latest row per event/channel with:

- event id;
- channel key;
- channel name;
- channel unit;
- base damage;
- scheduled damage;
- repeats;
- weight;
- multiplier;
- schedule id;
- schedule SHA-256;
- status: `current`, `stale`, or `error`;
- stale reason;
- optional error;
- updated timestamp.

## Boundaries

- Do not implement a full job queue.
- Do not create a separate generic processing task table in the first pass.
- Do not persist every damage run or every failure report.
- Do not add multi-schedule damage comparison or history.
- Do not redesign the LTTB algorithm.
- Do not add per-plot/per-channel progress counters to the database.
- Do not implement cooperative or hard cancel unless a later issue explicitly asks for it.
- Do not change the channel-map domain model.
- Do not change `.sch` parser grammar.
- Do not remove the existing upload progress pattern.
- Do not add a global background task center; use the scoped Edit Metadata banner.

## Verification Focus

- Assign Channels save/upload starts a background `channel_reprocess` task.
- Channel reprocess writes the same raw measurements and LTTB rows as the existing synchronous path.
- Large channel reprocess no longer depends on one long browser request.
- Polling is creator-scoped.
- Existing folder upload behavior is not regressed by extending task storage.
- Schedule upload persists generated event rows before damage starts.
- Schedule save/upload either starts damage or returns a prerequisite report.
- Damage validation failures fail the whole damage task with a compact report.
- The schedule repair report highlights affected editable fields.
- Saving repaired schedule rows automatically retries damage.
- `event_channel_damage` stores latest current/stale values only.
- Stale damage remains visible after channel/schedule changes and after failed recalculation.
- Inspect Damage does not silently compute on read when no persisted result exists.
- UI progress uses the locked live messages.

## Suggested Implementation Notes

- Keep the derived-task orchestration surface small. A thin service that creates/reuses tasks, updates progress, and runs a worker is enough.
- Prefer adding small repository methods for `event_channel_damage` rather than spreading raw SQL across routers/services.
- Keep schedule damage validation separate from calculation so tests can cover repair reports without running expensive fatigue math.
- Keep client progress mapping in one helper so upload, channel reprocess, and damage calculation do not drift.
- For the schedule repair report, map server `field` values directly to existing editable schedule table fields.
- The first implementation can keep failure reports in task `result_json`; if users later need long-lived audit history, treat that as a separate database-improvement feature.

## Documentation Updates When Shipping

- Add an `[Unreleased]` entry to `CHANGELOG.md` for visible channel/damage processing progress.
- Update `docs/master-build-plan.md` if UP-24 becomes tracked roadmap work.
- Create `docs/tasks/UP-24-*.md` implementation notes for completed non-trivial slices.
- Update `docs/database-schema.txt` when adding `event_channel_damage` or task columns.
- Append `docs/decisions/log.md` only if implementation makes a durable decision beyond this PRD, such as introducing a new task abstraction boundary.
