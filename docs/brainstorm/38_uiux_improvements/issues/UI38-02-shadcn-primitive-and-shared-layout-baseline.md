# UI38-02 — shadcn Primitive And Shared Layout Baseline

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
- `client/src/components/ui/*`
- `client/src/components/shared/*`
- `client/src/components/layout/*`

## Previous Slice Provides

`UI38-01` provides the canonical design contract and global token baseline.

## What To Build

Normalize shared shadcn primitives and reusable app-level layout wrappers so later page and workflow slices have a consistent foundation.

## This Slice Changes

- Shared shadcn primitive styling only where local drift conflicts with the Phase 38 token contract.
- Reusable page, card, header, footer, dialog, empty, loading, and status wrappers when they reduce repeated one-off styling.
- Tests for shared layout behavior where accessible titles, descriptions, focus, or conditional actions could regress.

## This Slice Must Not Rework

- Feature-specific business logic.
- Large page-level layouts.
- Dashboard cards or damage plot cards.
- Table-specific behavior beyond shared primitive styling.

## Acceptance Criteria

- [ ] Shared primitives use semantic tokens instead of hardcoded visual values where practical.
- [ ] Shared layout wrappers are thin and preserve shadcn/Radix accessibility semantics.
- [ ] Existing feature components can adopt the wrappers without changing workflow state ownership.
- [ ] Dialog/card/header/footer shared patterns cover the known edit-metadata, settings, and upload modal use cases.
- [ ] Focused component tests pass for edited shared components.
- [ ] Focused lint/type checks for edited frontend files pass.
- [ ] `docs/tasks/UI38-02.md` records behavior changed, interfaces changed, verification, and follow-on assumptions.
- [ ] GitNexus impact analysis is run before editing code symbols.

## Blocked By

- `UI38-01-design-contract-and-theme-baseline.md`

## Next Slice Can Assume

Shared primitives and app-level wrappers provide a stable shadcn/zinc foundation for app shell and feature surface standardization.
