## Problem Statement

Engineers currently have no consistent visibility into long-running derived-data work after channel assignment or durability schedule changes. Initial CSV/RSP uploads use an async upload task and a progress modal, but Assign Channels save/upload runs raw load-history extraction and cross-plot LTTB generation synchronously behind a coarse toast. Large channel-map reprocessing can exceed client timeouts while the server keeps writing to DuckDB, leaving users uncertain whether data is still processing, failed, or completed.

The pipeline also has an unclear boundary between channel assignment, cross-plot data generation, and load-history damage. LTTB data is generated and stored when channels are assigned, but damage is currently computed on demand. Users need damage to be calculated when a durability schedule is assigned or corrected, because repeats, weights, and the global multiplier are schedule inputs. If schedule rows are wrong, the app should not silently compute partial damage; it should return a repairable report that helps the user fix the schedule table.

The current behavior creates risk in three places: invisible long-running database writes, stale or missing derived data after channel/schedule changes, and repeated synchronous damage calculations that are not tied to the active schedule. The fix must stay lean: reuse existing upload task mechanics, avoid a heavyweight job system, and add only the durable state needed for current/stale damage values.

## Solution

Standardize channel reprocessing and schedule-triggered damage calculation as lightweight derived-data tasks built on the existing upload-task pattern.

Assign Channels save and channel-map YAML upload should start a `channel_reprocess` task. Raw load histories are canonical full-resolution analytical data written by upload/canonicalization, so the task reads existing `measurements_raw`, regenerates cross-plot LTTB data, updates channel-map lineage, and reports progress through the same modal pattern used by upload. Channel assignment does not calculate damage. If a schedule already exists, previous damage results are marked stale and the user is prompted to recalculate after channel reprocess finishes.

Durability schedule upload/replacement and schedule-row save should persist the active schedule rows, then start a `damage_calculation` task. That task validates the saved event rows, verifies current raw load histories exist, calculates base load-history damage per scheduled event/channel, applies repeats, weight, and multiplier, then persists the latest damage result rows. If prerequisites are missing or stale, the schedule save/upload still succeeds but returns a structured prerequisite report instead of creating a task. If schedule validation fails inside the task, the whole damage calculation fails with a compact report that points the user back to the schedule editor.

The UI should show progress with domain-specific live messages:

```text
Validating artifact 3/10: event_042.csv
Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)
Calculating load history damage: event_042 - BJ X Force
```

Users may close the progress modal, but processing continues in the background. Active work remains visible from a scoped inline banner in Edit Metadata with a Reopen progress action. Inspect Damage should read persisted damage results, show stale warnings and badges when needed, and show a Calculate Damage empty state when no successful run exists for the active schedule.

## User Stories

