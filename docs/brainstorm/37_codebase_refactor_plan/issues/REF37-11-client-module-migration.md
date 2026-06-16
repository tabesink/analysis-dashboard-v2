# REF37-11 — Migrate Client Modules By Lane

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/03_target_folder_structure.md`
- Reference: `references/07_client_refactor_plan.md`
- Existing database route, edit-metadata, upload hook, and operation modal tests

## Previous Slice Provides

Server route contracts are stable and lane behavior is covered.

## What To Build

Move frontend code into lane-oriented modules in small steps. The `/database` route owns folder upload and database administration. Edit Metadata owns channel-map, schedule, and derived-data operations. Keep compatibility wrappers until active imports are gone, then remove deprecated upload wrappers.

Preserve the app's notification split during moves: toast notifications remain the canonical lightweight feedback mechanism, and operation dialogs remain the status surface for uploads, derived-data operations, and long-running database operations.

## This Slice Changes

- Folder upload client code moves under the database upload feature area.
- Database export/connect UI code moves under the database administration/portability area.
- Channel-map, schedule, and derived-data UI code moves under edit-metadata lane modules.
- Legacy wrappers remain temporarily, then are removed after imports are gone and tests pass.
- Toast usage and operation dialog ownership are preserved while files move.

## This Slice Must Not Rework

- Server route behavior.
- Upload, channel-map, schedule, damage, or database task semantics.
- Visual redesign beyond naming/organization needed to reflect lanes.
- New upload validation rules.

## Acceptance Criteria

- [ ] Folder upload components/hooks/API helpers move with compatibility exports where needed.
- [ ] Database export/connect components/hooks/API helpers are separated from folder upload.
- [ ] Channel-map, schedule, and derived-data components/hooks/API helpers are separated from folder upload.
- [ ] Existing route/page behavior tests remain green after each move.
- [ ] Deprecated upload wrappers are not extended with new behavior.
- [ ] Deprecated wrappers are removed only after search confirms no active imports remain.
- [ ] Client imports use lane-oriented module names rather than generic upload names where practical.
- [ ] Existing toast notifications still fire for lightweight validation, permission, success, and error feedback after module moves.
- [ ] Existing operation dialogs still show detailed status content for upload and long-running operations after module moves.
- [ ] `docs/tasks/REF37-11.md` records files/modules moved, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing hook/component symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-10`

## Next Slice Can Assume

Frontend ownership matches the lane model and legacy upload wrappers no longer obscure active behavior.
