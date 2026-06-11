# Fallow Reference

## Core Commands

| Command | Purpose |
|---------|---------|
| `fallow` | Full analysis: dead code + duplication + health |
| `fallow audit` | Changed-code PR gate (pass/warn/fail) |
| `fallow dead-code` | Cleanup candidates |
| `fallow dupes` | Clone detection (`--mode semantic` for renamed vars) |
| `fallow health` | Complexity, score, hotspots, refactor targets |
| `fallow fix --dry-run` | Preview auto-removals |
| `fallow explain <rule>` | Explain a rule without running analysis |
| `fallow init` | Generate `.fallowrc.json` |
| `fallow init --agents` | Scaffold starter AGENTS.md |

All commands accept `--format json` for machine parsing. TypeScript projects can use `import type { CheckOutput } from "fallow/types"`.

## Audit Flags

```bash
fallow audit                              # auto-detect base branch
fallow audit --base main                  # explicit base ref
fallow audit --format json --quiet        # agent/CI path
fallow audit --gate all                   # fail on inherited findings too
fallow audit --production-health          # production-scoped health check
```

Exit codes: `pass` → 0, `warn` → 0, `fail` → 1.

## Dead Code Filters

```bash
fallow dead-code --unused-files
fallow dead-code --unused-exports
fallow dead-code --unused-deps
fallow dead-code --circular-deps
fallow dead-code --boundary-violations
fallow dead-code --stale-suppressions
fallow dead-code --production             # exclude test/dev files
fallow dead-code --changed-since main     # PR scope
fallow dead-code --file src/utils.ts      # single file
```

## Health & Hotspots

```bash
fallow health --score                     # 0-100 health score
fallow health --min-score 70              # CI gate
fallow health --hotspots                  # churn × complexity
fallow health --targets --effort low      # quick-win refactors
fallow health --changed-since main
```

## Duplication

```bash
fallow dupes                              # default mild mode
fallow dupes --mode semantic              # renamed variables
fallow dupes --skip-local                 # cross-directory only
fallow dupes --trace src/utils.ts:42      # trace clones at location
```

Modes: `strict`, `mild` (default), `weak`, `semantic`.

## Architecture Boundaries

Zero-config presets in `.fallowrc.json`:

```json
{ "boundaries": { "preset": "bulletproof" } }
```

Also: `layered`, `hexagonal`, `feature-sliced`.

## Baselines (legacy repos)

Save baselines from a clean ref so audit only fails on new findings:

```bash
fallow dead-code --save-baseline fallow-baselines/dead-code.json
fallow health    --save-baseline fallow-baselines/health.json
fallow dupes     --save-baseline fallow-baselines/dupes.json

fallow audit \
  --dead-code-baseline fallow-baselines/dead-code.json \
  --health-baseline    fallow-baselines/health.json \
  --dupes-baseline     fallow-baselines/dupes.json
```

Commit `fallow-baselines/`; keep `.fallow/` gitignored.

## GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: fallow-rs/fallow@v2
  with:
    command: audit
    comment: true
    review-comments: true
```

## MCP & Editor

Installing `fallow` as a dev dependency includes the MCP server and version-matched agent skill in `node_modules`.

- MCP tools: `inspect_target`, `code_execute` (read-only analysis composition)
- LSP: real-time diagnostics in VS Code, Zed, Neovim
- Hooks: `fallow hooks install --target git` or `--target agent`

## Monorepo

```bash
fallow audit --changed-workspaces origin/main
fallow health --workspace @scope/app
fallow health --group-by package --score
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `FALLOW_UPDATE_CHECK=off` | Disable upgrade hint |
| `FALLOW_PRODUCTION_HEALTH=true` | Production-scoped health |
| `FALLOW_CACHE_DIR` | Relocate analysis cache |
| `FALLOW_TELEMETRY=inspect` | Inspect telemetry payload without sending |

## Suppression

```ts
// fallow-ignore-next-line unused-export, complexity
export const helper = () => {};

// fallow-ignore-file
// suppress all issues in this file
```

JSDoc tags: `@public`, `@internal`, `@beta`, `@alpha`, `@expected-unused`.
