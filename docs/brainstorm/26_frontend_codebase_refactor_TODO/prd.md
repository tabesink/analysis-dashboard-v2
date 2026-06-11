# PRD — Frontend Design System Normalization (FR-26)

## Problem

The Workbench frontend already follows an Apple-inspired monochromatic aesthetic, but implementation drift makes it hard to extend consistently: mega-pages embed table UI, status/warning colors are ad hoc Tailwind, dialog shells are duplicated, and the canonical design spec lives in a Cursor skill folder rather than the repo.

## Goal

Normalize fonts, spacing, borders, radius, colors, layout rules, component variants, and interaction states into a **canonical design system** documented in `DESIGN.md`, without changing product intent or route structure.

## Non-goals

- Rebrand or introduce a new visual language
- Mobile/responsive redesign (desktop-first remains intentional)
- Refactoring business logic, API shapes, or data fetching
- Dark mode unless explicitly scoped after open questions are resolved

## Success criteria

1. Repo-root `DESIGN.md` exists with tokens, typography roles, layout rules, and component patterns.
2. Semantic tokens cover status, warning, panel widths, and z-index layers.
3. Duplicated visual patterns (operation modals, dialog shells, page shells, phase steppers) have single canonical components.
4. `database/page.tsx` and `inspect-damage/page.tsx` shrink to orchestration; table markup lives in shared `data-display` components.
5. No new hardcoded hex/gray/amber in TSX; agents can grep-check conformance.

## Scope (phased)

See [HANDOFF.md §12](./HANDOFF.md#12-prioritized-refactor-roadmap).

| Phase | Focus | Risk |
|-------|-------|------|
| 1 | Inventory + DESIGN.md promotion | Low |
| 2 | Token normalization | Low |
| 3 | Component consolidation (modals, shells, steppers) | Medium |
| 4 | Page extraction (DatabaseTable, WorkbenchPageShell) | High |
| 5 | Visual QA | — |

## Primary users

- Engineering team extending Database, Metadata Edit, Upload, Inspect Damage flows
- Coding agents implementing UI slices (need unambiguous tokens and component boundaries)

## References

- [HANDOFF.md](./HANDOFF.md) — full audit
- `.cursor/skills/design-guidelines/DESIGN.md` — draft canonical spec
- `.cursor/skills/database-table/SKILL.md` — hierarchical table reference behavior
