# DSC-19-01: Schedule attach/read API hardening

**Type:** AFK  
**Effort:** Small  
**Labels:** `ready-for-agent`

## Parent

[prd.md](../prd.md) · [HANDOFF.md](../HANDOFF.md)

## What to build

Harden the **existing** durability schedule attach and read endpoints without adding new routes. Close test gaps on `GET` and `POST` so coding agents can rely on stable API behavior before save work lands.

End-to-end behavior for this slice is **verifiable via automated tests** (no new UI):

- `GET /api/v1/dashboard/program-version/schedule` returns 200 with active schedule metadata when attached; 404 when none.
- `POST` rejects empty files and non-`.sch` extensions with 400.
- `POST` allows admin attach on program/version they do not own; denies non-owner write user with 403.
- Re-attaching **identical** `.sch` bytes yields same `schedule_id` and `replaced_previous=false`.
- `DurabilityScheduleParser` handles `*summary` stop, missing `*id`/`*multiplier`, and zero-repeat entries.

Preserve DEC-078: immutable artifact bytes, active pointer, existing response models.

## Acceptance criteria

- [ ] GET router test: 200 with active schedule; 404 without active schedule
- [ ] POST router tests: 400 for empty file and non-`.sch` extension
- [ ] POST router test: admin can attach to another user's program/version
- [ ] POST router/service test: identical checksum re-attach does not trigger replacement audit semantics
- [ ] Parser service tests: `*summary` boundary, missing metadata defaults, zero repeats entry
- [ ] All existing `test_durability_schedule*.py` tests remain green
- [ ] No new API routes or schema changes in this slice

## Blocked by

None — can start immediately

## Agent handoff

**Read first:** [HANDOFF.md](../HANDOFF.md), `server/routers/dashboard.py` (attach/get handlers ~968–1065), `server/services/durability_schedule.py`, `tests/server/routers/test_durability_schedule_router.py`.

**User stories:** 11–20, 50–51.

**Do not implement:** PUT save, client row matching, editable table.

**Prior art:** Existing POST permission tests in `test_durability_schedule_router.py`; extend rather than duplicate.
