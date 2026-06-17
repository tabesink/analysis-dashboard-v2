# UI38-05 — Workflow Dialog And Settings Standardization

## Type

AFK

## Context Packet

- `docs/brainstorm/38_uiux_improvements/prd.md`
- `docs/brainstorm/38_uiux_improvements/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/38_uiux_improvements/HANDOFF.md`
- `docs/brainstorm/38_uiux_improvements/references/DESIGN.md`
- `docs/brainstorm/38_uiux_improvements/references/SHADCN_BLOCK_MAPPING.md`
- Upload workflow components
- Edit Metadata dialog components
- Settings dialog and settings panels
- Provider/database operation dialog components

## Previous Slice Provides

Global tokens, shared layout wrappers, app shell, and data surfaces have been standardized.

## What To Build

Standardize workflow-heavy dialogs and settings panels around shared shadcn dialog, form, card-row, progress, and destructive confirmation patterns.

## This Slice Changes

- Upload modal and operation-progress presentation.
- Edit Metadata dialog layout, section headers, footer actions, and form rows.
- Settings dialog panels for changelog, database operations, user management, provider/configuration, and related forms.
- Shared dialog/page-card wrappers if this slice reveals small missing variants.

## This Slice Must Not Rework

- Upload, metadata, settings, or database operation business rules.
- Backend API contracts.
- Authorization behavior.
- Long-running operation lifecycle semantics unless a separate lifecycle issue owns them.
- Dashboard cards or damage plot cards.

## Acceptance Criteria

- [ ] Dialogs use accessible titles/descriptions, focus behavior, and consistent header/content/footer structure.
- [ ] Forms use shadcn field/input/select/checkbox/switch/button patterns or existing accessible equivalents.
- [ ] Progress, loading, error, destructive, and disabled states use semantic tokens.
- [ ] Settings panels use consistent card-row spacing and hierarchy.
- [ ] Existing workflow actions and validation behavior continue to work.
- [ ] Focused component tests cover high-risk dialog/form interactions touched by this slice.
- [ ] Focused lint/type checks for edited frontend files pass.
- [ ] `docs/tasks/UI38-05.md` records behavior changed, interfaces changed, verification, and follow-on assumptions.
- [ ] GitNexus impact analysis is run before editing code symbols.

## Blocked By

- `UI38-01-design-contract-and-theme-baseline.md`
- `UI38-02-shadcn-primitive-and-shared-layout-baseline.md`

## Next Slice Can Assume

Workflow dialogs and settings panels share one visual language and preserve existing behavior, leaving only cross-cutting drift guardrails and regression checks.
