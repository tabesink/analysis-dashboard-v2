# Phase 38 Implementation Map

This file is the shared technical truth for Phase 38 UI/UX standardization agents. Read it before any issue in this folder. Keep it updated when an issue changes a cross-slice design or implementation contract.

## Mission

Bring the Analysis Dashboard frontend into a consistent LightRAG WebUI-style shadcn/zinc design system without changing product behavior. Standardize tokens, primitives, app shell patterns, dense data surfaces, workflow dialogs, and guardrails while preserving accessibility and avoiding sensitive chart/plot card churn.

## Source References

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/references/README.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
- `docs/brainstorm/38_uiux_improvements/references/IMPLEMENTATION_PROMPT.md`
- `user-shadcnio` MCP for current shadcn component, block, and installation guidance when a slice needs live shadcn reference material
- `AGENTS.md`

## Canonical Design Contract

Use the reference `DESIGN.md` as the phase design contract. The active product direction is:

```text
LightRAG WebUI-style shadcn dashboard
zinc neutral palette
system UI typography
small radius
quiet panels and borders
red only for destructive/error states
chart colors only in charts/plots/data visualization
shadcn primitives and blocks first
minimal custom CSS
```

## Core Invariants

- Preserve existing user workflows and data behavior.
- Preserve accessibility behavior for dialogs, forms, tables, menus, focus management, and disabled/loading states.
- Use semantic shadcn tokens: `bg-background`, `text-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, and `text-destructive` where appropriate.
- Avoid hardcoded hex colors in component files except chart-specific color configuration when necessary.
- Avoid page-local one-off shells when a shared shadcn primitive or app wrapper can express the same structure.
- Keep chart colors inside visualization regions only.
- Do not restyle or restructure dashboard cards and damage plot cards during this phase unless a later issue explicitly narrows that work.

## Current Anchors

- Root `DESIGN.md` exists and may need to be reconciled with the Phase 38 reference contract.
- `client/components.json` and `client/src/app/globals.css` define shadcn/Tailwind foundations.
- Shared UI primitives live under `client/src/components/ui/`.
- Shared layout and dialog patterns are being consolidated under `client/src/components/shared/` and related feature components.
- Recent UI work has touched edit-metadata dialogs, settings dialogs, upload/database operation modals, and shared dialog layout components.

## Preferred Block Mapping

Use `references/SHADCN_BLOCK_MAPPING.md` before custom layout work. When the work requires selecting, inspecting, installing, or adapting shadcn components or blocks, use the `user-shadcnio` MCP where appropriate and record any important adaptation notes in the issue completion note. Preferred families:

```text
app shell: dashboard, sidebar, breadcrumb
database page: data table, tables, CRUD, filters
inspect damage page: dashboard, data table, charts, resizable, tabs
upload modal: file upload, stepper, dialog, progress
settings/provider pages: settings, forms, account/billing row patterns
empty/loading/error: empty state, skeleton, error
operations history: timeline, changelog, notification
delete confirmation: alert dialog
notifications: sonner/toast
```

When adapting a block, preserve the primitive structure and replace copy, data wiring, icons, and domain behavior. Do not import decorative one-off styling or introduce new tokens. If MCP-provided examples differ from this phase's local design contract, preserve the local Phase 38 contract and adapt the example.

## Frontend Boundaries

- `client/src/app/globals.css` owns global theme variables and base styling.
- `client/components.json` owns shadcn component configuration.
- `client/src/components/ui/*` owns source-owned shadcn primitives.
- `client/src/components/layout/*` and shared layout components own app shell and reusable page/dialog structure.
- Feature folders own domain-specific content and state wiring, not global visual vocabulary.
- Upload, metadata, database, and settings dialogs may share layout primitives, but they should keep their workflow-specific behavior local.

## Styling Contracts

### Tokens

Use the zinc token model from the reference design:

```text
background: white page canvas
foreground: near-black text
muted: pale zinc surfaces
muted-foreground: zinc secondary text
border/input: zinc borders
primary: near-black primary actions
destructive: red destructive/error states
```

### Typography

Use system UI fonts. Keep dense technical content readable with clear hierarchy, not decorative font changes.

### Radius And Density

Default to small shadcn radii and compact-but-readable spacing. Avoid pill shapes unless the primitive or domain state clearly calls for it.

### Panels And Cards

Prefer white cards, zinc borders, muted secondary regions, and minimal shadow. Avoid decorative gradients and heavy elevation.

### Tables

Use shadcn table/data-table patterns. Preserve sorting, filtering, selection, expansion, and batch-action behavior when restyling.

### Dialogs

Use shared dialog layout where possible. Preserve focus trap, escape behavior, accessible titles/descriptions, busy states, and destructive confirmations.

## Testing And Guardrails

Each issue should use focused verification appropriate to its risk:

- Component tests for dialogs, forms, tables, menu interactions, and conditional content.
- Hook/API helper tests only when behavior is touched accidentally by a UI slice.
- Lint and TypeScript checks for edited frontend files.
- Guardrail searches for hardcoded hex colors, non-token Tailwind color use, `rounded-full` drift, and one-off panel shells.

Recommended guardrail searches are documented in `references/DESIGN.md`.

## Documentation Duties

Each completed issue must:

- update this map if it changes a shared design or implementation contract
- update `HANDOFF.md` with completion and next-agent notes
- create or update `docs/tasks/{task-id}.md`
- update `CHANGELOG.md` if user-facing UI behavior changes
- add a durable decision entry only when a design or architecture decision is hard to reverse, surprising without context, and based on a real trade-off

## Forbidden Shortcuts

- Do not build a custom design system beside shadcn/ui.
- Do not restyle dashboard or damage plot cards as incidental cleanup.
- Do not change backend behavior during visual standardization.
- Do not hardcode theme colors across component files.
- Do not replace accessible shadcn/Radix behavior with custom div-based controls.
- Do not use broad snapshots as the main regression strategy.
- Do not combine all UI surfaces into one sweeping refactor.
