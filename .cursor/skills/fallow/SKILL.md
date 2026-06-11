---
name: fallow
description: Runs Fallow static analysis to keep AI-generated TypeScript/JavaScript clean — dead code, duplication, complexity, architecture boundaries. Use after agent code changes, before PRs, when triaging unused exports/deps/files, or when the user mentions fallow, code cleanup, or AI slop.
---

# Fallow — Keep AI-Generated Code Clean

[Fallow](https://github.com/fallow-rs/fallow) is deterministic codebase intelligence for TypeScript and JavaScript. It finds dead code, duplication, complexity hotspots, circular deps, and boundary violations — typically in seconds, with no config required.

Use it to close the loop after AI-assisted edits: **Fallow points, the agent acts.**

## When To Run

- After generating or editing TS/JS code with an agent
- Before opening or finishing a PR
- When the user asks to clean up dead code, dupes, or complexity
- During periodic hygiene passes on agent-heavy branches

## This Repo

The Next.js frontend lives in `client/`. Run Fallow from that directory unless the user specifies otherwise:

```bash
cd client
npx fallow audit --format json --quiet
```

Install once as a dev dependency:

```bash
cd client && npm install --save-dev fallow
```

## Agent Workflow

Copy this checklist and track progress:

```text
Fallow loop:
- [ ] 1. Finish the code change (minimal scope)
- [ ] 2. Run changed-code audit (JSON)
- [ ] 3. Triage introduced findings only
- [ ] 4. Apply auto-fixable items (dry-run first)
- [ ] 5. Manually fix or suppress remaining introduced issues
- [ ] 6. Re-run audit until verdict is pass or acceptable warn
- [ ] 7. Run project tests
```

### 1. Audit changed code

```bash
cd client
npx fallow audit --format json --quiet
```

Prefer `audit` over a full-repo scan during active work. It scopes to changed files vs the base branch and returns a **verdict**: `pass`, `warn`, or `fail`.

Parse the JSON output. Focus on findings where `introduced: true` — those are what the current changeset added. Pre-existing issues are context, not blockers, unless the user asked to fix them.

### 2. Inspect per-issue actions

Every issue in `--format json` includes an `actions` array with fix suggestions and an `auto_fixable` flag.

- `auto_fixable: true` → preview with `fallow fix --dry-run --format json`, then apply if safe
- `auto_fixable: false` → fix by hand, dedupe, or delete; do not guess

```bash
npx fallow fix --dry-run --format json
npx fallow fix --yes   # only after dry-run review
```

### 3. Triage by safety (first run or deep clean)

When doing a one-time baseline or the user wants a full hygiene pass:

```bash
cd client
npx fallow                          # full picture: dead code + dupes + health
npx fallow dead-code --unused-files # safest wins — delete whole unused files first
npx fallow dead-code --unused-deps  # remove package.json bloat
npx fallow dead-code --unused-exports  # investigate before deleting
npx fallow dupes                    # find clone families
npx fallow health --hotspots --targets  # complexity refactor targets
```

Priority order: **unused files → unused deps → unused exports → duplication → complexity**.

Unused files and deps are the cleanest wins — if nothing imports them, removal is safe. Exports need investigation; they may be entry points or framework conventions Fallow hasn't seen yet.

### 4. Handle false positives

If legitimate code is flagged, prefer config over inline suppression at scale:

```bash
cd client
npx fallow init          # generates .fallowrc.json tailored to the project
npx fallow init --agents # scaffolds AGENTS.md guidance (won't overwrite existing)
```

Common `.fallowrc.json` knobs:

```json
{
  "entry": ["src/workers/*.ts"],
  "ignorePatterns": ["**/*.generated.ts"],
  "ignoreDependencies": ["autoprefixer"],
  "ignoreExportsUsedInFile": true,
  "rules": {
    "unused-files": "error",
    "unused-exports": "warn",
    "unused-types": "off"
  }
}
```

For one-off cases:

```ts
// fallow-ignore-next-line unused-export
export const keepThis = 1;
```

Run `fallow explain unused-export` (or any rule id) to understand a rule without analyzing.

### 5. Re-verify and test

```bash
cd client
npx fallow audit --format json --quiet
npm test
```

Do not mark work done on a `fail` verdict unless the user explicitly accepts the debt.

## What Fallow Catches (AI Slop Patterns)

| Category | Examples agents often leave behind |
|----------|-------------------------------------|
| Dead code | Unused files, exports, types, deps, enum/class members |
| Duplication | Copy-pasted helpers, near-identical components |
| Complexity | Functions above cyclomatic/cognitive thresholds |
| Architecture | Circular deps, boundary violations, duplicate exports |
| Hygiene | Unlisted imports, stale suppression comments |

Fallow uses syntactic analysis — no type checker. It is fast and deterministic but may miss type-level reachability. Suppress or configure edge cases rather than ignoring real findings.

## CI Gate (optional)

For PR blocking, add the GitHub Action or run in CI:

```bash
npx fallow audit --changed-since origin/main --format json --quiet
```

See [reference.md](reference.md) for GitHub Action, baselines, MCP setup, and advanced flags.

## Rules For Agents

- Run Fallow **after** code changes, not instead of tests
- Fix **introduced** findings from `audit`; don't scope-creep into legacy debt unless asked
- Always `--dry-run` before `fallow fix --yes`
- Never delete exports/files flagged unused without checking framework entry points (Next.js app router, test files, barrel re-exports)
- Prefer removing duplication by extracting shared code over suppressing dupes
- Do not commit `.fallow/` cache directory; config (`.fallowrc.json`) is committed

## Additional Resources

- [reference.md](reference.md) — command reference, MCP, CI, monorepo scoping
- [Fallow docs](https://docs.fallow.tools)
- [Medium setup guide](https://medium.com/@stawils/how-to-use-fallow-to-keep-ai-generated-code-clean-569dba4ff7a8)
