# Visual Spec — Flex Tables (Workbench Parity)

Canonical sources:

- `reference/canartdb-ui/src/components/upload/CertificateFlatTable.tsx`
- `reference/canartdb-ui/src/components/upload/CertificatePagesTable.tsx`
- `reference/database-table-skill/DESIGN.md`
- `reference/database-table-skill/tokens.md`

---

## Stack gate

Before porting, confirm:

```bash
rg -l '@import "tailwindcss"' --type css
rg -l 'from "@radix-ui' --type tsx
```

If `tailwind.config.js` exists → stop and migrate to Tailwind v4 first.

---

## Card shell (both flat and hierarchy)

```tsx
<Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden border py-0 shadow-none">
  {/* toolbar */}
  <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b">...</div>

  {/* scroll body */}
  <CardContent className="flex-1 min-h-0 overflow-auto p-0">
    <div style={{ minWidth: totalRowWidth }}>
      {/* sticky header */}
      <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
        ...
      </div>
      {/* rows */}
    </div>
  </CardContent>

  {/* pagination footer — flat table only */}
  <div className="shrink-0 flex items-center justify-between border-t px-4 py-3 text-xs">...</div>
</Card>
```

| Class / rule | Why |
|--------------|-----|
| `rounded-l-none` | Table is right pane beside side panel |
| `gap-0 py-0` | Flush header to body |
| `min-h-0 overflow-auto` on CardContent | Enables sticky header inside flex parent |
| `minWidth: totalRowWidth` | Horizontal scroll when columns exceed viewport |

---

## Column layout math

### flexFor helper (copy verbatim)

```ts
function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}
```

### Width constants

| Constant | Flat table | Pages table | Notes |
|----------|------------|-------------|-------|
| `SELECT_COLUMN_PX` | 36 | — | Checkbox column (flat only) |
| `LEVEL_1_DEFAULT_PX` | 320 | 200 | First column basis |
| `MIN_COLUMN_PX` | 80 | 80 | Resize/heuristic floor |
| `MAX_COLUMN_PX` | 400 | 400 | Resize/heuristic ceiling |
| `CHAR_PX` | 7.2 | 7.2 | Geist `text-xs` heuristic |
| `PADDING_PX` | 32 | 32 | Cell padding + icons |

### totalRowWidth

```ts
// Flat
const totalRowWidth = SELECT_COLUMN_PX + level1Width + dataColumnsTotalWidth;

// Hierarchy (no select column)
const totalRowWidth = level1Width + dataColumnsTotalWidth;
```

---

## Sticky header cell

```tsx
<div className="relative flex items-center gap-1 pl-1 min-w-0" style={flexFor(level1Width)}>
  <SortableHeader ... />  {/* or plain <span> */}
  <ColumnResizeHandle width={level1Width} onResize={(n) => setColumnWidth(KEY, n)} />
</div>
```

Data columns:

```tsx
<div className="relative px-2 min-w-0" style={flexFor(widthOf(col.key))}>
  ...
  <ColumnResizeHandle width={widthOf(col.key)} onResize={...} />
</div>
```

Header text: `text-xs font-semibold text-foreground/70`

---

## Row variants

### Flat data row

```tsx
<div className={cn(
  'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
  isLast && 'border-b-0',
)}>
```

Cell text: `text-xs text-foreground/80` with `truncate` and `title` tooltip.

Primary link button:

```tsx
className="inline-flex items-center gap-2 text-left text-xs font-medium text-foreground hover:text-primary transition-colors min-w-0"
```

### Group row (Page in hierarchy)

```tsx
<div className={cn(
  'flex items-center py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
  pageIndex === 0 && '-mt-px',
  groupRowIsGroupTail && suppressLastRowBorder && 'border-b-0',
)}>
```

Chevron:

```tsx
<ChevronDown className={cn(
  'size-3.5 text-muted-foreground transition-transform duration-200',
  !isOpen && '-rotate-90',
)} />
```

### Leaf row (Table link)

```tsx
<div className="flex items-center gap-2 pl-[20px] border-l border-border min-w-0" style={flexFor(level1Width)}>
```

Table link label:

```tsx
className="truncate font-medium underline decoration-dotted"
```

Leaf data columns: **empty spans** (same flex width, no dash placeholder) — locked decision DEC-016.

---

## Sortable header

```tsx
<button className="flex items-center gap-1 hover:text-foreground transition-colors text-left min-w-0">
  <span className="truncate">{label}</span>
  {/* active: ArrowDown/ArrowUp size-3 text-primary */}
  {/* inactive: ArrowUpDown size-3 text-muted-foreground/60 */}
</button>
```

Toggle: active + desc → next asc; otherwise → desc.

---

## Batch select toolbar (flat only)

Delete button when selection active:

```tsx
className={cn(
  'h-8 rounded-md px-3 gap-2',
  hasSelection && 'text-destructive border-destructive/30 hover:bg-destructive/10',
)}
```

Rows-per-page select: `SelectTrigger className="h-8 w-[110px] text-xs"`

---

## Empty and loading states

Centered in ~400px tall area:

- Spinner: `Loader2 h-8 w-8 animate-spin text-muted-foreground`
- Empty icon: `FileSpreadsheet` inside `h-16 w-16 rounded-full bg-muted`
- Title: `text-sm font-medium text-foreground`
- Subtitle: `text-xs text-muted-foreground max-w-[280px]`

---

## Status icon

Needs-review rows show `AlertTriangle size-3.5 text-muted-foreground`. Validated rows use invisible spacer `inline-block size-3.5` to preserve alignment.

---

## ColumnResizeHandle

Port verbatim from `reference/canartdb-ui/src/components/upload/ColumnResizeHandle.tsx`:

- `role="separator" aria-orientation="vertical"`
- Hit area: `absolute top-0 right-0 h-full w-1.5 cursor-col-resize`
- Visual line: `w-px bg-border/70 group-hover:bg-primary/70`; active: `bg-primary w-0.5`
- On drag: lock `document.body.style.cursor = 'col-resize'` and `userSelect = 'none'`

Default clamp: min 60, max 600 (overridable via props).

---

## IndeterminateCheckbox (3-level / batch tree)

Use when batch-select spans a Collapsible group. **Do not** use shadcn `Checkbox` wrapper — needs raw Radix with `data-state="indeterminate"` and `onClick stopPropagation`.

See `reference/canartdb-ui/src/components/upload/IndeterminateCheckbox.tsx`.

---

## Visual parity checklist

```
[ ] Card uses rounded-r-lg rounded-l-none, no shadow
[ ] Sticky header has bg-card (opaque, not transparent)
[ ] All rows use flex, never <table>
[ ] Column headers and cells share flexFor widths
[ ] Leaf indent is pl-[20px] border-l border-border
[ ] Group rows use bg-muted/60, leaf hover bg-muted/30
[ ] Text is text-xs throughout
[ ] Truncation + title tooltip on long values
[ ] Column resize handle visible on hover at header right edge
[ ] Empty state matches icon + copy pattern
[ ] Horizontal scroll appears when totalRowWidth > viewport
```

---

## Deviations documented in reference (DEC-016)

| Canonical 3-level template | canartdb-ui pages table |
|----------------------------|-------------------------|
| Indeterminate checkboxes on groups | Omitted — selection is certificate-scoped only |
| Rollup badge in subgroup column | Omitted — no status rollup |
| Leaf cells show data | Empty — metadata lives on page row only |

When porting to a new app, explicitly decide which deviations apply.
