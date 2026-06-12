# IMPLEMENTATION_MAP — Damage Pipeline Refactor (DPR-31)

This map is the shared technical truth for all `DPR-31-*` slices.

## End-to-end flow and state model

```text
Schedule upload/save command
  -> validate schedule + prerequisites
  -> if invalid: return validation report; do not calculate
  -> if valid: clear prior scope damage rows
  -> start/reuse one active damage calculation task
  -> task persists per-cell current/error/unavailable outcomes
  -> task status ends in completed or failed

Inspect Damage query
  -> read selected event rows + persisted damage rows
  -> read task/schedule status
  -> render table + running/failed context
  -> no mutation, no task start, no backfill
```

## Canonical invariants

1. Schedule save/upload is the default command path that starts calculation.
2. Inspect Damage is query-only and never mutates state.
3. One active calculation task per program/version scope.
4. Accepted new schedule clears stale scope damage before recalculation.
5. UI-visible task states are `validating`, `calculating`, `completed`, `failed`.
6. UI-visible cell states are `current`, `error`, `unavailable`.

## Ownership boundaries

- **Damage pipeline service owns**
  - schedule validation and prerequisite checks
  - prior-result cleanup for accepted schedules
  - active-task dedupe/reuse policy
  - calculation execution and persistence
  - task lifecycle state and failure reporting
- **Inspect Damage backend query owns**
  - selected-row hydration
  - persisted cell read model
  - read-only task/schedule status summary
- **Inspect Damage frontend owns**
  - selection/filter/table/plot rendering
  - banners for running or failed calculation
  - no lifecycle policy decisions
- **Schedule upload/save frontend owns**
  - command invocation
  - validation and calculation progress display

## Cross-layer contracts

- **Schedule command response**
  - must expose one of: validation blocked, calculation started/reused, calculation failed-to-start
  - includes status vocabulary aligned to `validating|calculating|completed|failed`
  - command contract fields: `schedule_command_outcome`, `damage_task_id`, `damage_task_status`, `damage_prerequisite_report`
- **Inspect read response**
  - always includes selected events, even when no persisted damage cells exist
  - includes per-cell `current|error|unavailable`
  - may include read-only task status metadata for running/failed banners
- **Task dedupe contract**
  - repeated schedule save for same scope must not create duplicate active tasks

## Existing decisions to preserve

- Keep fatigue damage formula and channel math semantics unchanged.
- Keep auth and owner/admin write guards on mutation endpoints.
- Keep existing task polling model unless a failure proves it cannot meet the PRD.

## Forbidden shortcuts

- No Inspect page-load mutation fallback.
- No stale/backfill/repair/rescale legacy states in normal UX vocabulary.
- No broad refactor outside the damage lifecycle area.
- No migration logic to preserve legacy partial damage rows; use reset-first semantics.

## Slice notes

- `DPR-31-03` confirms worker persistence semantics:
  - missing-channel rows persist as explicit `unavailable` cells;
  - calculation failures persist as `error` cells;
  - successful channels persist as `current` cells in the same scope run;
  - unexpected task exceptions persist `failure_report` in task result payload for query surfaces.
- `DPR-31-04` confirms inspect query-only behavior:
  - inspect scope hydration no longer calls repair/prerequisite policy checks;
  - inspect still returns selected event rows when no persisted cells exist;
  - inspect scope state keeps read-only running/failed task context (`active_damage_task_id`, `failure_report`) without starting tasks.
- `DPR-31-05` confirms inspect frontend read-only lifecycle behavior:
  - inspect page load no longer auto-starts backfill/calculation;
  - running task state is shown via explicit banner/copy from read-only scope metadata;
  - persisted `unavailable` cells render directly so selected rows stay visible with partial results.
