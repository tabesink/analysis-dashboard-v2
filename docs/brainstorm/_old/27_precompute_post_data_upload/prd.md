# Precompute Post Data Upload

## Problem Statement

Users expect uploaded data, saved channel assignments, and saved durability schedules to converge into ready-to-inspect derived data without manual repair steps hidden across multiple pages. Today, the system has the right durable pieces: channel reprocess writes current raw load histories and cross-plot data, schedule-triggered damage calculation writes latest `event_channel_damage` rows, and Inspect Damage reads persisted rows instead of computing on read. The remaining gap is orchestration.

The most confusing workflow is when schedule data exists before channel reprocess finishes. Schedule save can correctly persist repeats, weights, event matches, and multiplier, but if prerequisites are missing or stale at that moment, no damage task starts. Later, channel reprocess finishes and prerequisites become current, but damage does not automatically start. The user then opens Inspect Damage and sees missing values even though the database has enough information to calculate them.

There is also avoidable work when users only edit schedule scaling values. The notebook-defined damage model separates single-pass signal damage from schedule scaling. If base damage is already current and only repeats, weight, or global multiplier changed, the app can update scheduled damage by rescaling persisted base damage instead of rerunning py-fatigue across every event/channel.

The product needs a post-upload precompute loop that keeps derived data current automatically while staying lean: reuse the existing derived-data task model, keep latest-result damage storage, avoid a heavyweight job queue, and avoid adding broad background-task infrastructure.

## Solution

Add a scoped post-upload precompute orchestration layer for program/version derived data. The orchestrator should observe the existing milestones that can make derived data ready or stale: upload completion, channel reprocess completion, durability schedule attach/save, and Inspect Damage access. When prerequisites are satisfied, it should start or reuse the existing channel reprocess and damage calculation tasks so that cross-plot data and scheduled damage converge to current database rows without requiring the user to manually press Calculate Damage.

The preferred steady state is:

- Upload/canonicalization provides retained artifacts and raw measurement source.
- Channel assignment and channel reprocess produce current analytical raw load histories and cross-plot LTTB data.
- Active durability schedule rows remain the source of truth for event matching, repeats, weight, and multiplier.
- Damage calculation writes current `event_channel_damage` rows using base damage and scheduled damage.
- Inspect Damage reads persisted rows and, for write users only, can trigger missing-result backfill when prerequisites are ready.

After channel reprocess completes, if an active durability schedule exists and prerequisites pass, damage calculation should auto-start or reuse the active damage task. After schedule save, if existing base damage is current and the change is limited to schedule scaling inputs, the system should use a rescale-only path to update scheduled damage without rerunning signal fatigue calculation. When persisted damage is missing but prerequisites are ready, Inspect Damage should auto-start/backfill for write users and show progress through existing derived-data task UX. Read-only users should see missing state without write actions.

Automatic failures and blocked automatic precompute should use toast-only visibility in this PRD. The toast should be concise and actionable enough to explain why automatic precompute did not complete, while detailed repair/report UX remains governed by the existing schedule and derived-data flows.

## User Stories

