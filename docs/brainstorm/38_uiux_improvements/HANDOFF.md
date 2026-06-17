# Phase 38 Handoff

## Mission

Implement UI/UX standardization in small, behavior-preserving slices. Align the frontend with the LightRAG WebUI-style shadcn/zinc design references while keeping domain workflows, accessibility, and sensitive chart/plot cards stable.

## Required Reading

1. `docs/brainstorm/38_uiux_improvements/prd.md`
2. `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
3. The current issue file under `docs/brainstorm/38_uiux_improvements/issues/`
4. Reference package:
   - `docs/brainstorm/38_uiux_improvements/references/README.md`
   - `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
   - `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
   - `docs/brainstorm/38_uiux_improvements/references/IMPLEMENTATION_PROMPT.md`
5. Repo agent rules in `AGENTS.md`
6. `user-shadcnio` MCP when a slice needs current shadcn component, block, or installation guidance

## Issue Order

1. `UI38-01-design-contract-and-theme-baseline.md`
2. `UI38-02-shadcn-primitive-and-shared-layout-baseline.md`
3. `UI38-03-app-shell-and-navigation-standardization.md`
4. `UI38-04-data-and-analysis-surface-standardization.md`
5. `UI38-05-workflow-dialog-and-settings-standardization.md`
6. `UI38-06-ui-drift-guardrails-and-accessibility-regression.md`

## Current Baton

- Phase documentation has been created from the reference package.
- `UI38-04` data/analysis surface standardization has been implemented in the current working tree (see `docs/tasks/UI38-04.md`).
- Continue with `UI38-05` workflow dialogs/settings standardization, preserving the `UI38-04` data-table interaction contracts.

## Resolved Product Decisions

- shadcn/ui primitives and shadcn.io block patterns are the default implementation path.
- Agents should use the `user-shadcnio` MCP when selecting, inspecting, installing, or adapting shadcn components and blocks.
- The app should use a LightRAG WebUI-style zinc neutral palette.
- System UI typography is preferred.
- Destructive red is allowed only for destructive and true error states.
- Chart colors belong only in chart, plot, and data visualization regions.
- Dashboard cards and damage plot cards are protected from incidental restyling during this phase.

## Operating Notes

Use narrow vertical slices and preserve behavior. UI changes should usually be verified through component/page tests, accessibility assertions, lints, and targeted guardrail searches. Avoid broad snapshots and all-at-once visual rewrites.

When a slice depends on shadcn component or block details, consult the `user-shadcnio` MCP where appropriate. Preserve the Phase 38 local design contract if MCP examples include decorative styles or tokens that do not fit this app.

Before editing code symbols, run GitNexus impact analysis for the target symbol and report the blast radius. Before committing, run GitNexus `detect_changes()` and focused verification.

## Recovery Notes

If a surface needs more redesign than a single issue can safely hold, stop after the smallest coherent standardization step, document the remaining drift in the issue completion note, and update this handoff.

If a shadcn block conflicts with existing workflow behavior, preserve behavior first and adapt only the visual or structural parts that are safe.

If dashboard or damage plot cards appear coupled to the surface being refactored, isolate surrounding layout changes and leave those cards visually unchanged.

## Completion Protocol

For each completed issue:

- update the issue file with a short completion note or link to `docs/tasks/{task-id}.md`
- create or update `docs/tasks/{task-id}.md`
- update this file with any new assumption for the next issue
- update `IMPLEMENTATION_MAP.md` if shared contracts changed
- update `CHANGELOG.md` for user-facing UI behavior changes
- run focused tests/lints and guardrail searches
- run GitNexus `detect_changes()` before committing
