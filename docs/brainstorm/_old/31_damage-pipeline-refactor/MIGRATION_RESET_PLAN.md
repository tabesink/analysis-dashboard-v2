# Migration / Reset Plan

## Assumption

Old data does not need to be preserved. The user will reupload all source data from scratch.

## Recommended reset strategy

Prefer a reset-first rollout instead of complex compatibility migration.

### Option A: Full local reset for development/staging

1. Stop backend/frontend.
2. Back up existing local data directory if desired.
3. Delete or archive current dashboard database and derived artifacts.
4. Start application with a clean database.
5. Reupload source data.
6. Upload durability schedule.
7. Confirm calculation runs and Inspect Damage reads persisted results.

### Option B: Targeted reset if full DB deletion is not practical

Clear only damage-related state (program/version scoped):

- event-channel damage rows
- durability schedule rows and active schedule flags
- derived-data task rows for `damage_calculation` and `channel_reprocess`
- temporary task/progress artifacts

Then reupload/recalculate.

#### Executable path (preferred for scoped reset)

Use the existing scope-delete API, which now clears all of the above for the selected scope:

1. Call `POST /api/v1/upload/program-version/delete` with `{ "program_id": "...", "version": "..." }`.
2. Reupload source data for that scope.
3. Re-attach or save the durability schedule.
4. Confirm schedule command response returns one of:
   - `schedule_command_outcome=calculation_started`
   - `schedule_command_outcome=reused_active_task`
   - or `validation_blocked` with explicit prerequisite report.

#### Verification checks after scoped reset

- `event_channel_damage` has no rows for the deleted scope before reupload.
- No scoped `upload_tasks` rows remain for `damage_calculation`/`channel_reprocess`.
- No active durability schedule remains for the deleted scope.

## Rollout sequence

1. Implement simplified pipeline behind tests.
2. Disable frontend auto-backfill calls.
3. Disable or deprecate backend backfill endpoint.
4. Reset local data.
5. Reupload test dataset.
6. Upload schedule and verify automatic calculation.
7. Validate Inspect Damage read-only behavior.

## Data integrity rule

After reset, the system should not carry forward any state requiring:

- stale repair
- backfill
- rescale-only updates
- legacy partial damage preservation