1. As a database user, I want uploaded data to automatically progress toward current derived data, so that I do not need to know which downstream calculation button to press.
2. As a database user, I want channel assignment completion to trigger schedule damage when a schedule already exists, so that Inspect Damage is populated after channels finish processing.
3. As a database user, I want durability schedule save to continue triggering damage calculation when prerequisites are current, so that corrected schedule rows update damage results.
4. As a database user, I want Inspect Damage to read persisted damage values, so that opening the table does not rerun expensive fatigue calculation every time.
5. As a write user, I want Inspect Damage to backfill missing persisted damage when prerequisites are ready, so that an older program/version can repair itself on first inspection.
6. As a read-only user, I want Inspect Damage to avoid starting background writes, so that my view-only access does not mutate the database.
7. As a write user, I want channel reprocess completion to start damage calculation only when an active durability schedule exists, so that unscheduled program versions do not run unnecessary work.
8. As a write user, I want channel reprocess completion to skip damage calculation when schedule prerequisites still fail, so that the app does not start doomed tasks.
9. As a write user, I want blocked automatic precompute to show a toast, so that I know why values are not ready without opening another workflow.
10. As a write user, I want automatic precompute to reuse an existing active task for the program/version, so that duplicate background writes do not compete.
11. As a write user, I want only one active derived-data task per program/version to remain the rule, so that writes stay serialized and predictable.
12. As a write user, I want schedule-only edits to rescale existing current base damage, so that changing repeats, weight, or multiplier updates quickly.
13. As a durability engineer, I want scheduled damage to remain `base_damage * repeats * weight * multiplier`, so that the persisted table matches the notebook-defined model.
14. As a durability engineer, I want base damage to stay separate from scheduled damage, so that signal fatigue and schedule scaling can be reasoned about independently.
15. As a durability engineer, I want current base damage to be reused when only schedule scaling changes, so that py-fatigue is not rerun unnecessarily.
16. As a durability engineer, I want full damage calculation to rerun when channel mapping or raw load histories change, so that base damage reflects the latest signal data.
17. As a durability engineer, I want previous damage to be marked stale when channel or schedule inputs change, so that old values are not mistaken for current results.
18. As a durability engineer, I want stale base damage not to be used for rescale-only updates, so that quick rescaling never hides stale signal inputs.
19. As a database user, I want automatic damage calculation progress to use the existing derived-data modal behavior, so that long-running work is familiar.
20. As a database user, I want closing the progress modal to leave processing running, so that I can continue working while precompute completes.
21. As a database user, I want task completion to refresh Inspect Damage queries, so that newly persisted damage appears without manual page refresh.
22. As a database user, I want task completion to refresh schedule context queries, so that schedule-derived state stays current in Edit Metadata.
23. As a database user, I want automatic precompute to avoid new global task-center UI, so that this remains a scoped database workflow.
24. As a write user, I want uploaded or reprocessed program versions with complete prerequisites to become ready for Inspect Damage, so that the common path requires no manual repair.
25. As a write user, I want schedule saves with missing channel prerequisites to save the schedule anyway, so that I can finish channel assignment later.
26. As a write user, I want channel assignment after a previously saved schedule to complete the missing damage step, so that workflow order does not matter.
27. As a write user, I want automatic precompute to be idempotent, so that repeated page visits or repeated completion events do not start duplicate tasks.
28. As a write user, I want automatic precompute to avoid starting damage for unscheduled uploaded events, so that only schedule-matched events contribute.
29. As a write user, I want invalid schedule rows to keep failing damage validation, so that automation does not silently compute partial or misleading results.
30. As a write user, I want automatic failures to preserve previous stale damage rows, so that the last successful values remain inspectable.
31. As a database user, I want missing persisted damage for ready prerequisites to be treated as repairable state, so that blank Inspect Damage cells do not become a dead end.
32. As a database user, I want toast messaging for blocked automatic precompute to be concise, so that the app does not interrupt unrelated work with heavy dialogs.
33. As a developer, I want a small orchestration module to decide what derived action should happen next, so that route handlers and stores do not duplicate precompute rules.
34. As a developer, I want the orchestration module to expose a simple decision result, so that it can be tested without running expensive calculations.
35. As a developer, I want schedule rescaling isolated behind a small service interface, so that the formula and eligibility rules are easy to verify.
36. As a developer, I want client query invalidation centralized around derived-task completion, so that Inspect Damage and schedule views update consistently.
37. As a developer, I want the implementation to reuse existing task kinds, polling, progress modal, and task storage, so that this PRD does not introduce a new job framework.
38. As a developer, I want backfill from Inspect Damage to respect write permissions, so that read-only views cannot start mutation tasks.
39. As an admin, I want task ownership and polling constraints to remain unchanged, so that precompute automation does not weaken multi-user isolation.
40. As a product owner, I want this slice to improve readiness after upload without expanding into audit history, cancellation, or cross-route task centers, so that it stays shippable.

## Implementation Decisions

