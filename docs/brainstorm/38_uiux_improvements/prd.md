# Phase 38 PRD — UI/UX Standardization

## Problem Statement

The Analysis Dashboard has strong domain workflows, but its frontend visual language has drifted across pages, dialogs, settings panels, upload flows, tables, and layout shells. Mixed local styles make the app harder to scan, harder for agents to extend consistently, and harder to keep accessible as new workflow work lands.

Phase 38 establishes a shared LightRAG WebUI-style shadcn/zinc design direction and turns the reference package in `docs/brainstorm/38_uiux_improvements/references/` into small implementation batons.

## Solution

Standardize the frontend around the referenced design contract:

1. Treat `docs/brainstorm/38_uiux_improvements/references/DESIGN.md` as the phase design source.
2. Prefer shadcn/ui primitives and shadcn.io block patterns before custom UI.
3. Use the `user-shadcnio` MCP when a slice needs current shadcn component, block, or installation guidance.
4. Normalize theme tokens, typography, radius, density, borders, and destructive/error colors.
5. Introduce or reuse thin app-level wrappers only when they preserve shadcn semantics and reduce duplication.
6. Refactor visible app surfaces in small vertical slices while preserving existing behavior and accessibility.
7. Add lightweight guardrails and tests so new work does not drift back to page-local styling.

## User Stories

1. As a user, I want the app to feel visually consistent across database, upload, metadata, settings, and inspection workflows, so that I can move between tools without relearning visual patterns.
2. As a user, I want dense technical pages to remain readable, quiet, and professional, so that analysis work stays focused on the data.
3. As a user, I want destructive and error states to remain visually clear, so that risky actions and failures are easy to distinguish.
4. As a keyboard and assistive-technology user, I want dialogs, forms, tables, and menus to keep accessible focus and interaction behavior.
5. As a coding agent, I want a canonical design contract and issue order, so that UI work can proceed without broad rewrites or one-off styling.

## Product Decisions

- The target visual language is LightRAG WebUI-style shadcn/Tailwind using zinc-neutral tokens.
- shadcn/ui primitives are the default implementation foundation.
- shadcn.io and shadcn/ui blocks should be searched and adapted before custom layouts are built.
- Use the `user-shadcnio` MCP when choosing, inspecting, or adapting shadcn components and blocks. If the MCP result conflicts with the local design contract, preserve the Phase 38 contract and document the adaptation.
- System UI typography replaces downloaded or brand-specific font assumptions.
- Red is reserved for destructive actions and true error states.
- Chart colors are allowed only inside chart, plot, and data visualization regions.
- Small-radius controls and restrained surfaces are preferred over pill-heavy styling.
- Dashboard and damage plot cards are explicitly sensitive surfaces for this phase. Do not restyle or restructure them unless a later issue specifically authorizes it.

## Testing Decisions

- Use focused component, hook, or page tests for behavior that could regress while restyling.
- Prefer accessibility-oriented assertions for dialogs, menus, forms, focus behavior, labels, disabled states, loading states, and destructive confirmations.
- Use visual-drift guardrail searches for hardcoded colors, non-token Tailwind colors, one-off shells, and excessive radius.
- Avoid broad snapshot tests that make harmless shadcn markup changes expensive.
- Keep tests behavior-focused: visual refactors should not change API contracts, route behavior, or workflow state.

## Out Of Scope

- Rebuilding chart internals or damage plot cards.
- Changing backend API behavior.
- Redesigning domain workflows or navigation information architecture beyond visual normalization.
- Introducing a new component library outside shadcn/ui.
- Implementing dark mode as a standalone product feature if the existing token contract is not ready.
- Adding custom brand fonts or colorful marketing-style theming.

## Further Notes

The references folder remains the raw design package. This phase documentation defines how to implement that package safely in this repo, in small issue slices that preserve existing behavior while improving visual consistency.
