# Handsontable Guide — Excel-like CRUD Editors

Canonical sources:

- `reference/canartdb-ui/src/components/upload/TableResultsEditor.tsx`
- `reference/canartdb-ui/src/components/upload/FailedPageEditor.tsx`
- `reference/canartdb-ui/src/app/database/table/[tableId]/page.tsx`

---

## Dependencies

Add to target `package.json`:

```json
{
  "dependencies": {
    "handsontable": "^17.0.1",
    "@handsontable/react-wrapper": "^17.0.1"
  }
}
```

License: reference uses `licenseKey="non-commercial-and-evaluation"`. Production apps need a commercial license from Handsontable.

---

## One-time setup

### 1. Import CSS (once per app, e.g. in the page that renders the grid)

```tsx
import 'handsontable/styles/handsontable.min.css';
```

### 2. Register modules (once per module that uses HotTable)

```tsx
import Handsontable from 'handsontable/base';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';

registerAllModules();
```

Using `handsontable/base` + `registerAllModules()` keeps bundle smaller than full import.

---

## Minimal editable grid

```tsx
<HotTable
  data={data}                    // 2D array: rows × columns
  colHeaders={columns}           // string[]
  rowHeaders={true}
  stretchH="all"
  height="70vh"
  licenseKey="non-commercial-and-evaluation"
  contextMenu={['row_above', 'row_below', 'remove_row']}
  afterChange={(changes, source) => {
    if (!changes || source === 'loadData') return;
    // map changes back to your row model
  }}
  afterRemoveRow={(index, amount) => {
    // splice rows in your state
  }}
/>
```

---

## TableResultsEditor pattern

### Props contract

```ts
interface TableResultsEditorProps {
  columns: string[];
  rows: TableResultRow[];
  onRowsChange: (rows: TableResultRow[]) => void;
}
```

Presentation only — parent owns save/reset.

### Data mapping

```ts
const data = rows.map((row) =>
  columns.map((column) => getCellValue(row, column))
);
```

### Column settings

```ts
const columnSettings = columns.map((name) => ({
  readOnly: READ_ONLY_FIELDS.has(name),
}));
// pass as columns={columnSettings}
```

### Numeric fields

Maintain a `Set` of numeric field names. On change:

```ts
if (NUMERIC_FIELDS.has(field)) {
  row[field] = normalizeNumeric(nextValue); // '' → null, invalid → null
}
```

### Row CRUD via context menu

| Menu item | Handler |
|-----------|---------|
| `row_above` / `row_below` | Handsontable inserts row; sync in `afterChange` or dedicated hooks |
| `remove_row` | `afterRemoveRow` → splice local state |

---

## Page-level CRUD flow (save / reset)

From `reference/canartdb-ui/src/app/database/table/[tableId]/page.tsx`:

### State

```ts
const [editorRows, setEditorRows] = useState<TableResultRow[]>([]);
const [hasUserEditedRows, setHasUserEditedRows] = useState(false);
const editSessionId = useMemo(() => crypto.randomUUID(), []);

const activeRows = hasUserEditedRows ? editorRows : (tableQuery.data?.rows ?? []);
```

### Diff before save

```ts
function diffRows(original: TableResultRow[], updated: TableResultRow[]): BatchChange[] {
  // For each updated row, compare field-by-field (skip result_row_id)
  // Emit { result_row_id, patch: { field: newValue } }
}
```

### Save mutation

```ts
await batchSaveMutation.mutateAsync({
  certificateId,
  payload: { changes: pendingChanges, client_edit_session_id: editSessionId },
});
```

### Reset

```ts
setHasUserEditedRows(false);
setEditorRows([]);
void tableQuery.refetch();
```

### Toolbar buttons

| Button | Enabled when |
|--------|--------------|
| Save | `pendingChanges.length > 0` |
| Reset | local edits exist OR refetch in flight |

Wrap save in `SaveConfirmDialog` (AlertDialog) for confirmation.

---

## FailedPageEditor pattern (fix mode)

### Row model

```ts
interface RowState {
  id: string;
  values: Record<string, string>;  // canonical columns
  extras: Record<string, string>;  // __extra_* OCR drift columns
}
```

### Canonical vs extra columns

- `CANONICAL_COLUMNS` — fixed schema, required for commit
- `__extra_*` — detected from CSV header; must be deleted before commit

### Validation → cell classes

```tsx
cells={(row, col) => {
  const meta: Handsontable.CellMeta = {};
  if (column.startsWith('__extra_')) meta.className = 'htDimmed';
  if (errorsByColumn[column]) meta.className = 'htInvalid';
  return meta;
}}
```

Built-in Handsontable classes:

- `htInvalid` — red cell background (validation error)
- `htDimmed` — gray/dimmed (informational)

Optional app-level override in `globals.css`:

```css
.handsontable td.htInvalid {
  background-color: hsl(var(--destructive) / 0.15) !important;
}
```

### Column delete guard

```tsx
beforeRemoveCol={(index, amount) => {
  const blocked = targets.filter((c) => !c.startsWith('__extra_'));
  if (blocked.length) { toast.error(...); return false; }
  return true;
}}
```

### Commit payload

```ts
{
  page_metadata: PageMetadataPayload,
  table_number: number,
  rows: Array<Record<string, string | number | null>>,
}
```

---

## Stable refs (avoid grid remount)

In `FailedPageEditor`, Handsontable callbacks use refs:

```ts
const rowsRef = useRef(rows);
useEffect(() => { rowsRef.current = rows; });
```

Without this, inline callbacks change every render → selection/copy buffer lost.

---

## Hook: useTableResults

```ts
export function useTableResults(tableId: string | null) {
  return useQuery({
    queryKey: ['database', 'tables', tableId, 'results'],
    queryFn: ({ signal }) => databaseApi.getTableResults(tableId!, signal),
    enabled: Boolean(tableId),
  });
}
```

---

## Hook: useCertificateBatchSave

```ts
return useMutation({
  mutationFn: ({ certificateId, payload }) =>
    databaseApi.saveCertificateResultsBatch(certificateId, payload),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['database'] }),
});
```

---

## API endpoints (contract)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/database/tables/:tableId/results` | Load columns + rows |
| PUT | `/api/v1/database/certificates/:id/results-batch` | Patch save |
| GET | `/api/v1/database/pages/:pageId/csv-content?table_number=N` | Fix mode CSV |
| POST | `/api/v1/database/certificates/:id/pages/:pageNum/commit-from-failure` | Fix mode commit |

Adapt paths to target backend; keep request/response shapes aligned with `types/database.ts`.

---

## Handsontable parity checklist

```
[ ] handsontable.min.css imported
[ ] registerAllModules() called
[ ] afterChange ignores source === 'loadData'
[ ] Read-only columns configured via columns prop
[ ] Numeric normalization matches backend expectations (null vs 0)
[ ] Row remove syncs local state in afterRemoveRow
[ ] Context menu enabled for row CRUD
[ ] Save sends patch diff, not full dataset
[ ] Reset clears local buffer and refetches
[ ] Fix mode blocks commit with __extra_* columns present
[ ] Validation errors visible (htInvalid)
[ ] Grid height set (60–70vh) inside scrollable Card
```

---

## When NOT to use Handsontable

- Simple read-only tables → use flex table paradigm
- Single-field inline edit → use row-level Input
- Very large datasets (10k+ rows) without virtualization request → discuss performance first

For navigation/summary views, always prefer flex tables from VISUAL_SPEC.md.
