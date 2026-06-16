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

- [ ] One client helper behavior test is added and made green at a time.
- [ ] Selected-file tests cover CSV-only, RSP-only, mixed CSV/RSP rejection, optional channel-map companion, and unsupported files.
- [ ] Metadata tests cover required fields and current label-to-payload mapping.
- [ ] `Program ID` still maps to the existing job-number payload field.
- [ ] The side-panel disabled/error state and submit path consume the same helper result.
- [ ] Validation and ignored-file feedback use the app's toast notification system consistently.
- [ ] Toast tests or existing mocked-toast coverage prove users receive the expected lightweight feedback.
- [ ] Existing user-facing labels remain stable.
- [ ] `docs/tasks/REF37-03.md` records behavior changed, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing hook/component/helper symbols.
- [ ] Focused client tests pass.

## Blocked By

- `REF37-02`

## Next Slice Can Assume

Client and server upload classification vocabulary is aligned, and upload metadata mapping is protected by tests.