1. As a database user, I want channel assignment to show long-running progress, so that I know cross-plot data is being generated from canonical raw load histories.
2. As a database user, I want Assign Channels save to return quickly and process in the background, so that the browser does not appear frozen during large reprocessing work.
3. As a database user, I want channel-map YAML upload from the edit metadata dialog to use the same progress model as manual Assign Channels save, so that both channel assignment paths behave consistently.
4. As a database user, I want progress to identify the current artifact, so that I know which file is being processed.
5. As a database user, I want raw load histories to remain stable during channel assignment, so that the full-resolution source data is not rewritten by plot-mapping edits.
6. As a database user, I want progress to identify cross-plot data generation, so that I know LTTB plot data is being generated for each plot.
7. As a database user, I want progress to identify damage calculation by event and channel, so that I know load-history damage is being calculated.
8. As a database user, I want closing the progress modal to clearly say processing continues, so that I do not mistake closing the modal for cancellation.
9. As a database user, I want an inline banner for active background work in the scoped Edit Metadata dialog, so that I can reopen progress after closing the modal.
10. As a database user, I want only one active derived-data task per program/version, so that two competing writes cannot corrupt or overwrite each other unpredictably.
11. As a database user, I want starting a new operation during active work to reopen the existing task, so that I do not accidentally queue duplicate work.
12. As a write user, I want upload/canonicalization to generate raw load histories, so that downstream damage calculations have stable current source data before channel assignment.
13. As a write user, I want channel assignment to generate cross-plot data, so that plots are available after channels are assigned.
14. As a write user, I want channel assignment not to calculate damage, so that schedule-driven damage remains tied to the active durability schedule.
15. As a write user, I want changing channels after damage has been calculated to mark damage stale, so that old values are not mistaken for current results.
16. As a write user, I want durability schedule upload to persist generated editable event rows, so that damage calculation uses the same schedule rows the UI shows.
17. As a write user, I want durability schedule save to trigger damage calculation automatically, so that corrected schedule values are reflected without a separate manual step.
18. As a write user, I want schedule upload/replacement to trigger damage calculation when prerequisites are current, so that newly attached schedules immediately produce damage results.
19. As a write user, I want damage calculation to fail fast if raw load histories are missing or stale, so that I know to assign channels or finish channel reprocess first.
20. As a write user, I want a prerequisite report when damage cannot start, so that schedule save/upload can succeed while still explaining why damage was not calculated.
21. As a write user, I want damage calculation to use saved schedule event rows, so that user-corrected event mappings, repeats, weights, and multiplier are authoritative.
22. As a write user, I want damage to be calculated only for events matched by schedule rows, so that unscheduled uploaded events do not create misleading damage results.
23. As a write user, I want unmatched schedule rows to fail the damage task, so that schedule mistakes are repaired instead of silently ignored.
24. As a write user, I want blank repeats or weights to fail the damage task, so that scheduled damage is never calculated from implied values.
25. As a write user, I want blank pattern or schedule sequence to remain allowed, so that UI/reporting metadata does not block valid damage math.
26. As an engineer, I want persisted damage rows to include base damage, so that raw load-history damage remains inspectable before schedule scaling.
27. As an engineer, I want persisted damage rows to include scheduled damage, so that the app stores the value used for schedule-adjusted comparison.
28. As an engineer, I want scheduled damage to apply repeats, weight, and global multiplier, so that persisted damage reflects the durability schedule.
29. As an engineer, I want damage rows to include schedule identity, so that I know which schedule produced current or stale values.
30. As an engineer, I want damage rows to include channel display snapshots, so that Inspect Damage can display results without a separate channel registry.
31. As an engineer, I want the app to keep only the latest damage result per event/channel, so that the feature stays lightweight and does not become an audit-history system.
32. As an engineer, I want previous successful damage values to remain visible as stale after recalculation is required, so that I can compare while knowing the values are no longer current.
33. As an engineer, I want failed recalculation to preserve previous stale results, so that a schedule repair mistake does not erase the last known successful values.
34. As an engineer, I want Inspect Damage to show a page-level stale warning and cell or column stale badges, so that stale damage cannot be overlooked.
35. As an engineer, I want Inspect Damage to show an empty state with a Calculate Damage action when no persisted run exists, so that it does not hide missing work behind compute-on-read behavior.
36. As a write user, I want a compact failure report when damage validation fails, so that I know which event and field need correction.
37. As a write user, I want the failure report to reopen the Durability Schedule editor, so that I can correct schedule values immediately.
38. As a write user, I want affected schedule fields highlighted inline, so that I can find and repair issues quickly.
39. As a write user, I want saving corrected schedule rows to retry damage calculation automatically, so that the repair loop is short.
40. As a read-only user, I want to see active, stale, missing, or failed damage state without write actions, so that I can understand database state without changing it.
41. As an admin, I want task polling to remain creator-scoped, so that users cannot inspect another user's processing tasks.
42. As a developer, I want derived-data tasks to reuse existing upload task storage, so that the app stays lean and avoids a new job framework.
43. As a developer, I want failure reports to remain transient in task result JSON, so that the durable schema only stores data needed by the app after completion.
44. As a developer, I want progress to store coarse event counts and one live message, so that progress does not require per-plot or per-channel bookkeeping.
45. As a developer, I want small, testable modules for task orchestration, schedule damage validation, damage persistence, and progress mapping, so that behavior is isolated without adding broad technical entropy.