- The feature is a local PRD only. It should be added under the brainstorm documentation tree and should not be published to the issue tracker in this step.
- The core behavior is automatic convergence for program/version derived data after upload, channel assignment, schedule save, and Inspect Damage access.
- The implementation should reuse the existing derived-data task kinds: `channel_reprocess` and `damage_calculation`. Do not add a new public task kind for this PRD unless later implementation proves the existing pair cannot express the work.
- A small post-upload precompute orchestrator should decide whether a program/version needs no work, channel reprocess, damage calculation, rescale-only scheduled damage, or a blocked/no-op result.
- The orchestrator should be deterministic and idempotent. Given the same program/version state and active task state, it should return the same next action and avoid duplicate task starts.
- After channel reprocess completes, the system should check for an active durability schedule. If one exists and damage prerequisites pass, it should start or reuse a damage calculation task.
- If channel reprocess completes and damage prerequisites fail, the system should not create a damage task. It should surface a toast-only blocked message for the initiating user context when available.
- Schedule upload/replacement and schedule-row save remain valid damage triggers. This PRD extends behavior; it does not remove the existing trigger path.
- Saved schedule event rows remain the source of truth for event matching, repeats, weight, and multiplier.
- Damage calculation continues to use only schedule-matched events. Unscheduled uploaded events remain ignored.
- The scheduled damage formula remains base damage times repeats times weight times multiplier.
- A rescale-only path should be allowed when current persisted base damage exists for the relevant event/channel rows and the change is limited to schedule scaling inputs.
- The rescale-only path should update scheduled damage, repeats, weight, multiplier, schedule identity, status, stale reason, and updated timestamp as needed without rerunning py-fatigue.
- The rescale-only path must not use stale or error base damage as if it were current.
- Full damage calculation remains required when raw load histories, channel assignments, channel metadata, or base damage inputs changed.
- The implementation should preserve current/stale/error semantics for latest damage rows.
- Previous successful damage rows should remain visible as stale after failed automatic recalculation or blocked automatic precompute.
- Inspect Damage should continue reading persisted rows only. It should not silently compute damage synchronously on read.
- When Inspect Damage sees missing persisted damage and prerequisites are ready, write users should trigger an automatic backfill using the existing damage calculation task path.
- Read-only users should not trigger automatic backfill. They should only see the persisted state they are authorized to view.
- Client task completion should invalidate Inspect Damage queries as well as schedule context queries so persisted damage appears after background completion.
- Automatic failures and blocked automatic precompute should be surfaced with toast-only visibility in this PRD. Heavy repair reports, banners, or modal-only failure UX are out of scope unless already provided by existing flows.
- Toast copy should identify the program/version scope when useful and should point to the missing prerequisite or failed calculation at a high level.
- The implementation should not add a global background task center, new queue framework, separate task table, or cross-route task persistence.
- The main deep modules should be the post-upload precompute orchestrator, the schedule-damage rescale service, and client-side derived-task completion/invalidation wiring. These should have small interfaces and hide their internal decision complexity.

## Testing Decisions

- Tests should verify externally visible behavior: which task starts, which task is reused, which persisted rows are updated, which queries invalidate, and which user-facing notification appears. Avoid tests that assert private helper ordering.
- Add server tests for the post-upload precompute orchestrator decision matrix: no active schedule, prerequisites missing, active task reuse, ready damage calculation, and no-op when current.
- Add server tests proving channel reprocess completion starts or reuses damage calculation when an active schedule exists and prerequisites are current.
- Add server tests proving channel reprocess completion does not start damage when prerequisites fail.
- Add server tests proving blocked automatic precompute preserves existing stale damage rows.
- Add server tests for rescale-only eligibility: current base damage present, only schedule scaling changed, and no stale/error base rows are used.
- Add server tests proving rescale-only updates scheduled damage using base damage times repeats times weight times multiplier.
- Add server tests proving schedule changes that affect event matching or signal-derived inputs fall back to full damage calculation rather than rescale-only.
- Add client tests proving Inspect Damage triggers automatic backfill for write users when persisted damage is missing and prerequisites are ready.
- Add client tests proving Inspect Damage does not trigger automatic backfill for read-only users.
- Add client tests proving damage task completion invalidates Inspect Damage queries.
- Add client tests proving blocked automatic precompute emits toast-only feedback.
- Add client tests proving existing derived-data modal behavior remains unchanged for long-running damage calculation.
- Prior art for server tests includes existing derived-data hardening, channel reprocess task, damage calculation task, and damage inspect tests.
- Prior art for client tests includes the damage calculation store tests, inspect-damage calculate response tests, derived-data operation modal tests, and schedule damage response tests.

## Out of Scope

- A new background job framework or generic queue system.
- A new durable task table separate from the existing upload-task pattern.
- New public derived-data task kinds beyond existing channel reprocess and damage calculation.
- Durable history for every precompute decision or every damage calculation attempt.
- Multi-schedule comparison, damage history, or audit-grade provenance.
- Cross-route global task center or persistent app-shell background task list.
- Cooperative or hard cancellation of running derived-data tasks.
- Per-channel or per-plot stored progress counters.
- Redesigning the `.sch` parser, channel-map domain model, LTTB algorithm, or py-fatigue settings.
- Computing damage synchronously inside Inspect Damage request handling.
- Starting mutation work for read-only users.
- Heavy blocked-state banners or repair dialogs beyond existing flows; blocked automatic precompute visibility is toast-only for this PRD.
- Publishing this PRD to GitHub Issues in this step.

## Further Notes

- The key design gate is workflow-order independence: users should be able to upload data, save a schedule, assign channels, or inspect damage in a different order and still converge to current persisted damage once prerequisites are ready.
- The second key design gate is respecting the notebook model. Single-pass base damage and schedule scaling are distinct layers; rescale-only updates should take advantage of that separation without compromising stale-state safety.
- The third key design gate is leanness. This PRD should close automation gaps in UP-24/AC-25 rather than introduce a broad processing platform.
- Toast-only blocked visibility is an intentional product decision for this PRD. If users need a richer repair inbox later, that should be a separate workflow proposal.
