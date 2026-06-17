# REF37-02 — Extract Server Upload Policy Contract

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/04_clean_architecture_breakdown.md`
- Reference: `references/05_upload_lane_design.md`
- Reference: `references/06_server_refactor_plan.md`
- Existing folder-upload route and route/policy tests

## Previous Slice Provides

Folder upload is protected by write/admin authorization.

## What To Build

Extract the server-side folder-upload lane rules into a pure policy contract and make the folder-upload route consume it. The contract should classify selected filenames, enforce CSV/RSP exclusivity, recognize optional channel-map companion files, and produce stable task/phase names without importing web, database, pandas, or filesystem dependencies.

## This Slice Changes

- Pure server upload policy module.
- Tests for CSV-only, RSP-only, mixed CSV/RSP rejection, optional channel-map companion detection, and unsupported file behavior according to the current route contract.
- Route usage of the policy where it removes duplicated or hidden lane rules.

## This Slice Must Not Rework

- Ingestion service internals.
- Upload file byte handling or staging.
- Frontend validation.
- Router file splitting.
- Database operations.

## Acceptance Criteria

- [ ] One behavior test is added and made green at a time.
- [x] Pure policy tests cover CSV-only batches.
- [x] Pure policy tests cover RSP-only batches.
- [x] Pure policy tests reject mixed CSV/RSP batches.
- [x] Pure policy tests cover optional `channel_map.yaml` and `channel_map.yml` companion files.
- [x] Unsupported file behavior matches the current public route contract and is documented in the test names.
- [x] The folder-upload route consumes the policy without changing endpoint URL or successful response shape.
- [x] `IMPLEMENTATION_MAP.md` is updated if task kind or phase names are adjusted.
- [x] `docs/tasks/REF37-02.md` records interfaces changed and tests added.
- [ ] GitNexus impact analysis is run before editing route or helper symbols.
- [x] Focused tests pass.

## Blocked By

- `REF37-01`

## Next Slice Can Assume

Server folder-upload rules are named, tested, and available as a pure contract for frontend parity work.

## Completion Note

Completed on 2026-06-16.

- Pure policy contract added at `server/upload/policies.py`.
- Folder-upload route now consumes pure policy classification/validation in `_parse_upload_payload`.
- Coverage added in `tests/server/unit/routers/test_upload_policies.py`.
- Task record: `docs/tasks/REF37-02.md`.