## Implementation Decisions

- The first implementation extends the existing upload task storage instead of creating a separate job system. A `task_kind` discriminator identifies derived-data tasks.
- The public derived task kinds are `channel_reprocess` and `damage_calculation`.
- Channel reprocess starts from Assign Channels save and channel-map YAML upload.
- Channel reprocess preserves `measurements_raw`, regenerates cross-plot LTTB from those canonical raw rows, and updates channel-map lineage. It does not calculate damage.
- Channel reprocess uses per-artifact transaction semantics. A failed artifact should not roll back already completed sibling artifacts.
- If channel changes make previous damage stale, stale results remain visible and are not overwritten until a later successful damage task.
- Durability schedule upload/replacement and schedule-row save are the damage triggers.
- Schedule upload persists generated editable event rows immediately before attempting damage calculation.
- Saved schedule event rows are the source of truth for event matching, repeats, weight, and multiplier.
- Damage calculation only applies to events represented by saved schedule rows. Uploaded events outside the schedule are ignored.
- Damage calculation requires current raw load histories and cross-plot data. Missing or stale prerequisites return a structured prerequisite report without creating a task row.
- If a derived-data task is already active for the same program/version, starting another operation returns the existing active task id.
- Only one active derived-data task is allowed per program/version.
- The progress modal close action only hides the modal. Processing continues in the background.
- Active background work appears in the scoped Edit Metadata dialog as an inline banner with a Reopen progress action.
- Task progress remains coarse: completed events, total events, phase, sub-phase, current event, and one live progress message.
- Progress percentages use coarse phase bands and completed event counts. Plot and channel details belong in the live message, not in stored step counters.
- Polling responses expose only the lean task fields: task id, task kind, status, phase, sub-phase, progress message, completed events, total events, current event, error, and result.
- Channel reprocess start responses return task id, task kind, and whether an existing active task was reused.
- Schedule save/upload responses keep their normal schedule payload and add either a damage task id or a prerequisite report.
- Damage validation failure report payloads use a compact shape: summary plus a flat issue list containing optional event id, optional event name, field, code, and message.
- Failure report fields use UI-editable field names: repeats, weight, rspEventName, schedulePattern, event_id, and channel.
- Failure report event names prefer saved RSP event name, then RSP file name, then event id.
- Opening the schedule editor from a failure report shows the summary above the schedule table and highlights affected fields.
- Saving schedule edits starts a new damage task even if previous issues may remain. Server validation returns a fresh report if the repair is incomplete.
- The durable damage table is named `event_channel_damage`.
- `event_channel_damage` stores the latest result per event and channel. It does not keep multi-schedule or full recalculation history in this PRD.
- Damage row status values are current, stale, and error.
- Stale rows store a single machine-readable stale reason.
- Channel identity uses channel key. Channel name and unit are stored as display snapshots.
- Schedule identity on damage rows uses schedule id and schedule SHA-256.
- Persisted damage rows store event id, channel key, channel name, channel unit, base damage, scheduled damage, repeats, weight, multiplier, schedule id, schedule SHA-256, status, stale reason, optional error, and updated timestamp.
- Scheduled damage is calculated as base damage times repeats times weight times multiplier.
- Blank repeats and blank weight fail damage validation.
- Blank pattern and blank schedule sequence do not fail damage validation.
- Failure reports remain transient in task result JSON until task expiry. Durable failed-run history is out of scope.
- Inspect Damage reads persisted damage results instead of silently recomputing on read.
- Inspect Damage shows stale persisted values with a page-level warning and stale cell or column badges.
- Inspect Damage shows an empty state with a Calculate Damage action when no successful damage result exists for the active schedule and prerequisites are current.
- The main deep modules should be a lightweight derived-task orchestration service, a schedule damage validation/calculation service, a latest-result damage repository, and a shared processing modal mapper. These modules should expose small interfaces and hide the heavier internals.

## Testing Decisions

