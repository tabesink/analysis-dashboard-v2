# Step-by-Step — Port Table UI to Another App

Assumes target: Next.js App Router + Tailwind v4 + shadcn + React Query.

Adjust paths (`@/components/...`) to match target conventions.

---

## Phase 0 — Prerequisites

```
[ ] Tailwind v4 with @theme inline in globals.css
[ ] shadcn: Button, Card, CardContent, Checkbox, Collapsible, Popover, Select, AlertDialog
[ ] @tanstack/react-query provider mounted
[ ] lucide-react available
[ ] (Spreadsheet only) npm install handsontable @handsontable/react-wrapper
```

---

## Phase 1 — Shared primitives

| # | Task | File |
|---|------|------|
| 1.1 | Copy column resize handle | `ColumnResizeHandle.tsx` |
| 1.2 | Copy indeterminate checkbox (if using tree batch select) | `IndeterminateCheckbox.tsx` |
| 1.3 | Copy save confirm dialog (if using spreadsheet save) | `SaveConfirmDialog.tsx` |
| 1.4 | Verify `cn()` utility exists | `lib/utils.ts` |

**Verify:** Render a dummy header row with one resize handle; drag changes width state.

---

## Phase 2 — Types and API

| # | Task | File |
|---|------|------|
| 2.1 | Copy or adapt database types | `types/database.ts` |
| 2.2 | Copy API client, wire to target `requestJson` | `lib/api/database.ts` |
| 2.3 | Implement backend endpoints OR mock with MSW/fixtures |

**Verify:** `databaseApi.listCertificates()` returns typed response in dev.

---

## Phase 3A — Flex flat table (optional)

| # | Task | File |
|---|------|------|
| 3A.1 | Copy `CertificateFlatTable.tsx` | `components/.../CertificateFlatTable.tsx` |
| 3A.2 | Replace `DATA_COLUMNS` with target columns | same |
| 3A.3 | Replace `CertificateSummary` field accessors in `formatColumnValue` | same |
| 3A.4 | Copy `useCertificateHierarchy` hook | `hooks/use-certificate-hierarchy.ts` |
| 3A.5 | Create list page with URL param state | `app/.../page.tsx` |

**Parameter table (fill before coding):**

| Param | canartdb example | Your app |
|-------|------------------|----------|
| LEVEL_1_KEY | `__certificate__` | ? |
| LEVEL_1_LABEL | Certificate | ? |
| ROW_ID_KEY | certificate_id | ? |
| ROW_LABEL_KEY | certificate_name | ? |
| DATA_COLUMNS | date_modified, modified_by, notes | ? |
| SORT_FIELDS | certificate_name, date_modified, modified_by | ? |

**Verify:** Sort, paginate, select rows, delete calls API, columns resize.

---

## Phase 3B — Flex hierarchy table (optional)

| # | Task | File |
|---|------|------|
| 3B.1 | Copy `CertificatePagesTable.tsx` | `components/.../` |
| 3B.2 | Adjust `DATA_COLUMNS` for group-row metadata | same |
| 3B.3 | Copy `usePageTables` lazy hook | `hooks/use-certificate-hierarchy.ts` |
| 3B.4 | Create detail page with `expandedPageIds` URL state | `app/.../[id]/page.tsx` |

For **3-level** hierarchy, start from `reference/database-table-skill/templates/HierarchicalTable.three-level.tsx` instead.

**Verify:** Expand/collapse pages, lazy table load, leaf links navigate, failed-page row opens fix mode.

---

## Phase 4 — Handsontable editor (optional)

| # | Task | File |
|---|------|------|
| 4.1 | Copy `TableResultsEditor.tsx` | `components/.../` |
| 4.2 | Define `READ_ONLY_FIELDS`, `NUMERIC_FIELDS` for your schema | same |
| 4.3 | Import Handsontable CSS in table page | `app/.../table/[id]/page.tsx` |
| 4.4 | Copy `useTableResults`, `useCertificateBatchSave` | `hooks/` |
| 4.5 | Copy page with diff/save/reset | `app/.../table/[id]/page.tsx` |
| 4.6 | Copy `diffRows()` helper | same page or `lib/table-diff.ts` |

**Verify:** Edit cell, add/remove row, save sends patches, reset refetches, read-only columns blocked.

---

## Phase 5 — Fix mode editor (optional)

| # | Task | File |
|---|------|------|
| 5.1 | Copy `FailedPageEditor.tsx` | `components/.../` |
| 5.2 | Set `CANONICAL_COLUMNS` for domain | same |
| 5.3 | Wire `?mode=fix` branch in table page | `app/.../table/[id]/page.tsx` |
| 5.4 | Implement CSV load + commit API endpoints | backend |

**Verify:** Extra columns show warning, commit blocked until removed, validation highlights invalid cells.

---

## Phase 6 — Integration polish

| # | Task |
|---|------|
| 6.1 | Preserve query string when navigating list → detail → table |
| 6.2 | Invalidate `['database']` queries after mutations |
| 6.3 | Toast success/error on save and delete |
| 6.4 | Loading and empty states match VISUAL_SPEC.md |
| 6.5 | Side panel layout: `flex h-[calc(100vh-7rem)]` if using upload panel |

---

## Phase 7 — QA checklist

### Flex tables
- [ ] Sticky header stays fixed while scrolling rows
- [ ] Horizontal scroll when columns wider than viewport
- [ ] Sort arrow reflects active column and direction
- [ ] Batch select all-on-page works
- [ ] Delete disabled when nothing selected

### Handsontable
- [ ] Paste from Excel works
- [ ] Context menu row ops sync state
- [ ] No infinite re-render on edit
- [ ] Save button disabled when no changes

### Accessibility
- [ ] Checkbox `aria-label` on each row
- [ ] Sort buttons have `aria-label`
- [ ] Column resize handle has `role="separator"`

---

## Refresh local references

After upstream canartdb-ui changes:

```bash
bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh
```
