# Fallow Client v1 — Install, Audit, and Triage

Baseline static-analysis pass for `client/` after adding Fallow as a dev dependency.

**Audit date:** 2026-06-12  
**Tool:** [Fallow v2.94.0](https://github.com/fallow-rs/fallow) (`npm install --save-dev fallow` in `client/`)  
**Scope:** `Dashboard/client/src` (38,551 LOC, 2,742 functions)  
**Prior audit:** [11_fallow_frontend_report_TODO](../11_fallow_frontend_report_TODO/README_INDEX.md) (2026-06-08, v2.89.0)

## Documents

| File | Purpose |
|------|---------|
| [00_AUDIT_SUMMARY.md](./00_AUDIT_SUMMARY.md) | Raw metrics, top findings, delta vs prior audit |
| [TRIAGE.md](./TRIAGE.md) | Prioritized action plan with safety notes and false-positive guidance |

## Install and verify

```bash
cd client
npm install          # fallow is already in devDependencies (^2.94.0)
npx fallow --version
```

## Commands used for this pass

```bash
cd client

# Full baseline (all src)
npx fallow --format markdown

# Changed-code gate (current branch vs origin/master)
npx fallow audit --format markdown

# Focused slices
npx fallow dead-code --unused-files --unused-deps --format markdown
npx fallow health --score --targets --format markdown
```

## Headline results

| Check | Verdict | Notes |
|-------|---------|-------|
| **Full scan** | **fail** | 268 dead-code issues · 67 clone groups (8.6%) · 119 complexity hotspots |
| **Changed-code audit** | **pass** | 9 changed files; 0 introduced findings |
| **Health score** | **74 (B)** | Threshold gate: max cyclomatic 20, cognitive 15, CRAP 30 |

## Triage summary (priority order)

1. **Fix now (real bugs):** 2 unresolved test imports — broken module paths
2. **Quick wins (low risk):** 4 unused npm deps, 14 unused files (mostly barrels + shadcn scaffold)
3. **Medium effort:** database ↔ inspect-damage page dedup (9 clone groups in changed scope)
4. **Structural:** event-tree unification, progress-panel shared module, operation-modal complexity
5. **Guardrails (later):** `fallow init` + CI audit gate after baseline cleanup

See [TRIAGE.md](./TRIAGE.md) for full categorization.

## Delta vs 2026-06-08 audit

| Metric | 2026-06-08 (v2.89) | 2026-06-12 (v2.94) | Trend |
|--------|-------------------:|-------------------:|-------|
| Total LOC | 24,623 | 38,551 | ↑ +57% (codebase growth) |
| Dead-code issues | 193 | 268 | ↑ |
| Unused files | 12 | 14 | ↑ (+2) |
| Clone groups | 31 (7.5%) | 67 (8.6%) | ↑ duplication surface |
| Complexity hotspots | 137 | 119 | ↓ slightly |
| Unused deps | 3 | 4 | ↑ (+`canvas-confetti`) |
| Circular deps | 0 | 0 | — |

Notable shifts:

- `database/edit/page.tsx` no longer appears in top complexity hotspots (likely refactored since June).
- New duplication families in `edit-metadata/`, progress panels, and operation modals.
- `src/components/blocks/dialog/index.ts` and `src/components/ui/radio-group.tsx` are newly flagged unused files.

## Agent instructions

1. Read [TRIAGE.md](./TRIAGE.md) before deleting anything.
2. Prefer **unused files → unused deps → unused exports** (safest first).
3. Re-run `npx fallow --format markdown` from `client/` after each cleanup slice.
4. Run `npm test` before marking an item done.
5. Do not delete partial shadcn sub-exports unless the **entire file** is unused.
6. For framework entry points (Next.js `app/`, test mocks, codegen consumers), verify with grep before removal.

## Optional next steps

```bash
cd client
npx fallow init          # generate .fallowrc.json (commit config, not .fallow/ cache)
npx fallow init --agents # scaffold agent guidance (won't overwrite AGENTS.md)
```

CI gate candidate (after baseline cleanup):

```bash
npx fallow audit --changed-since origin/master --format json --quiet
```
