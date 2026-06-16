# Plotting Upgrades — Reference Index

Audit and scaffolding for **PRD-35: Inspect Damage Plotting Upgrades**. These documents reverse-engineer the Dashboard grid layout plot pipeline (backend + frontend) and map reusable patterns for 2D/3D damage plot cards.

## Documents

| File | Purpose |
|------|---------|
| [../PRD.md](../PRD.md) | Current product direction and resolved decision gates |
| [../IMPLEMENTATION_MAP.md](../IMPLEMENTATION_MAP.md) | Current implementation source of truth and issue order |
| [../HANDOFF.md](../HANDOFF.md) | Current handoff for agents and junior developers |
| [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) | Senior-engineer audit: problems, risks, clean architecture breakdown |
| [DASHBOARD_GRID_DATAFLOW.md](./DASHBOARD_GRID_DATAFLOW.md) | End-to-end Dashboard grid plot data flow (active + legacy paths) |
| [DAMAGE_PLOT_CURRENT_STATE.md](./DAMAGE_PLOT_CURRENT_STATE.md) | Current Inspect Damage 3D plot pipeline and gaps vs Dashboard |
| [DATA_CONTRACTS.md](./DATA_CONTRACTS.md) | Canonical request/response and internal type contracts |
| [REUSE_BLUEPRINT.md](./REUSE_BLUEPRINT.md) | Historical reuse scaffolding; superseded for layout and issue order |
| [REFACTORING_STRATEGIES.md](./REFACTORING_STRATEGIES.md) | Production-grade refactor patterns (no behavior change) |
| [MODULE_MAP.md](./MODULE_MAP.md) | File/symbol ownership map for both pipelines |

## How to use

1. **Before implementation** — read `../PRD.md` + `../IMPLEMENTATION_MAP.md` + `../HANDOFF.md` first, then use these reference docs for current-code context.
2. **When wiring 2D damage cards** — follow `../IMPLEMENTATION_MAP.md` for the spec-builder contract; reuse `SVGPlotCard` chrome from `DATA_CONTRACTS.md`.
3. **When fixing grid performance** — see `REFACTORING_STRATEGIES.md` § batch fetch + shared transform hook.
4. **When aligning 3D mode** — `DAMAGE_PLOT_CURRENT_STATE.md` documents existing cell builder; 3D path stays, wrapped in shared card shell.

## Key conclusion

The **active** Dashboard grid path is **client-side SVG** fed by **binary LTTB** (`POST /api/v1/dashboard/plots/data/binary`). Legacy server-side matplotlib (`/render-grid`) is unused. Inspect Damage already has a strong **view-model → cell builder → layout → renderer** stack; the upgrade should adopt Dashboard **card chrome and axis typography** without forcing damage data into the line-curve model.

## Related

- [PRD](../PRD.md)
- Notebook reference: `notebooks/relative_damage_calculation_comaparison.ipynb`
- Damage comparison aggregates: `client/src/features/inspect-damage/lib/build-damage-comparison-aggregates.ts`
