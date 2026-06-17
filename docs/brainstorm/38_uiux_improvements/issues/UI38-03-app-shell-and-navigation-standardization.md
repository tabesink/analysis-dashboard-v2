# UI38-03 — App Shell And Navigation Standardization

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
- App shell, layout, sidebar, header, breadcrumb, and navigation components

## Previous Slice Provides

`UI38-01` and `UI38-02` provide global tokens, shared primitives, and reusable layout wrappers.

## What To Build

Align the app shell, navigation, page headers, breadcrumbs, and high-level layout surfaces with the shadcn/zinc dashboard direction.

## This Slice Changes

- App shell layout and navigation visual treatment.
- Sidebar/header/breadcrumb styling and spacing.
- Shared page container patterns for top-level pages.
- Empty/loading/error shell-level states if they are part of navigation or route framing.

## This Slice Must Not Rework

- Route availability or authorization behavior.
- Feature page internals beyond the shell/container boundary.
- Dashboard card internals.
- Damage plot cards.

## Acceptance Criteria

- [ ] App shell uses shadcn dashboard/sidebar/header patterns or clearly documented local equivalents.
- [ ] Navigation states use semantic tokens and readable zinc-neutral contrast.
- [ ] Page headers and breadcrumbs follow one shared hierarchy.
- [ ] Responsive shell behavior remains usable.
- [ ] Existing routes and navigation interactions continue to work.
- [ ] Focused component/page tests or manual verification cover active navigation, route framing, and responsive behavior.
- [ ] Focused lint/type checks for edited frontend files pass.
- [ ] `docs/tasks/UI38-03.md` records behavior changed, interfaces changed, verification, and follow-on assumptions.
- [ ] GitNexus impact analysis is run before editing code symbols.

## Blocked By

- `UI38-01-design-contract-and-theme-baseline.md`
- `UI38-02-shadcn-primitive-and-shared-layout-baseline.md`

## Next Slice Can Assume

Top-level pages sit inside a consistent shell and can focus on their own data or workflow surfaces without re-solving global navigation style.
