# REF37-01 — Require Write Permission For Folder Upload

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/02_current_architecture_findings.md`
- Reference: `references/06_server_refactor_plan.md`
- Existing server upload route tests and auth fixtures

## Previous Slice Provides

None. This is the first tracer bullet.

## What To Build

Make folder upload require write/admin permission. A read-only authenticated user must receive a forbidden response before upload validation, file parsing, task creation, or ingestion work begins.

Preserve the existing folder-upload endpoint URL and success response for authorized write/admin users.

## This Slice Changes

- Route-level authorization for folder upload start.
- Focused regression coverage for read-only users.
- Changelog entry for the permission hardening.

## This Slice Must Not Rework

- File classification rules.
- Upload task execution.
- Client component structure.
- Channel-map, schedule, damage, database export, or database import behavior.

## Acceptance Criteria

- [x] A route-level test proves a read-only authenticated user cannot start folder upload.
- [x] The test fails before the implementation change.
- [x] Folder upload still starts for write/admin users through the existing public route contract.
- [x] Validation or task creation does not run for forbidden users.
- [x] `CHANGELOG.md` documents the user-facing permission hardening.
- [x] `docs/tasks/REF37-01.md` records behavior changed, tests added, and follow-on assumptions.
- [x] GitNexus impact analysis is run before editing the route symbol.
- [x] Focused tests pass.

## Completion Note

Completed on 2026-06-16.

- Route guard for `POST /api/v1/upload/folder/start` now uses write/admin authorization.
- Added focused regression tests for read-only `403` pre-parse behavior and write-user success contract.

## Blocked By

None - can start immediately.

## Next Slice Can Assume

Folder upload is established as a write/admin-only path and can be refactored behind that invariant.
