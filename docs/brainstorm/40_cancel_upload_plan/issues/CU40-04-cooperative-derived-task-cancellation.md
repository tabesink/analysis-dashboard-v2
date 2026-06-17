# CU40-04 - Cooperative Derived Task Cancellation

## Type

AFK

## Context Packet

- `docs/brainstorm/40_cancel_upload_plan/prd.md`
- `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/40_cancel_upload_plan/HANDOFF.md`
- `docs/tasks/CU40-01.md`
- `docs/tasks/CU40-02.md`
- `docs/tasks/CU40-03.md`
- Existing channel reprocess and damage calculation route/service/client tests

## Previous Slice Provides

Shared cancel endpoints exist. Folder upload workers stop cooperatively. Cancelled task status and UI semantics are established.

## What To Build

Apply the same cooperative cancellation contract to derived upload-task operations: `channel_reprocess` and `damage_calculation`.

## This Slice Changes

- Channel reprocess worker heartbeat updates and cancellation checks.
- Damage calculation worker heartbeat updates and cancellation checks.
- Derived progress payloads expose `cancelling` and `cancelled` status consistently.
- Derived task modals and banners use server cancel requests instead of hiding or dismissing active work.
- Derived task stores/polling treat `cancelling` as active and `cancelled` as terminal.

## This Slice Must Not Rework

- Folder upload cancellation already completed in CU40-03.
- Derived authorization rules from Phase 39.
- Channel map or durability schedule domain behavior.
- Full job restart/resume behavior.
- External queue infrastructure.

## Acceptance Criteria

- [ ] Channel reprocess cancel request is observed before starting the next retained artifact/event.
- [ ] Damage calculation cancel request is observed before starting the next scheduled event/calculation unit.
- [ ] Derived tasks transition from `cancelling` to `cancelled` when stopped by accepted cancel intent.
- [ ] Derived task status polling treats `cancelling` as active and `cancelled` as terminal.
- [ ] Derived modal UI shows a clear cancelling state and terminal cancelled summary.
- [ ] Existing admin-or-scope-owner authorization applies consistently to cancel, polling, start, and reuse.
- [ ] A cancelling derived task remains a blocker until terminal, then no longer blocks one-active-task-per-scope reuse.
- [ ] Focused server tests cover authorized cancel, unauthorized denial, cooperative stop, and blocker release.
- [ ] Focused client tests cover derived cancel action, cancelling state, and cancelled terminal summary.
- [ ] GitNexus impact analysis is run before editing derived task service, route, store, hook, or modal symbols.
- [ ] `docs/tasks/CU40-04.md`, `HANDOFF.md`, `IMPLEMENTATION_MAP.md`, and `CHANGELOG.md` are updated.

## Blocked By

- `CU40-03`

## Next Slice Can Assume

All operation kinds stored in `upload_tasks` support a consistent cancel request, cooperative stop, and terminal cancelled status.

