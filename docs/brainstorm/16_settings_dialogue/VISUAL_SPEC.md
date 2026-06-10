# Visual Spec — Settings Dialog Parity

Use this as a pixel-level checklist when implementing or reviewing the Dashboard settings dialog against the Context Engine UI reference.

**Canonical reference:** `reference/context-engine-ui/components/settings/SettingsDialog.tsx`

---

## Dialog geometry

| Property | Value |
|----------|-------|
| Max height | `min(720px, calc(100vh - 96px))` |
| Max width | `min(980px, calc(100vw - 48px))` |
| Position | `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` |
| Border radius | `rounded-xl` |
| Padding | `p-0` on content (internal sections handle padding) |
| Shadow | `shadow-sm` |
| Overflow | `overflow-hidden` on content; right panel `overflow-y-auto` |

## Overlay

```
fixed inset-0 z-50
bg-white/70 backdrop-blur-[1px]
dark:bg-black/45
data-[state=open]:animate-in data-[state=closed]:animate-out
data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
```

## Two-column grid

```
grid h-full min-h-0 grid-cols-[180px_1fr]
```

### Left aside (nav rail)

| Property | Classes |
|----------|---------|
| Border | `border-r border-[var(--border)]` |
| Background | `bg-[var(--background)]` |
| Padding | `px-3 py-4` |
| Close row | `mb-4 flex items-center gap-2 px-1` |
| Nav spacing | `space-y-1` |

### Nav item button

**Default:**
```
flex w-full items-center gap-2 rounded-lg px-2.5 py-2
text-sm font-normal transition-colors
text-[var(--foreground)] hover:bg-[var(--secondary)]
```

**Active:**
```
bg-[var(--secondary)] text-[var(--foreground)]
```
Plus `aria-current="page"`.

**Icon:** `size-4 shrink-0` (lucide)

### Close button

```
variant="ghost" size="icon-sm"
rounded-full text-[var(--foreground)] hover:bg-[var(--secondary)]
```
Icon: `X` at `size-4`.

## Right content panel

| Property | Classes |
|----------|-------|
| Scroll | `min-h-0 overflow-y-auto` |
| Padding | `px-6 py-4` |

### Section header (General, Account)

**Bordered header** (`useFlatHeader = false`):
```
mb-5 border-b border-[var(--border)] pb-4
h2: text-base font-medium text-[var(--foreground)]
```

**Flat header** (future panels like KG/Providers in reference):
```
mb-4 pb-1
```
Dashboard v1 only needs bordered headers.

## Panel: General

Reference: `reference/context-engine-ui/components/settings/panels/GeneralSettingsPanel.tsx`

| Element | Classes |
|---------|---------|
| Card container | `rounded-xl bg-[var(--secondary)]/60 p-4` |
| Icon circle | `mb-3 flex size-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)]` |
| Title | `text-sm font-medium text-[var(--foreground)]` |
| Body | `mt-1 max-w-[34rem] text-sm leading-5 text-[var(--muted-foreground)]` |
| CTA button | `variant="outline" size="sm" mt-3 rounded-full bg-[var(--background)] px-4 shadow-none` |

## Panel: Account (shell styling)

Reference Account panel uses monochrome pill inputs. Dashboard's current page uses Card + Table — **either is acceptable inside the dialog** as long as:

- Table header row uses subtle fill: `bg-[var(--secondary)]/45` (reference) or existing Dashboard table styling
- Nested dialogs (create/reset/delete) use `rounded-xl border-[var(--border)] shadow-none`
- Inputs in nested dialogs: `rounded-full border-[var(--border)] bg-[var(--background)] shadow-none`

If migrating Dashboard table as-is, wrap in:
```
rounded-xl border border-[var(--border)] bg-[var(--background)]
```

## Route icons (Dashboard v1)

| Route | Icon | Label | Admin only |
|-------|------|-------|------------|
| `general` | `Settings` | General | No |
| `account` | `UserRound` | Account | Yes (panel shows gate card for non-admin) |

Reference also has `knowledge-graph` (`Workflow`) and `provider` (`Bot`) — **do not add** in Dashboard v1.

## CSS variables (already in Dashboard globals.css)

The reference and Dashboard share the same Apple-inspired token set:

- `--background: #ffffff`
- `--foreground: #1d1d1f`
- `--secondary: #f5f5f7`
- `--muted-foreground: #86868b`
- `--border: #e8e8ed`

No new tokens required for shell parity.

## z-index stacking

- Overlay + content: `z-50`
- Nested dialogs (create user, etc.) must appear above settings dialog — shadcn Dialog default `z-50` may conflict; verify nested modals render correctly. If needed, bump nested dialog z-index to `z-[60]` only for child dialogs.

## Accessibility

- `DialogPrimitive.Title` with `sr-only` text "Settings"
- Nav has `aria-label="Settings sections"`
- Active nav item has `aria-current="page"`
- Close button has `aria-label="Close settings"`

## Side-by-side review checklist

```
[ ] Modal centered with ~48px viewport margin
[ ] Left rail exactly 180px
[ ] Active nav item has secondary background fill
[ ] Overlay is frosted white, not solid gray
[ ] Content header has bottom border on General/Account
[ ] Close X sits in top-left of aside, not in content header
[ ] Dialog does not shift page scroll position permanently
[ ] ESC closes dialog
```
