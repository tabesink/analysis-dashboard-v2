# Agent Handoff — DB14 Lean Source-of-Truth

**Read this first.** Scope and decisions: [prd.md](./prd.md)

---

## Your mission

Pick **one** issue from [`issues/`](./issues/), implement it completely, verify, and stop. Do not continue to a second issue in the same session unless the user explicitly asks.

---

## Quick start checklist

```
[ ] 1. Read prd.md and this handoff doc
[ ] 2. Open your issue: issues/DB14-XX-*.md
[ ] 3. Create branch: db14-xx-short-description
[ ] 4. Implement only the issue acceptance criteria
[ ] 5. Run verification commands relevant to changed areas
[ ] 6. Open PR with title: "DB14-XX: <issue title>"
```

---

## Issue picker guide

| If you are… | Start here |
|-------------|------------|
| New to this package | DB14-01 or DB14-04 |
| Backend ingestion focused | DB14-02, DB14-03, DB14-05 |
| Export/import focused | DB14-07 |
| Test-focused | DB14-08 |
| Blocked by unresolved design | DB14-00 (HITL) |

---

## Verification commands

```bash
# Server tests
uv run pytest tests/server/ -q --tb=short

# If client touched
cd client && npm test
cd client && npm run build
```

---

## Rules of engagement

1. **No scope creep** - implement only what the issue asks.
2. **One issue per PR** - keep slices independently reviewable.
3. **Source-of-truth rule** - original upload artifacts are immutable and authoritative.
4. **Derived-data rule** - canonical CSV, measurements, LTTB, and previews stay explicitly derived.
5. **Security rule** - preserve ownership and role checks on write paths.
6. **Data model rule** - check `docs/database-schema.txt` before schema changes and update it when schema changes are made.

---

## Dependency order

`DB14-00` -> `DB14-01` -> `DB14-02` -> (`DB14-03`, `DB14-04`) -> `DB14-05` -> `DB14-06` -> `DB14-07` -> `DB14-08`

---

## When done

- Include acceptance checklist in PR description.
- If architecture/design choice changed, append `docs/decisions/log.md`.
- For non-trivial implementation, add `docs/tasks/DB14-XX.md`.
- Update `docs/master-build-plan.md` only if there is a mapped task ID.

---

*Last updated: 2026-06-09*
