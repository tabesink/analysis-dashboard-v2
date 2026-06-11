# Project Instructions

## Documentation Structure

```
docs/
  master-build-plan.md            # Task tracker: phases, IDs, status, deps
  prd.md                          # Product requirements
  tech-stack.md                    # Technology inventory
  database-schema.txt             # Schema source of truth
  test-strategy.md                 # Test approach + gaps
  decisions/
    log.md                        # Append-only decision log
  tasks/                          # Per-task implementation notes
  architecture/                   # Deep-dive architecture docs
  brainstorm/{phase_task}/
    prd.md                        # Feature/slice PRD
    HANDOFF.md                    # Shared mission + issue order
    IMPLEMENTATION_MAP.md         # Required for multi-issue PRDs
    issues/{TASK-ID}.md           # Sequential implementation issues
```

## Required Task Hygiene

- Every task has an ID (for example, `P8-03`, `IDM-28-05`). Use it in task notes, docs, and commit messages.
- When starting a tracked task, mark it `IN PROGRESS` in `docs/master-build-plan.md`.
- When done, mark it `DONE (YYYY-MM-DD)` and summarize the result.
- For non-trivial work, create or update `docs/tasks/{task-id}.md`.
- Update `CHANGELOG.md` for user-facing behavior changes.
- Add a `docs/decisions/log.md` entry for architectural or durable design decisions.
- For multi-issue PRD work, update the PRD folder's `IMPLEMENTATION_MAP.md` and `HANDOFF.md` before handing off or marking done.

## Sequential PRD / Issue Workflow

Use this workflow whenever a PRD is split into sequential issues for independent agents.

### 1. PRD Defines Product Intent

The PRD should describe the user problem, outcomes, constraints, and non-goals. Do not bury implementation contracts only in the PRD.

### 2. Implementation Map Defines Shared Technical Truth

Create `docs/brainstorm/{phase_task}/IMPLEMENTATION_MAP.md` for any multi-issue PRD. It is the source of truth every issue must read and update.

It must include:
- End-to-end flow and state model.
- Canonical contracts and invariants.
- Key modules and ownership boundaries.
- Existing decisions and architecture docs to respect.
- Cross-layer interfaces: API shapes, task state, stores, cache invalidation, persistence semantics.
- Explicit non-goals and forbidden shortcuts.

### 3. Issues Are Sequential Batons

Each issue must include:
- **Context packet:** PRD, `HANDOFF.md`, `IMPLEMENTATION_MAP.md`, relevant decisions/docs.
- **Previous slice provides:** what the current issue can rely on.
- **This slice changes:** the narrow behavior to implement.
- **This slice must not rework:** decisions and interfaces to preserve.
- **Next slice can assume:** what must be true after completion.
- **Acceptance criteria:** behavior, tests, docs, and handoff/map updates.

Prefer thin vertical slices over broad horizontal ones. Each issue should be independently testable and should strengthen the shared contract.

### 4. Completion Note Is Mandatory

For each completed issue, add `docs/tasks/{task-id}.md` with:
- Behavior added or changed.
- Interfaces changed.
- Tests added and what they prove.
- Follow-on assumptions for the next issue.
- Decisions intentionally left unchanged.

### 5. Handoff Stays Small

`HANDOFF.md` should summarize mission, issue order, recovery/operator notes, and links. Do not duplicate the PRD or implementation map. It should tell the next agent where the baton is, not restate every detail.

## Agent Skills

- Use `.cursor/skills/` for recurring workflows.
- Relevant defaults: `tdd`, `diagnose`, `zoom-out`, `to-prd`, `to-issues`, `triage`, `grill-me`, `grill-with-docs`.
- Issue tracker: GitHub Issues for `tabesink/Dashboard` via `gh`; see `docs/agents/issue-tracker.md`.
- Labels: see `docs/agents/triage-labels.md`.
- Domain docs: see `docs/agents/domain.md`.
- If a skill asks for issue tracker, label, or domain-doc context, read the referenced `docs/agents/*.md` file first.

## GitNexus Code Intelligence

Use GitNexus when exploring unfamiliar flows, tracing behavior, editing symbols with callers, or planning multi-file changes. Follow the managed GitNexus block at the bottom of this file for the current indexed repo and required tool sequence.

