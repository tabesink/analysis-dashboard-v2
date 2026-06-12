# Test Plan

## Testing principle

Replace shallow-module tests with boundary tests around the new damage pipeline and Inspect Damage read model. Tests should verify observable behavior, not internal helper call order.

## Backend boundary tests

### Schedule-triggered calculation

- Valid schedule starts a damage calculation task.
- Invalid schedule returns a clear validation/prerequisite report and starts no task.
- New accepted schedule clears/replaces previous damage results for the same scope.
- Starting calculation while one is already active reuses/prevents duplicate active tasks.
- Completed calculation persists current damage values per event/channel.
- Channel unavailable/failure persists error cells without failing the whole task when partial results are allowed.
- Unexpected task exception marks task failed with an error report.

### Inspect Damage read behavior

- Inspect Damage never creates a task.
- Inspect Damage never calls calculation/backfill services.
- Inspect Damage returns selected event rows even when no damage values exist.
- Inspect Damage returns current cells when persisted rows exist.
- Inspect Damage returns error/unavailable states clearly.
- Inspect Damage can include schedule/task status metadata without mutating state.

### Reset behavior

- Reset/clear operation removes old damage rows and stale task/schedule artifacts as expected.
- After reset and reupload, schedule upload produces fresh current damage rows.

## Frontend tests

### Inspect Damage page

- Does not call a backfill endpoint on page load.
- Renders selected event rows while damage values are empty/unavailable.
- Displays a running calculation banner when task status is running.
- Displays a failed calculation banner/report when task status failed.
- Displays persisted current values after successful calculation.
- Does not show misleading “Loading damage” when the table shell can render.

### Schedule upload/calculation flow

- Valid schedule upload shows “calculation started” with task progress.
- Invalid schedule upload shows validation/prerequisite report.
- Completed calculation provides a clear path to Inspect Damage.

## Regression checks

- Existing event upload/import still works.
- Existing event selection still works.
- Existing damage table formatting still works.
- Existing 3D plot consumes persisted current/error values correctly.
- Existing auth/write-permission behavior still prevents unauthorized calculation.

## Manual QA script

1. Reset local data.
2. Reupload a known small dataset.
3. Upload a valid durability schedule.
4. Confirm damage calculation starts immediately.
5. Confirm task progresses and completes.
6. Open Inspect Damage.
7. Confirm table shows selected event rows and persisted damage values.
8. Upload an invalid schedule.
9. Confirm no calculation starts and a clear failure report is shown.
10. Open Inspect Damage again.
11. Confirm it does not start hidden backfill work.
