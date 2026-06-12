# Implementation Handoff: Damage Pipeline Simplification

## Mission

Simplify the damage calculation lifecycle so Inspect Damage is a read-only persisted-results view. Durability schedule upload/save should validate, trigger calculation, and persist results.

## Product invariant

After this refactor:

```text
Validated durability schedule
  -> calculation task running/completed/failed
  -> persisted damage values or explicit failure state
  -> Inspect Damage only reads and displays persisted state
```

Inspect Damage must not perform lazy backfill or start hidden calculation tasks.

## Current behavior to remove/simplify

Current behavior has these responsibilities split across frontend and backend:

```text
Inspect Damage opened
  -> read persisted damage rows
  -> inspect scope state
  -> detect missing/stale/repair state
  -> frontend plans backfill attempts
  -> frontend calls backfill endpoint
  -> backend decides whether to start/reuse task
  -> frontend polls and refreshes
```

Replace it with:

```text
Schedule uploaded/saved
  -> validate prerequisites
  -> delete/replace prior results for scope
  -> start calculation task
  -> persist current/error results

Inspect Damage opened
  -> read persisted results
  -> render rows/cell states/status banners
```

## Implementation outline

### 1. Introduce or deepen a pipeline service

Create or consolidate around a service boundary that owns the schedule-triggered lifecycle.

Public operations should be small and behavior-oriented:

```text
submit_schedule(...)
start_calculation_for_scope(...)
get_calculation_status(...)
inspect_results(...)
```

The implementation can hide schedule validation, prerequisite checks, task creation/reuse, damage row deletion, calculation execution, progress updates, and persistence.

### 2. Move auto-calculation trigger to schedule save

When a durability schedule is accepted:

1. Parse and validate schedule.
2. Check event/channel prerequisites.
3. If blocked, persist/report blocked state and do not calculate.
4. If valid, clear old damage for the scope.
5. Start damage calculation task.
6. Return task id/status to the UI.

### 3. Remove lazy Inspect Damage backfill

Remove or disable:

- Automatic frontend backfill attempt planning from Inspect Damage.
- Backfill mutation called from Inspect Damage page load.
- Backend decision path that starts calculation because Inspect Damage was opened.
- UI copy that implies Inspect Damage is responsible for calculation.

The backfill endpoint may be removed or left deprecated only if tests prove it is unused. If retained temporarily, it should not be called by Inspect Damage.

### 4. Simplify state vocabulary

Use schedule/task-level states:

```text
validating
calculating
completed
failed
```

Use cell-level states:

```text
current
error
unavailable
```

Do not expose or depend on these legacy states in the normal UI:

```text
stale
stale_only
needs_recalc
backfill_needed
repair_state
rescale_eligible
```

### 5. Make Inspect Damage render immediately

Inspect Damage should render selected event rows as soon as selected event metadata is known. Damage values can be absent per cell.

Recommended display states:

```text
current value
— / unavailable
error
calculation running banner
calculation failed banner
```

### 6. Reset/migration approach

Because old data does not matter, prefer a reset-first migration:

- Clear prior damage rows.
- Clear old schedule rows or mark only newly uploaded schedules as active.
- Clear stale derived task rows.
- Reupload/import source data.
- Upload schedule and calculate fresh.

Avoid writing complex migration code to preserve stale/backfill semantics.

## Coding-agent guardrails

- Do not rewrite fatigue math unless necessary.
- Do not introduce a distributed queue unless tests/profiling show the current task execution model is insufficient.
- Do not add new stale/repair/rescale states.
- Do not make Inspect Damage mutate backend state.
- Prefer boundary tests over unit tests for tiny helper functions.
- Keep API behavior explicit: commands mutate, queries read.
