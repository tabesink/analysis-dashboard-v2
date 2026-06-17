# CU40-06 - Auth Database Responsiveness And Final Regression

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- Completion notes from `CU40-01` through `CU40-05`
- Existing auth, upload, dashboard, damage, operation admission, and UI modal tests

## Previous Slice Provides

All upload-task operation kinds support cancellation and reconnect recovery. Stale active task rows are reconciled by heartbeat. The client can rediscover active and actionable terminal tasks after reload.

## What To Build

Close the remaining user-facing failure mode: active long-running upload-task work must not make login or database routes feel inaccessible. Add final regression coverage proving the shared operation contract behaves coherently across cancellation, reconnect, cleanup, and admission.

## This Slice Changes

- Auth login responsiveness while dashboard DB write activity is ongoing.
- Auth audit logging behavior if it currently blocks login behind the active dashboard database lock.
- Database route/client redirect behavior after browser close and task recovery.
- Final focused lifecycle regression suite across Phase 40 flows.
- Final handoff, implementation map, task notes, and changelog updates.

## This Slice Must Not Rework

- Upload-task cancellation semantics from previous slices.
- Worker processing internals unless a failing responsiveness test requires a narrow fix.
- External queue infrastructure.
- Database export/admin task lifecycle.
- UI redesign beyond necessary recovery/error copy.

## Acceptance Criteria

- [ ] Login/auth bootstrap remains usable while a folder upload task is active.
- [ ] Login does not fail merely because dashboard DB audit logging is temporarily unavailable or contended.
- [ ] Database route access after browser close uses auth and server recovery state, not stale client upload flags.
- [ ] Operation admission blocks on truly active `queued`, `running`, or `cancelling` upload tasks.
- [ ] Operation admission does not block indefinitely on stale heartbeat rows.
- [ ] Regression coverage verifies folder upload cancel before commit.
- [ ] Regression coverage verifies folder upload cancel after partial commit, cleanup, and safe retry.
- [ ] Regression coverage verifies channel reprocess and damage calculation cancellation.
- [ ] Regression coverage verifies active task discovery after reload/browser close.
- [ ] Regression coverage verifies unauthorized users cannot discover or cancel unrelated tasks.
- [ ] Observability payloads/logs include task kind, owner/scope, phase, status, terminal state, cancel timing, heartbeat freshness, block reason, and cleanup guidance where applicable.
- [ ] `HANDOFF.md` is updated with final completion notes and residual follow-up work.
- [ ] `IMPLEMENTATION_MAP.md` is updated if any lifecycle contract changed during implementation.
- [ ] `docs/tasks/CU40-06.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [ ] `CHANGELOG.md` documents user-facing cancellation and recovery behavior.
- [ ] GitNexus impact analysis is run before editing auth, routing, admission, or status symbols.
- [ ] Focused tests and agreed broader regression suite pass.

## Blocked By

- `CU40-05`

## Next Slice Can Assume

Phase 40 upload-task cancellation and recovery is complete. Remaining work should be explicit follow-on performance, diagnostics, or queue/worker scaling work rather than core cancellation safety.

## Completion Note

- Implemented bounded best-effort login audit persistence to prevent dashboard DB contention from blocking/failing `POST /api/v1/auth/login`.
- Added auth router regressions for unavailable/contended dashboard audit writes and login responsiveness.
- Added database admission regressions proving `cancelling` tasks still block switch/delete while stale `cancelling` heartbeat rows are reconciled and no longer block indefinitely.
- Updated Phase 40 implementation map, handoff, task notes (`docs/tasks/CU40-06.md`), and changelog.

