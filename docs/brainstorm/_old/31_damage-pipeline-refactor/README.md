# Damage Pipeline Simplification PRD Package

This package is a coding-agent handoff for simplifying the Analysis Dashboard Inspect Damage workflow.

## Goal

Replace the current lazy Inspect Damage backfill behavior with a lower-entropy lifecycle:

1. User uploads/imports event data.
2. User uploads a durability schedule.
3. Backend validates the schedule.
4. If valid, backend immediately runs the damage calculation pipeline.
5. Backend persists `event_channel_damage` results.
6. Inspect Damage becomes a read-only persisted-results view.

## Package contents

- `PRD.md` — product requirements document using the requested template.
- `HANDOFF.md` — compact baton pass for coding-agent issue execution order.
- `IMPLEMENTATION_MAP.md` — shared technical contracts/invariants across all issue slices.
- `IMPLEMENTATION_HANDOFF.md` — coding-agent implementation brief.
- `ARCHITECTURE_SKETCH.md` — current vs target architecture.
- `TEST_PLAN.md` — behavior-focused testing strategy.
- `ACCEPTANCE_CRITERIA.md` — definition of done.
- `MIGRATION_RESET_PLAN.md` — reset-first migration plan assuming old data does not matter.
- `issues/` — sequential vertical-slice issue docs (`DPR-31-01`..`DPR-31-06`).
- `GITHUB_ISSUE_BODY.md` — issue body ready for GitHub.
- `CREATE_GITHUB_ISSUE.sh` — helper script for `gh issue create`.

## Important assumption

The user explicitly stated that old data can be ignored and all data can be reuploaded from scratch. This package therefore recommends deleting/simplifying legacy compatibility paths rather than preserving stale/backfill behavior.

## Suggested coding-agent order

1. Read `PRD.md`.
2. Read `ARCHITECTURE_SKETCH.md`.
3. Implement the reset/simplification behind tests from `TEST_PLAN.md`.
4. Use `ACCEPTANCE_CRITERIA.md` as the final validation checklist.

## Issue publication

The requested agent workflow says to publish through the configured tracker and use `gh issue create` with `needs-triage`. I could not run `gh issue create` from this environment because the sandbox has no GitHub network/auth access. Use `CREATE_GITHUB_ISSUE.sh` from a local authenticated checkout.
