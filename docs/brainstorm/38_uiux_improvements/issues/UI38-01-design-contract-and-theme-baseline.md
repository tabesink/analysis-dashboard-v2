# UI38-01 — Design Contract And Theme Baseline

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/README.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/IMPLEMENTATION_PROMPT.md`
- Existing root `DESIGN.md`
- `client/components.json`
- `client/src/app/globals.css`

## Previous Slice Provides

The Phase 38 reference package exists and defines the intended LightRAG WebUI-style shadcn/zinc direction.

## What To Build

Establish the canonical design contract and theme baseline that later UI slices can rely on. Reconcile the root design document and global shadcn/Tailwind configuration with the Phase 38 reference direction.

## This Slice Changes

- Root `DESIGN.md` if it is stale relative to the Phase 38 reference contract.
- `client/components.json` only if shadcn configuration does not match the intended setup.
- `client/src/app/globals.css` theme variables, font stack, radius, base surfaces, and semantic token definitions.
- Focused documentation notes for any contract intentionally left unchanged.

## This Slice Must Not Rework

- Page layouts.
- Feature workflow behavior.
- Dashboard cards or damage plot cards.
- Component-level restyling outside the theme baseline unless required to keep the app compiling.

## Acceptance Criteria

- [ ] The canonical design contract is available from the root or clearly linked from the Phase 38 docs.
- [ ] Global tokens match the LightRAG/shadcn zinc direction for background, foreground, card, muted, border, input, primary, destructive, sidebar, chart, and dark-mode variables where supported.
- [ ] System UI font stack is the default.
- [ ] Radius and base styling match the small-radius shadcn direction.
- [ ] No behavior or route contracts change.
- [ ] Focused lint/type checks for edited frontend files pass.
- [ ] `docs/tasks/UI38-01.md` records behavior changed, interfaces changed, verification, and follow-on assumptions.
- [ ] GitNexus impact analysis is run before editing code symbols.

## Blocked By

- None.

## Next Slice Can Assume

The frontend has a canonical shadcn/zinc theme baseline and a root design contract that later component/page slices can cite instead of redefining visual rules.