- Tests should focus on externally visible behavior: task lifecycle, status payloads, progress messages, schedule validation outcomes, persisted damage values, stale state, and UI repair flows. Avoid testing internal implementation details such as private helper call order.
- Add server coverage proving channel reprocess starts a task, updates progress phases, writes raw load histories, writes cross-plot LTTB data, and preserves existing LTTB row output compared with the current synchronous path.
- Add server coverage proving channel reprocess keeps per-artifact rollback behavior and reports failed artifacts without erasing completed sibling artifacts.
- Add server coverage proving a second derived-data operation for the same program/version returns the existing active task id.
- Add server coverage proving schedule upload persists generated event rows before damage calculation begins.
- Add server coverage proving schedule upload and schedule save return either a damage task id or a prerequisite report.
- Add server coverage proving prerequisite failures do not create task rows.
- Add server coverage proving damage calculation uses saved event rows as source of truth.
- Add server coverage proving unscheduled uploaded events are ignored.
- Add server coverage proving unmatched saved schedule rows fail the whole damage task with a compact report.
- Add server coverage proving blank repeats and blank weight fail validation.
- Add server coverage proving blank pattern and schedule sequence do not fail validation.
- Add server coverage proving scheduled damage equals base damage times repeats times weight times multiplier.
- Add server coverage proving successful damage writes latest rows to `event_channel_damage`.
- Add server coverage proving successful recalculation overwrites stale latest rows rather than creating history rows.
- Add server coverage proving channel changes or schedule changes mark previous successful damage as stale.
- Add server coverage proving failed recalculation keeps previous stale values visible.
- Add router coverage for task polling ownership and lean polling response shape.
- Add client coverage proving Assign Channels save and YAML upload open the processing modal and poll the channel reprocess task.
- Add client coverage proving durability schedule upload/save opens the processing modal when damage starts.
- Add client coverage proving prerequisite reports are shown without task polling.
- Add client coverage proving the scope-specific inline banner can reopen active progress after the modal is closed.
- Add client coverage proving the modal uses the locked live message vocabulary.
- Add client coverage proving damage failure reports reopen the schedule editor and highlight affected fields.
- Add client coverage proving saving corrected schedule rows automatically retries damage calculation.
- Add client coverage proving Inspect Damage shows stale banners and stale badges.
- Add client coverage proving Inspect Damage shows an empty state with Calculate Damage when no persisted successful result exists.
- Reuse existing upload task polling tests as prior art for async task behavior.
- Reuse existing ingestion and channel-map tests as prior art for LTTB and retained-artifact reprocessing behavior.
- Reuse existing durability schedule tests as prior art for schedule row hydration, save payload conversion, and schedule edit behavior.
- Reuse existing damage service tests as prior art for base damage calculation.

## Out of Scope

- A new background job framework or queue system.
- A separate generic processing task table in the first implementation.
- Durable history for every damage calculation attempt.
- Durable storage of validation failure reports beyond task expiry.
- Multi-schedule damage history or comparison UI.
- Cooperative cancellation or hard cancellation of running tasks.
- Per-plot or per-channel progress counters stored in the database.
- Redesigning the LTTB algorithm.
- Optimizing DuckDB insert batching beyond what is needed for correctness and progress visibility.
- Changing the channel-map domain model.
- Changing the `.sch` schedule file format or parser grammar.
- Full audit-grade provenance for damage settings, parser manifests, or source artifact packages.
- Project-package export/import of source artifacts or damage history.
- A global background task center in the app shell.
- Removing the existing upload modal pattern.

## Further Notes

- This PRD intentionally favors the smallest useful extension of existing upload task mechanics. The app should gain predictable long-running progress without introducing a large job subsystem.
- The important product boundary is that upload/canonicalization owns raw load histories, channel assignment owns cross-plot data, and schedule assignment owns load-history damage.
- The damage table is a latest-result cache with enough lineage to explain whether values are current or stale. It is not an audit ledger.
- The repair loop should be strict but user-friendly: invalid schedules fail damage calculation, but the report should take the user directly to the fields they need to correct.
- If future work needs audit history, damage profiles, or project-package reproducibility, it should build on the database-improvement roadmap rather than expanding this lean PRD.
