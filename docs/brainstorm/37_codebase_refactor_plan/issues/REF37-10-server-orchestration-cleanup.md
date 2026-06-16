# REF37-10 — Thin Server Orchestration Behind Existing Routes

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/03_target_folder_structure.md`
- Reference: `references/04_clean_architecture_breakdown.md`
- Reference: `references/06_server_refactor_plan.md`
- Existing route tests for upload, dashboard, damage, and export/database administration

## Previous Slice Provides

Lane rules, permissions, database import removal, and task constants are tested.

## What To Build

Clean up server route orchestration where tests show route code still owns too much workflow detail. Prefer small orchestration functions around existing concrete services. Split router files only if behavior coverage is already green and the move reduces route size without changing paths.

## This Slice Changes

- Small orchestration helpers where they simplify public route behavior.
- Optional router file split behind stable route paths.
- Compatibility imports if needed to avoid broad call-site churn.

## This Slice Must Not Rework

- Public endpoint URLs.
- Existing response shapes.
- Concrete service boundaries unless a test proves the boundary blocks safe change.
- Client module structure.
- Task runner design.

## Acceptance Criteria

- [ ] Existing route behavior tests are green before moving code.
- [ ] Any new orchestration helper has public behavior coverage through route or service-level tests.
- [ ] Route handlers authenticate/authorize, parse request input, call orchestration/service code, and map responses/errors.
- [ ] Lane policies are not duplicated in route handlers after extraction.
- [ ] Router splitting, if performed, preserves all route paths and imports.
- [ ] No generic `ports.py` or repository layer is added without a documented testability need.
- [ ] `IMPLEMENTATION_MAP.md` is updated if server ownership boundaries change.
- [ ] `docs/tasks/REF37-10.md` records behavior changed, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing route or orchestration symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-09`

## Next Slice Can Assume

Server lanes are thin enough for client module migration to proceed without chasing unstable route contracts.

## Completion Note (2026-06-16)

- Added `server/services/dashboard_orchestration.py` and moved channel-map/schedule orchestration details out of `server/routers/dashboard.py`.
- Dashboard route handlers now keep auth/input/error mapping while delegating contributor-edit permission checks and schedule/channel-map orchestration to helpers.
- Public route paths and response shapes are unchanged; existing dashboard/upload/export route tests remain the behavior coverage anchor for this slice.
- Detailed implementation record: `docs/tasks/REF37-10.md`.
