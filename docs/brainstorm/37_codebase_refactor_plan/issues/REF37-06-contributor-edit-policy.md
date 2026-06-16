# REF37-06 — Name Contributor Edit And Delete Policies

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/02_current_architecture_findings.md`
- Reference: `references/05_upload_lane_design.md`
- Existing channel-map, schedule, dataset ownership, delete, and admin permission tests

## Previous Slice Provides

Channel-map and schedule behavior is separated from folder upload and Inspect Damage.

## What To Build

Make ownership and edit/delete permission semantics explicit and tested. Contributors with write permission can edit channel-map and schedule data only for datasets they uploaded. They cannot edit or delete channel-map or schedule data uploaded by another user. Admins can CRUD uploaded data. Database create/connect/delete remains admin-only and is handled in the database administration issues.

## This Slice Changes

- Named policy helpers or route-level naming for contributor edit, uploaded-data admin, and scope delete semantics.
- Behavior tests for owner contributor, non-owner contributor, read-only user, and admin where the public routes expose those roles.
- Documentation updates for the permission contract.

## This Slice Must Not Rework

- Folder-upload authorization already completed in `REF37-01`.
- Database import removal.
- Database export/connect UI.
- Derived task execution.
- Broad auth system design.

## Acceptance Criteria

- [x] Contributor-owner tests prove write users can edit channel-map data for datasets they uploaded.
- [x] Contributor-owner tests prove write users can edit schedule data for datasets they uploaded.
- [x] Non-owner contributor tests prove write users cannot edit channel-map or schedule data uploaded by someone else.
- [x] Delete tests prove edit policy extraction does not loosen event/scope delete behavior.
- [x] Admin tests prove admins can CRUD uploaded data according to existing admin behavior.
- [x] Policy/helper names distinguish contributor edit from exclusive-owner-or-admin delete.
- [x] `IMPLEMENTATION_MAP.md` is updated if policy names or route contracts change.
- [x] `docs/tasks/REF37-06.md` records behavior changed, interfaces changed, and tests added.
- [x] GitNexus impact analysis is run before editing permission or route symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-05`

## Next Slice Can Assume

Dataset ownership permissions are named and tested before database administration behavior is changed.

## Completion Note (2026-06-16)

Implemented with named uploaded-data policy helpers, dashboard/upload route wiring, and focused role-behavior coverage; see `docs/tasks/REF37-06.md`.