## Database Changes

- Read `docs/database-schema.txt` before any database change; it is the schema source of truth.
- Update `docs/database-schema.txt` after schema changes.
- Source files: `server/schema.yaml` for dim tables/filter config; `server/storage/database.py` for non-dim tables.
- Runtime, portability export/import, and DuckDB connection notes: `docs/notes/database.md`.

## Multi-User Awareness

For write paths (upload, delete, metadata update, custom fields):
- Enforce owner/admin checks.
- Verify cache invalidation (`server/utils/cache.py`).
- Reference `docs/architecture/database-multi-user.md`.
- Reference Phase 8 in `docs/master-build-plan.md`.

## Security Considerations (Production)

Enforce these when writing or reviewing code:

### Auth, Secrets, And Sessions

- Never hardcode secrets, API keys, or passwords.
- JWT secret must be a strong random value (>=256-bit). Reject startup if `jwt_secret` is the default/placeholder.
- Production cookies: `Secure`, `HttpOnly`, `SameSite=Lax` or `Strict`.
- Token expiry should be <=24h unless refresh tokens exist.
- Hash passwords with bcrypt cost >=12. Never log, return, or store plaintext passwords.

### Input And API Boundaries

- Validate inputs at boundaries: Pydantic backend, Zod frontend where applicable.
- Use parameterized DuckDB queries; never interpolate user input into SQL.
- Sanitize uploaded filenames and reject unexpected MIME types.
- Apply auth guards to new routes (`get_current_user` or `require_admin`).
- Restrict CORS in production; never use `["*"]` outside local dev.
- Return generic client errors; log details server-side only.

### Data Protection

- Every write/update/delete verifies owner or admin.
- Soft-delete before hard-delete; only admins purge.
- Database and backups should use restrictive permissions.
- Export/import is admin-only and uses Parquet ZIP, not raw `.db`.
- Never expose stack traces or raw database errors to clients.

### Frontend Security

- Store JWT in HttpOnly cookies, not local/session storage.
- Avoid `dangerouslySetInnerHTML`; sanitize user content.
- Validate redirect URLs.
- Do not leak sensitive data into Zustand or React Query caches.

### Infrastructure & Deployment

- Run containers as non-root; drop unnecessary capabilities.
- Pin dependencies and audit for CVEs.
- Use structured audit logging without secrets or password-bearing request bodies.
- Set CPU/memory limits.
- Disable debug/verbose error pages in production.

## Versioning And Releases

- Use SemVer (`MAJOR.MINOR.PATCH`); never reuse a published version.
- Keep the version in one canonical location; derive all UI/API/build references from it.
- Document every user-facing change in `CHANGELOG.md` under `[Unreleased]`.
- Use Keep a Changelog sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Tag releases as annotated `vX.Y.Z` tags pointing to the tested commit.
- Run full automated tests and manual smoke tests before tagging.
- Verify migration compatibility for schema changes.
- Use build metadata (`+build.N`) for internal/CI builds when needed.

### Checklist for New Endpoints

1. Auth guard applied (`get_current_user` or `require_admin`)
2. Input validated via Pydantic model
3. Ownership or role check on the target resource
4. Rate limit category assigned
5. Error responses do not leak internals
6. Cache invalidation covered if the endpoint mutates data

## When Making Code Changes

- Trace before editing. Use GitNexus for unfamiliar flows and symbol impact.
- State assumptions. Ask when requirements are ambiguous.
- Prefer the smallest code that solves the verified behavior.
- Keep changes surgical; do not refactor unrelated code.
- Match existing style.
- Remove only dead code your change creates.
- Turn requests into verifiable goals and tests.
- Prefer TDD for behavior changes: one failing behavior test, minimal implementation, repeat.
- Before finishing, run focused tests/lints and GitNexus `detect_changes()` when code symbols changed.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **analysis-dashboard-v2** (11413 symbols, 21768 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/analysis-dashboard-v2/context` | Codebase overview, check index freshness |
| `gitnexus://repo/analysis-dashboard-v2/clusters` | All functional areas |
| `gitnexus://repo/analysis-dashboard-v2/processes` | All execution flows |
| `gitnexus://repo/analysis-dashboard-v2/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
