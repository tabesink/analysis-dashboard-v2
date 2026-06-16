## Canonical + shared?

**Partial.**

| Layer | Canonical? | Where | Routes |
|-------|------------|-------|--------|
| **`HierarchicalEventTree`** | Yes | `client/src/components/dashboard/shared/HierarchicalEventTree.tsx` | Dashboard grid (`LoadDataSection`), interactive (`CurveSelector`), inspect-damage (`DamageLoadDataPanel`) |
| **`SidePanelSection` / `SidePanelLayout`** | Yes | `client/src/components/shared/` | Dashboard, inspect-damage, DB upload, edit-metadata |
| **`GlobalFilters`** | Yes | `client/src/components/dashboard/side-panel/GlobalFilters.tsx` | Dashboard `SidePanel`, inspect-damage |
| **`LoadDataSection`** | **No** — not shared | `client/src/components/dashboard/side-panel/LoadDataSection.tsx` | `/dashboard` only |
| **`SidePanel` (whole panel)** | **No** — route-specific | `client/src/components/dashboard/side-panel/SidePanel.tsx` | `/dashboard` only |

**inspect-damage skip `LoadDataSection`.** Inline duplicate `DamageLoadDataPanel` — same `SidePanelSection` + `HierarchicalEventTree`, copy-pasted handlers. Debt. FALLOW-07 ("unify event tree components").

**Selection = single pool today.** One field:

```29:33:client/src/types/api.ts
export interface DataState {
  program_ids: string[];
  versions: [];
  selected_event_ids: string[];
}
```

`useFilterState`, plots, damage inspect, color sync → all assume **one** `selected_event_ids`. Reference + Target = **new product concept**. Not rename.

---

## PRD: Dual Load Data Side Panel (Reference / Target)

### Problem

Compare two independent load-event sets — **reference** baseline vs **target** candidate — without merge into one pool.

Today: single **Load Data** tree → `selected_event_ids`. Good for "pick events analyze together". Bad for "set A vs set B compare".

Notebooks already do this (relative damage comparison). UI need same model: two scoped selections, same tree UX, visual split.

### Goal

Side-panel variant (dedicated route or mode):

1. **Filter Data** — shared/global (optional, see open Q)
2. **Reference Load Data** — first `HierarchicalEventTree`, baseline events
3. **Divider**
4. **Target Load Data** — second `HierarchicalEventTree`, comparison events

Each section keep today behavior: program → version → event, All/None, checkboxes, status badges, color swatches (if applicable).

### User outcomes

- Pick reference + target independently, one panel
- Per-section count in subtitle (e.g. "3 selected")
- Main content (table/chart/comparison) react when **both** pools valid — or show partial state clear
- Session persist both pools on refresh/nav for that route

### Non-goals (v1)

- Replace single-pool Load Data on main dashboard grid
- Merge reference/target into one plot legend without comparison semantics
- DB upload / certificate flows (`DatabaseSidePanel`, no event trees)

### UX

```
┌─ Side Panel ─────────────────────┐
│ Filter Data                      │  ← reuse GlobalFilters (TBD)
│ ─────────────────────────────── │
│ Reference Load Data              │
│   [HierarchicalEventTree]        │
│ ─────────────────────────────── │
│ Target Load Data                 │
│   [HierarchicalEventTree]        │
└──────────────────────────────────┘
```

Collapsed panel: icon or stacked icons for both sections (TBD).

### Functional req

1. **Dual state** — persist `reference_event_ids` + `target_event_ids` (names TBD), separate from dashboard `selected_event_ids`
2. **Independent All/None** — each tree own ID list; check in Reference ≠ check in Target
3. **Shared catalog** — both trees from same filtered catalog (`useEventCatalog` / global filters)
4. **Overlap allowed** — same event in both sets OK unless product forbids (default: allow)
5. **Empty/partial** — comparison UI guide when either pool empty
6. **A11y** — titles + aria-labels distinguish Reference vs Target (not two "Load Data")

### Tech direction

- **Reuse `HierarchicalEventTree`** — prop-driven (`isChecked`, `onToggleEvent`, `onBatchSetChecked`, etc.); instantiate 2x, different handlers
- **Extract parameterized section** — generalize `LoadDataSection` → e.g. `EventLoadDataSection({ title, subtitle, selectedIds, onSelectionChange })`; kill `DamageLoadDataPanel` dup; support N sections
- **Extend session** — comparison state in session (route-scoped slice or `ComparisonDataState`); **do not overload** `selected_event_ids`
- **Color swatches** — Reference/Target share `useColorSelectionStore` or scoped namespaces? Same program in both trees → collision risk

### Open Q

1. **Which route?** New comparison page, inspect-damage extend, or dashboard tab?
2. **Global filters** — one filter both trees, or independent scopes?
3. **Mutual exclusion?** Target pick auto-remove from Reference (or reverse)?
4. **Downstream contract** — which API/compute consume `{ referenceIds, targetIds }`?
5. **Interactive mode** — Reference/Target replace `CurveSelector`, or grid/comparison only?

### Acceptance

- Panel show **Reference Load Data** + **Target Load Data**, visible separator; titles ≠ "Load Data"
- Each section: checkboxes, All/None, independent counts
- Refresh restore both selections for session
- Main view use both pools per comparison rules (per route)
- No regression single-pool `/dashboard` or inspect-damage unless explicit migrate

### Success

Analyst configure reference/target in UI without notebook script. Comparison view run on two explicit sets.

---

**Bottom line:** `HierarchicalEventTree` + side-panel shell = right blocks. `LoadDataSection` + single `selected_event_ids` = not enough. Need parameterized section + dual session state. Impl needs target route + comparison backend spec.
