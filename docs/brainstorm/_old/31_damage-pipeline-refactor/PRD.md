# PRD: Simplify Damage Pipeline and Make Inspect Damage Read-Only

## Problem Statement

The current Inspect Damage experience is more complex than the product needs. When a user opens Inspect Damage, the route may load persisted damage values, detect missing or stale damage, trigger backfill, reuse an active calculation task, poll for task completion, and update the table after calculation. This makes the UI feel indirect: selected event rows do not reliably populate as a simple saved-results table, and the user sees a confusing “loading damage” or damage-calculation process from a page that should primarily inspect results.

From the user’s perspective, the desired workflow is simpler:

1. Upload event/RSP data.
2. Upload a durability schedule.
3. Validate the schedule.
4. If valid, run the damage calculation pipeline immediately.
5. Persist calculated damage values.
6. Use Inspect Damage only to view persisted values.

The existing backfill concept creates avoidable entropy because it supports partial, stale, legacy, and lazy-calculated states that are not needed if the project can reset and reupload data from scratch.

## Solution

Refactor the damage lifecycle so that durability schedule upload/save is the only normal trigger for damage calculation. Inspect Damage should become a read-only persisted-results view and must not start or backfill calculations when the page is opened.

The simplified lifecycle should be:

1. A user uploads or saves a durability schedule for a program/version scope.
2. The backend validates the schedule and required channel/event prerequisites.
3. If validation passes, the backend invalidates or deletes existing damage rows for that scope.
4. The backend starts a damage calculation task.
5. The task calculates per-event, per-channel damage and persists current/error results.
6. The UI displays calculation progress from the schedule upload or calculation status flow.
7. Inspect Damage reads saved damage values only.

If a user opens Inspect Damage before calculation completes, the page should render the selected events and show a clear banner such as “Damage calculation is still running for this schedule.” If calculation failed, the page should show the failure summary and avoid silently triggering repair/backfill.

## User Stories

1. As an admin/user with write permissions, I want durability schedule upload to automatically validate and calculate damage, so that I do not need to visit Inspect Damage to trigger calculation.

2. As an engineer inspecting results, I want Inspect Damage to load saved damage values only, so that the page behavior is predictable and does not launch hidden background work.

3. As an engineer, I want selected event rows to appear immediately even when damage values are unavailable, so that I can see what scope I am inspecting.

4. As an engineer, I want each unavailable damage value to have a clear state, so that I can distinguish not calculated, running, failed, and unavailable prerequisites.

5. As an admin, I want old damage rows to be cleared/replaced whenever a new durability schedule is accepted, so that stale values cannot be mistaken for current results.

6. As a developer/coding agent, I want the damage lifecycle owned by a small number of public service operations, so that the workflow can be tested at the boundary instead of through many shallow helper seams.

## Implementation Decisions

- Treat durability schedule upload/save as a command that validates the schedule and starts calculation when valid.
- Treat Inspect Damage as a query/read model only. It must not start calculation, trigger backfill, or mutate damage state.
- Remove or disable lazy backfill behavior from the Inspect Damage route.
- Remove or defer stale-damage repair/rescale behavior unless there is a proven performance requirement.
- When a new schedule is accepted for a program/version scope, delete or invalidate previous damage rows for that scope before starting a full recalculation.
- Preserve the existing core damage calculation algorithm where possible. The goal is to simplify orchestration, not rewrite fatigue math.
- Keep a persistent task/status record for schedule-triggered damage calculation.
- Return simple calculation states to the UI: `validating`, `calculating`, `completed`, `failed`.
- Return simple damage cell states to Inspect Damage: `current`, `error`, `unavailable`. Avoid exposing `stale`, `needs_recalc`, `backfill_needed`, or `stale_only` in the simplified UX.
- The main deep module should own: schedule validation, prerequisite checks, clearing prior results, starting calculation, persisting results, and reporting task status.
- The frontend Inspect Damage page should own rendering, selection, filtering, table preferences, and plotting only. It should not own damage lifecycle policy.
- The frontend schedule upload/calculation flow should display progress and final success/failure state.
- Because old data can be discarded, no backward-compatible migration of legacy/stale/backfill states is required for this change.

## Testing Decisions

Test behavior at module and API boundaries. Prefer replacing shallow helper tests with boundary tests that describe the simplified lifecycle.

Required backend tests:

- Schedule upload/save with valid schedule starts exactly one damage calculation task.
- Schedule upload/save with invalid schedule does not start calculation and returns a validation/prerequisite report.
- New accepted schedule clears or invalidates existing damage rows for the same program/version scope.
- Damage calculation persists one result per scheduled event/channel where channel data exists.
- Damage calculation persists explicit error cells for unavailable or failed channels.
- Inspect Damage returns persisted rows and never starts a calculation task.
- Inspect Damage returns selected event rows even when no damage values are available.
- Inspect Damage reports running/failed calculation state without mutating state.
- Repeated schedule save should reuse or prevent duplicate active tasks for the same scope.

Required frontend tests:

- Inspect Damage does not call any backfill endpoint.
- Inspect Damage renders selected events immediately when damage response is empty or calculation is running.
- Inspect Damage shows a running banner when calculation is active.
- Inspect Damage shows a failure banner/report when calculation failed.
- Schedule upload success displays calculation-started/progress state.
- Manual calculate action, if retained, uses explicit user intent and does not run automatically from Inspect Damage access.

Prior similar examples to inspect:

- Existing damage inspect response tests, if present.
- Existing derived data task/progress tests, if present.
- Existing upload/schedule validation tests, if present.
- Existing frontend tests for Inspect Damage view state or task progress, if present.

## Out of Scope

- Preserving legacy partially calculated damage data.
- Supporting stale-only damage states.
- Optimizing schedule-scaling-only changes by rescaling old damage rows.
- Complex repair flows triggered by opening Inspect Damage.
- Replacing the fatigue damage calculation algorithm.
- Replacing DuckDB or reworking the full persistence architecture.
- Adding distributed queues unless current in-process task execution cannot support the expected small-team deployment.
- Redesigning the full Inspect Damage UI/UX beyond removing hidden backfill behavior and clarifying status states.

## Further Notes

Backfill currently means lazy calculation/repair of missing persisted damage after Inspect Damage access. This PRD intentionally removes that product behavior.

The desired invariant is:

> A validated active durability schedule should have either a running calculation task, completed current damage results, or an explicit failed calculation state. Inspect Damage should not be responsible for making that invariant true.

The highest-value architectural simplification is to move policy from the Inspect Damage page and backfill endpoint into the schedule-triggered damage pipeline.
