# REF37-07 — Remove Database Import From Active Product Surface

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/01_executive_summary.md`
- Reference: `references/05_upload_lane_design.md`
- Reference: `references/10_architectural_decisions.md`
- Existing export router/service tests and database operation UI tests

## Previous Slice Provides

Uploaded-data permissions are named and tested.

## What To Build

Remove database import from the active product surface because admins can export databases and connect to created/exported database files through the supported database management workflow. The removal should be compatibility-safe: remove or disable UI affordances, prevent active route usage according to the chosen deprecation behavior, and delete import-only client flows once tests prove no active imports remain.

## This Slice Changes

- Database import UI controls are removed or disabled with a clear replacement path.
- Import-specific client API/hook paths are removed when unused or made unreachable if a compatibility window is needed.
- Import routes return the agreed removed/deprecated response or are removed from routing if no compatibility is required.
- Import-specific tests are updated to prove removal behavior rather than successful import.
- Changelog entry for removed database import capability.

## This Slice Must Not Rework

- Database export.
- Database create/connect/delete.
- Folder upload.
- Event-level upload lanes.
- Transfer/export package format unless import-only assumptions force a small cleanup.

## Acceptance Criteria

- [x] A behavior test proves database import cannot be started through the public API.
- [x] A client test proves import controls are no longer offered in the active database operation UI.
- [x] Export remains available to admins.
- [x] Database create/connect/delete paths remain available only to admins.
- [x] Import-only code is removed when no active imports reference it, or explicitly marked deprecated if a compatibility shim is required.
- [x] User-facing copy points admins toward database export plus database connect/create workflow.
- [x] `CHANGELOG.md` records database import removal.
- [x] `IMPLEMENTATION_MAP.md` is updated if any route compatibility decision changes.
- [x] `docs/tasks/REF37-07.md` records behavior changed, interfaces changed, and tests added.
- [x] GitNexus impact analysis is run before editing export/import route, service, or client symbols.
- [x] Focused tests pass.

## Blocked By

- `REF37-06`

## Next Slice Can Assume

Database import is no longer an active workflow, and database administration work can focus on export plus create/connect/delete.

## Completion Note (2026-06-16)

Completed. See `docs/tasks/REF37-07.md` for behavior/interface/test details.
