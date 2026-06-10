# Reference Files Index

Every file under `reference/` and why an implementer needs it.

Refresh copies: `bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh`

---

## `reference/canartdb-ui/` — Primary source of truth

Copied from [`.references/canartdb-ui`](../../../.references/canartdb-ui).

### Spreadsheet / Excel CRUD editors

| File | Purpose |
|------|---------|
| `src/components/upload/TableResultsEditor.tsx` | **Standard edit grid** — Handsontable, read-only cols, numeric norm, row context menu |
| `src/components/upload/FailedPageEditor.tsx` | **Fix-mode grid** — CSV repair, validation, `__extra_*` columns, commit guard |
| `src/components/upload/SaveConfirmDialog.tsx` | AlertDialog confirmation before batch save |
| `src/app/database/table/[tableId]/page.tsx` | **Edit page wiring** — diffRows, save/reset, fix-mode branch, CSV error UI |

### Flex navigation tables

| File | Purpose |
|------|---------|
| `src/components/upload/CertificateFlatTable.tsx` | **Flat table** — sort, pagination, batch select, delete, column resize |
| `src/components/upload/CertificatePagesTable.tsx` | **2-level tree** — Page group → Table leaf, lazy load, fix-mode link |
| `src/components/upload/ColumnResizeHandle.tsx` | Drag handle — shared by both flex tables |
| `src/components/upload/IndeterminateCheckbox.tsx` | Radix checkbox for tree batch select (verbatim from database-table skill) |
| `src/app/database/page.tsx` | List route — URL params, selection state, delete mutation |
| `src/app/database/certificate/[certificateId]/page.tsx` | Detail route — expandedPageIds URL contract, navigation handlers |

### Data layer

| File | Purpose |
|------|---------|
| `src/types/database.ts` | All TypeScript contracts for tables, rows, batch save, CSV |
| `src/lib/api/database.ts` | Typed REST client — adapt paths to target backend |
| `src/hooks/use-table-results.ts` | React Query hook for spreadsheet data |
| `src/hooks/use-certificate-hierarchy.ts` | List, pages, lazy tables hooks |
| `src/hooks/use-certificate-batch-save.ts` | Save mutation + cache invalidation |
| `src/lib/review-status.ts` | `isNeedsReview()` for status icon |
| `src/components/upload/index.ts` | Barrel exports |

### Dependencies

| File | Purpose |
|------|---------|
| `package.json` | handsontable ^17, @handsontable/react-wrapper, react-query, radix versions |

---

## `reference/database-table-skill/` — Flex table visual spec

Copied from [`.cursor/skills/database-table`](../../../.cursor/skills/database-table).

| File | Purpose |
|------|---------|
| `DESIGN.md` | Canonical layout classes, row variants, behavioral contracts |
| `tokens.md` | Indent/width constants — copy verbatim |
| `AUDIT.md` | 10-category checklist for drift detection in existing apps |
| `templates/ColumnResizeHandle.tsx` | Original template (canartdb copy should match) |
| `templates/IndeterminateCheckbox.tsx` | Original template |
| `templates/HierarchicalTable.two-level.tsx` | Generic 2-level port starting point |
| `templates/HierarchicalTable.three-level.tsx` | Generic 3-level port starting point |
| `templates/types.ts` | Data-shape contract for hierarchical templates |

---

## File dependency graph

```
types/database.ts
       ↓
lib/api/database.ts
       ↓
hooks/*.ts
       ↓
app/database/*/page.tsx  ──→  CertificateFlatTable / CertificatePagesTable
                           └→  TableResultsEditor / FailedPageEditor
       ↑
ColumnResizeHandle.tsx (shared)
```

---

## Files intentionally excluded

| File | Reason |
|------|--------|
| `DatabaseSidePanel.tsx` | Upload UI — not table rendering |
| `UploadDataSection.tsx` | Upload UI |
| `lib/api/client.ts` | Generic fetch wrapper — target app has its own |
| `components/ui/*` | Standard shadcn — install via CLI in target app |
| `node_modules/**` | Never copy |

---

## Related docs in this package

| Read when copying... | Doc |
|----------------------|-----|
| CertificateFlatTable, CertificatePagesTable | [VISUAL_SPEC.md](./VISUAL_SPEC.md) |
| TableResultsEditor, FailedPageEditor | [HANDSONTABLE_GUIDE.md](./HANDSONTABLE_GUIDE.md) |
| Page routes and data flow | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Full port workflow | [STEP_BY_STEP.md](./STEP_BY_STEP.md) |

---

## Upstream sync

| Source | Path |
|--------|------|
| Live reference app | `.references/canartdb-ui` |
| Database-table skill | `.cursor/skills/database-table` |
| Dashboard hierarchical table (related) | `client/src/components/upload/DatabaseEventTree.tsx` |

The Dashboard app's own database table (3-level Program→Version→Event) shares the same visual language but different domain. Use this package for canartdb patterns; use `.cursor/skills/database-table` skill for Dashboard-native ports.
