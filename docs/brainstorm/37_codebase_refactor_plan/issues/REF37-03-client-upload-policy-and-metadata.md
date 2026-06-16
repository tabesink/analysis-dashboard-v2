# REF37-03 — Share Client Upload Policy And Metadata Mapping

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/07_client_refactor_plan.md`
- Existing upload API helpers, upload hooks, upload side-panel/database upload UI tests

## Previous Slice Provides

Server upload classification and folder-upload lane rules are named and tested.

## What To Build

Extract shared client helpers so upload display state and upload submit handling use the same selected-file classification and metadata mapping. The user-facing labels and payload keys must remain compatible, including `Program ID` mapping to the existing job-number payload field.

Use toast notifications for lightweight validation and informational feedback, such as missing metadata, mixed CSV/RSP rejection, no uploadable files, and ignored unrelated files. Do not introduce a dialog for these lightweight checks.

## This Slice Changes

- Client selected-file classification helper.
- Client upload metadata payload helper.
- Toast notification behavior for validation and informational upload-preflight feedback.
- Tests proving side-panel display and submit handling agree.
- Existing upload components/hooks consume the helpers without moving broad component trees.

## This Slice Must Not Rework

- Server route logic.
- Upload progress rendering.
- File moving into final feature folders, except for a small helper location if needed.
- Channel-map, schedule, or database administration UI.

## Acceptance Criteria

- [x] One client helper behavior test is added and made green at a time.
- [x] Selected-file tests cover CSV-only, RSP-only, mixed CSV/RSP rejection, optional channel-map companion, and unsupported files.
- [x] Metadata tests cover required fields and current label-to-payload mapping.
- [x] `Program ID` still maps to the existing job-number payload field.
- [x] The side-panel disabled/error state and submit path consume the same helper result.
- [x] Validation and ignored-file feedback use the app's toast notification system consistently.
- [x] Toast tests or existing mocked-toast coverage prove users receive the expected lightweight feedback.
- [x] Existing user-facing labels remain stable.
- [x] `docs/tasks/REF37-03.md` records behavior changed, interfaces changed, and tests added.
- [x] GitNexus impact analysis is run before editing hook/component/helper symbols.
- [x] Focused client tests pass.

## Completion Note (2026-06-16)

Implemented via shared client upload-policy helpers in `client/src/features/database-upload/upload-policy.ts` and adoption in `client/src/app/database/page.tsx` plus `client/src/components/upload/UploadDataSection.tsx`; behavior is covered by `client/src/features/database-upload/upload-policy.test.ts` and documented in `docs/tasks/REF37-03.md`.

## Blocked By

- `REF37-02`

## Next Slice Can Assume

Client and server upload classification vocabulary is aligned, and upload metadata mapping is protected by tests.
