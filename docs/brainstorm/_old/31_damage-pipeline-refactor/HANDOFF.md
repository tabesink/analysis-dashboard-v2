# HANDOFF — Damage Pipeline Refactor (DPR-31)

Use this handoff when implementing any issue in `issues/DPR-31-*.md`.

## Mission

Move damage lifecycle ownership to durability schedule save/upload and make Inspect Damage a read-only persisted-results query.

After this refactor, opening Inspect Damage must never start hidden repair/backfill/calculation work. Users should still see selected event rows immediately, plus clear running/failed status when calculation is not complete.

## Context packet

- `PRD.md`
- `IMPLEMENTATION_MAP.md`
- `ACCEPTANCE_CRITERIA.md`
- `ARCHITECTURE_SKETCH.md`
- `TEST_PLAN.md`
- `MIGRATION_RESET_PLAN.md`

## Issue order

1. `DPR-31-01` — Schedule save command starts/returns calculation lifecycle state. ✅ DONE (2026-06-12)
2. `DPR-31-02` — Accepted schedule clears stale scope results and dedupes active tasks. ✅ DONE (2026-06-12)
3. `DPR-31-03` — Damage worker persists simplified states and task outcomes. ✅ DONE (2026-06-12)
4. `DPR-31-04` — Inspect API becomes strict read model (no mutation side effects). ✅ DONE (2026-06-12)
5. `DPR-31-05` — Inspect Damage UI uses read-only states and removes backfill triggers. ✅ DONE (2026-06-12)
6. `DPR-31-06` — Reset migration + regression hardening + docs closeout. ✅ DONE (2026-06-12)

## Operator notes

- Prefer small, boundary-focused behavior tests over helper-level tests.
- Keep fatigue math logic unchanged unless a failing test proves a required fix.
- Do not add new stale/repair/rescale product states to normal UX.
- Do not reintroduce Inspect-triggered backfill as a hidden fallback.
