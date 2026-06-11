# Handoff — Post-Upload Precompute (PPU-27)

Use this document when picking up any issue in `issues/PPU-27-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Make program/version derived data converge automatically after upload, channel assignment, schedule save, and Inspect Damage access without adding a new job framework.

The core workflow gap is order independence: if a durability schedule exists before channel reprocess finishes, channel completion should notice that damage is now ready and start or reuse the existing `damage_calculation` task.

Keep the implementation lean: reuse `channel_reprocess`, `damage_calculation`, existing derived-data task polling, existing progress modal behavior, and latest-result `event_channel_damage` storage.

## What Already Exists

| Area | Status | Notes |
|------|--------|-------|
| `channel_reprocess` derived task | Existing | Writes current raw load histories, cross-plot LTTB data, and channel-map lineage. |
| `damage_calculation` derived task | Existing | Writes latest schedule-driven `event_channel_damage` rows. |
| One active task per program/version | Existing rule | Starting work should reuse active derived-data tasks instead of competing writes. |
| Schedule upload/save damage trigger | Existing | Damage can start when schedule save sees current prerequisites. |
| Inspect Damage persisted reads | Existing | Inspect Damage reads persisted rows instead of calculating synchronously on read. |
| Derived-data modal/store/polling | Existing | Long-running work already has familiar progress and close-and-continue behavior. |
| Post-upload orchestration | Missing | No shared decision layer connects upload/channel/schedule/inspection milestones. |
| Schedule-only rescale path | Missing | Scaling edits still need a fast path when current base damage can be reused. |

## Issue Order

1. `PPU-27-01` — Auto-start damage after channel reprocess completion.
2. `PPU-27-02` — Route schedule saves through precompute decisions.
3. `PPU-27-03` — Rescale scheduled damage for schedule-only edits.
4. `PPU-27-04` — Backfill missing damage from Inspect Damage for write users.
5. `PPU-27-05` — Refresh derived views and surface automatic precompute feedback.
6. `PPU-27-06` — Harden precompute idempotency and document rollout.

`PPU-27-01` is the foundation because it introduces the orchestrator through the most confusing user workflow. `PPU-27-02` reuses that decision path from schedule save. `PPU-27-03` depends on schedule-save decisions so rescale-only can be selected safely. `PPU-27-04` can proceed after the orchestrator exists. `PPU-27-05` should land after the automatic start paths are present. `PPU-27-06` closes the loop after all behavior slices land.

## Key Behavior

- Public derived task kinds remain `channel_reprocess` and `damage_calculation`.
- Do not add a generic queue, new task table, global task center, or new public derived-data task kind.
- A small post-upload precompute orchestrator decides no-op, channel reprocess, damage calculation, rescale-only scheduled damage, active-task reuse, or blocked/no-op.
- The orchestrator should be deterministic and idempotent for the same program/version state and active task state.
- Channel reprocess completion starts or reuses damage calculation only when an active durability schedule exists and prerequisites are current.
- Schedule save persists valid schedule data even when channel prerequisites are missing; later channel completion should finish the damage step.
- Inspect Damage keeps reading persisted rows only. It may trigger missing-result backfill for write users, but never computes damage synchronously on read.
- Read-only users never start mutation work from Inspect Damage.
- Automatic blocked/failure visibility is toast-only in this PRD.
- Previous successful damage remains inspectable as stale after failed or blocked automatic precompute.

## Damage Model Rules

- Saved schedule rows are the source of truth for event matching, repeats, weight, and multiplier.
- Damage calculation uses only schedule-matched events.
- Unscheduled uploaded events are ignored.
- Scheduled damage remains:

```text
scheduled_damage = base_damage * repeats * weight * multiplier
```

- Base damage and scheduled damage remain separate concepts.
- Rescale-only is allowed only when current persisted base damage exists and the edit is limited to schedule scaling inputs.
- Stale or error base damage must never be used for rescale-only updates.
- Full damage calculation is still required when raw load histories, channel assignments, channel metadata, event matching, or base-damage inputs changed.

## Verification Focus

- Workflow-order independence: schedule before channel assignment, channel assignment before schedule, Inspect Damage repair.
- Idempotency: repeated task completions or repeated page visits do not start duplicate tasks.
- Authorization: write users can trigger repair; read-only users cannot mutate.
- Query freshness: damage task completion refreshes Inspect Damage and Edit Metadata schedule context.
- Stale-state safety: old successful values are not mistaken for current results.
- Lean scope: no new queue framework, global task center, task table, or public task kind.

## Documentation Updates When Shipping

- Add a user-facing `[Unreleased]` entry in `CHANGELOG.md`.
- Update `docs/master-build-plan.md` with `PPU-27-*` rows and completion dates.
- Create `docs/tasks/PPU-27-*.md` notes for non-trivial implementation slices.
- Append `docs/decisions/log.md` only if the orchestrator or rescale-only service establishes a durable architectural convention.
