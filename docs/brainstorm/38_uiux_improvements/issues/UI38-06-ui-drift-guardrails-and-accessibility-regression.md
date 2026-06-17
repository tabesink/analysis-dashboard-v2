# UI38-06 — UI Drift Guardrails And Accessibility Regression

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- Existing frontend test setup
- Existing lint/typecheck commands
- Completed `UI38-01` through `UI38-05` task notes

## Previous Slice Provides

Theme, shared primitives, app shell, data surfaces, workflow dialogs, and settings panels have been standardized in narrow slices.

## What To Build

Add the final guardrails and regression checks that make the Phase 38 design system maintainable after implementation.

## This Slice Changes

- Focused guardrail scripts, docs, or test commands for visual drift checks.
- Accessibility regression coverage for the most important changed dialogs, forms, menus, tables, and navigation surfaces.
- Documentation updates that tell future agents how to verify UI work.
- Optional small cleanup for obvious drift left by earlier Phase 38 issues, if tightly scoped and verified.

## This Slice Must Not Rework

- Broad page redesigns.
- Dashboard cards or damage plot cards.
- Backend behavior.
- Product workflow semantics.
- All frontend tests as a large snapshot suite.

## Acceptance Criteria

- [ ] The repo has documented commands or scripts for Phase 38 visual-drift checks.
- [ ] Guardrails cover hardcoded hex colors, non-token Tailwind color drift, overuse of `rounded-full`, and one-off panel shells where practical.
- [ ] Accessibility regression coverage exists for the highest-risk changed surfaces.
- [ ] The final handoff lists completed issue assumptions and remaining known drift.
- [ ] `IMPLEMENTATION_MAP.md` reflects any final shared contract changes.
- [ ] `CHANGELOG.md` is updated if Phase 38 produced user-facing UI changes.
- [ ] Focused lint/type/test commands pass, or known failures are documented with owners.
- [ ] `docs/tasks/UI38-06.md` records behavior changed, interfaces changed, verification, and residual risks.
- [ ] GitNexus impact analysis is run before editing code symbols.
- [ ] GitNexus `detect_changes()` is run before committing.

## Blocked By

- `UI38-01-design-contract-and-theme-baseline.md`
- `UI38-02-shadcn-primitive-and-shared-layout-baseline.md`
- `UI38-03-app-shell-and-navigation-standardization.md`
- `UI38-04-data-and-analysis-surface-standardization.md`
- `UI38-05-workflow-dialog-and-settings-standardization.md`

## Next Slice Can Assume

Phase 38 has a maintainable verification path for future UI work and a documented list of any remaining intentional drift.
