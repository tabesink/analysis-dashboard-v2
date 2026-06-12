## Problem Statement

The current Inspect Damage workflow is more complex than the product needs. Opening Inspect Damage can read persisted damage rows, detect missing/stale damage, trigger backfill, reuse an active calculation task, poll for completion, and update the table after calculation. This makes the route feel indirect and makes the codebase harder to reason about.

The desired workflow is simpler: users upload event data, upload a durability schedule, the backend validates the schedule, immediately runs damage calculation when valid, persists calculated values, and Inspect Damage reads saved values only.

## Solution

Refactor the damage lifecycle so durability schedule upload/save is the normal trigger for damage calculation. Inspect Damage becomes a read-only persisted-results view and must not start calculations or run backfill logic on page access.

New lifecycle:

1. User uploads/saves durability schedule for a program/version scope.
2. Backend validates schedule and prerequisites.
3. Backend clears/replaces old damage rows for that scope.
4. Backend starts damage calculation task.
5. Task persists per-event, per-channel current/error results.
6. Inspect Damage reads and renders persisted results only.

## User Stories

1. As a write-enabled user, I want a valid durability schedule upload to automatically start damage calculation, so that results are prepared without opening Inspect Damage.
2. As an engineer, I want Inspect Damage to be read-only, so that the page behaves predictably and does not trigger hidden background work.
3. As an engineer, I want selected event rows to render immediately, so that I can inspect scope even before values are available.
4. As an admin, I want accepted schedules to replace previous damage values for that scope, so that stale values are not shown as current.
5. As a developer, I want the lifecycle owned by a backend service boundary, so that it can be tested without UI-driven orchestration.

## Implementation Decisions

- Durability schedule upload/save is a command and should validate, clear old results, and start calculation when valid.
- Inspect Damage is a query/read model only.
- Remove/disable lazy Inspect Damage backfill behavior.
- Remove/defer stale repair and rescale optimization from the normal path.
- Keep existing fatigue damage calculation logic where possible.
- Use simple schedule/task states: validating, calculating, completed, failed.
- Use simple cell states: current, error, unavailable.
- Since old data can be discarded, no compatibility migration is required for stale/backfill states.

## Testing Decisions

Backend boundary tests:

- Valid schedule starts one calculation task.
- Invalid schedule starts no task and returns a validation/prerequisite report.
- New schedule clears/replaces old damage rows for the scope.
- Calculation persists current/error event-channel results.
- Inspect Damage never starts a task or calls backfill logic.
- Inspect Damage returns selected event rows even with no persisted values.

Frontend tests:

- Inspect Damage does not call backfill on page load.
- Inspect Damage renders rows immediately and shows explicit running/failed banners.
- Schedule upload shows calculation-started/progress/completed states.

## Out of Scope

- Preserving old partially calculated damage data.
- Stale-only/repair/backfill flows.
- Schedule-scaling-only rescale optimization.
- Rewriting fatigue damage math.
- Replacing the database or full persistence architecture.
- Adding a distributed worker queue unless necessary.

## Further Notes

Backfill currently means lazy calculation/repair of missing persisted damage after Inspect Damage access. This issue removes that behavior from the normal product flow.

Target invariant:

> A validated active durability schedule has either running calculation, completed current damage results, or explicit failed calculation state. Inspect Damage is not responsible for making that invariant true.
