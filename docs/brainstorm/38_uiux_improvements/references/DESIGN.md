# Design System — LightRAG WebUI / shadcn Zinc Dashboard

## 0. Purpose

This `DESIGN.md` is the canonical visual and implementation contract for the Analysis Dashboard frontend.

The goal is to make the app feel consistent, quiet, professional, and implementation-friendly by aligning it with a LightRAG WebUI-style shadcn/Tailwind design language:

- Tailwind/system UI typography.
- shadcn/ui primitives as the default component foundation.
- shadcn.io / shadcn/ui blocks as the default layout and page-pattern source.
- Zinc-neutral palette instead of a colorful branded palette.
- White canvas, near-black text, zinc borders, pale muted surfaces.
- Red only for destructive/error states.
- Chart colors only inside visualization/data regions.
- Small-radius controls and panels, not pill-heavy Ollama styling.
- Minimal custom UI unless a shadcn primitive/block cannot satisfy the requirement.

This document replaces the earlier Ollama-inspired direction. The app should no longer use SF Pro Rounded as a brand font, no longer require pill-shaped controls, and no longer enforce pure grayscale with no semantic red. The target is now a pragmatic shadcn/zinc application UI, closer to LightRAG WebUI.

---

## 1. Visual Theme & Atmosphere

The Analysis Dashboard should feel like a practical engineering analysis tool: quiet, readable, dense enough for technical workflows, but visually restrained.

The app should look like a high-quality shadcn/Tailwind dashboard using a zinc neutral palette:

- White page background.
- Near-black foreground text.
- White cards and panels.
- Pale zinc muted surfaces.
- Zinc borders and input borders.
- Compact radius.
- Minimal shadows.
- Red only for destructive actions and true error states.
- Chart colors only inside charts/plots/data visualization.
- System UI typography for a native application feel.

The design should not look like a marketing site. It should look like a production internal tool: database, inspection, upload, settings, provider configuration, damage calculation, and visualization workflows.

### Key Characteristics

- LightRAG/shadcn zinc palette.
- Native system font stack, no downloaded custom brand font.
- Small-radius geometry: `8px` default, `6px` controls, `4px` tiny inner elements.
- shadcn/ui primitives are the primary source of UI consistency.
- shadcn.io and shadcn/ui blocks should be used as layout/page scaffolds.
- Minimal custom CSS beyond theme variables and app-specific layout refinements.
- Low visual decoration; high functional clarity.
- Dark mode is supported through the same shadcn token contract.
- Destructive red is allowed, but only for destructive/error states.
- Chart colors are allowed, but only in data visualization.

---

## 2. Implementation Philosophy: shadcn First

### Default Rule

Before creating custom UI, first ask:

1. Is there a shadcn/ui primitive for this?
2. Is there a shadcn/ui block that already solves the layout?
3. Is there a shadcn.io block that can be adapted?
4. Can the requirement be composed from existing app-level wrappers around shadcn components?

Only create custom UI when the answer to all of the above is no.

### Why

shadcn components are source-owned, Tailwind-based, accessible primitives. This makes them ideal for a codebase where coding agents and multiple contributors need a consistent implementation surface. The goal is not to invent a custom component library; the goal is to configure and compose shadcn consistently.

### Required shadcn/ui Foundation

The app should maximize reuse of these primitives:

| Need | shadcn primitive |
|---|---|
| Buttons/actions | `Button`, `ButtonGroup` |
| Inputs/forms | `Input`, `Textarea`, `Select`, `Label`, `Field`, `Checkbox`, `RadioGroup`, `Switch` |
| Page sections | `Card`, `Separator`, `ScrollArea`, `Resizable` |
| Navigation shell | `Sidebar`, `Breadcrumb`, `NavigationMenu`, `Sheet` |
| Tables | `Table`, `Data Table` pattern |
| Menus | `DropdownMenu`, `ContextMenu`, `Command`, `Popover`, `Tooltip`, `HoverCard` |
| Modals | `Dialog`, `AlertDialog`, `Drawer`, `Sheet` |
| Feedback | `Sonner`, `Toast`, `Progress`, `Skeleton`, `Spinner`, `Empty` |
| Tabs and filters | `Tabs`, `Toggle`, `ToggleGroup`, `Badge` |
| Charts | shadcn `Chart` pattern, Recharts where applicable |
| Date inputs | `Calendar`, `DatePicker` pattern |
| Pagination | `Pagination` |
| Upload flows | shadcn.io File Upload blocks or composed `Card` + `Progress` + `Button` |
| Settings screens | shadcn.io Settings blocks or composed `Card` rows |
| Auth | shadcn Login blocks if auth screens are rebuilt |

### Required shadcn Block Sources

Use shadcn block libraries as scaffolds before custom layouts:

| App area | Preferred block family |
|---|---|
| Main dashboard shell | `dashboard-01`, shadcn Dashboard blocks |
| Left navigation | `sidebar-07` or `sidebar-03` style block |
| Database page | shadcn Data Table / Tables blocks |
| Inspect Damage page | Dashboard + Data Table + Chart blocks |
| Upload workflow | File Upload + Stepper + Dialog blocks |
| Provider/settings page | Settings + Form blocks |
| Empty screens | Empty State blocks |
| Login/auth | Login blocks |
| Notifications | Notification / Sonner patterns |
| Command palette/search | Command Menu + Search blocks |
| Error states | Error blocks |
| Changelog/operations history | Timeline / Changelog blocks |

### Block Adaptation Rule

When importing a block:

1. Keep its shadcn primitive structure.
2. Replace only app copy, data wiring, icons, and domain logic.
3. Do not introduce one-off visual tokens.
4. Map all colors to CSS variables.
5. Keep class names token-based: `bg-background`, `text-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`.
6. Avoid hardcoded hex colors in component files except for charts when necessary.
7. If the block uses overly decorative styles, simplify it rather than rewriting from scratch.

---

## 3. Color Palette & Tokens

The app uses the LightRAG/shadcn zinc palette.

### Practical Light Mode Palette

| Role | CSS variable | HSL | Approx hex | Use |
|---|---|---:|---:|---|
| Background | `--background` | `0 0% 100%` | `#ffffff` | Page background |
| Foreground | `--foreground` | `240 10% 3.9%` | `#09090b` | Main text |
| Card | `--card` | `0 0% 100%` | `#ffffff` | Cards/panels |
| Card foreground | `--card-foreground` | `240 10% 3.9%` | `#09090b` | Text on cards |
| Primary | `--primary` | `240 5.9% 10%` | `#18181b` | Primary buttons/text |
| Primary foreground | `--primary-foreground` | `0 0% 98%` | `#fafafa` | Text on primary |
| Secondary | `--secondary` | `240 4.8% 95.9%` | `#f4f4f5` | Secondary surfaces |
| Secondary foreground | `--secondary-foreground` | `240 5.9% 10%` | `#18181b` | Text on secondary |
| Muted | `--muted` | `240 4.8% 95.9%` | `#f4f4f5` | Muted surfaces |
| Muted foreground | `--muted-foreground` | `240 3.8% 46.1%` | `#71717a` | Subtle text |
| Accent | `--accent` | `240 4.8% 95.9%` | `#f4f4f5` | Hover/active bg |
| Accent foreground | `--accent-foreground` | `240 5.9% 10%` | `#18181b` | Hover/active text |
| Border | `--border` | `240 5.9% 90%` | `#e4e4e7` | Borders |
| Input | `--input` | `240 5.9% 90%` | `#e4e4e7` | Input borders |
| Ring | `--ring` | `217.2 91.2% 59.8%` | `#3b82f6` | Focus rings |
| Destructive | `--destructive` | `0 84.2% 60.2%` | `#ef4444` | Delete/error |
| Destructive foreground | `--destructive-foreground` | `0 0% 98%` | `#fafafa` | Text on destructive |

### Practical App Token Aliases

Use these mental aliases when designing:

```css
--background: #ffffff;
--foreground: #09090b;
--surface: #ffffff;
--surface-muted: #f4f4f5;
--border: #e4e4e7;
--text-muted: #71717a;
--primary: #18181b;
--primary-foreground: #fafafa;
--danger: #ef4444;
```

### Sidebar Light Mode Palette

| Role | CSS variable | HSL | Approx hex |
|---|---|---:|---:|
| Sidebar background | `--sidebar-background` | `0 0% 98%` | `#fafafa` |
| Sidebar foreground | `--sidebar-foreground` | `240 5.3% 26.1%` | `#3f3f46` |
| Sidebar primary | `--sidebar-primary` | `240 5.9% 10%` | `#18181b` |
| Sidebar primary foreground | `--sidebar-primary-foreground` | `0 0% 98%` | `#fafafa` |
| Sidebar accent | `--sidebar-accent` | `240 4.8% 95.9%` | `#f4f4f5` |
| Sidebar accent foreground | `--sidebar-accent-foreground` | `240 5.9% 10%` | `#18181b` |
| Sidebar border | `--sidebar-border` | `220 13% 91%` | `#e5e7eb` |
| Sidebar ring | `--sidebar-ring` | `217.2 91.2% 59.8%` | `#3b82f6` |

### Dark Mode Palette

| Role | CSS variable | HSL | Approx hex |
|---|---|---:|---:|
| Background | `--background` | `240 10% 3.9%` | `#09090b` |
| Foreground | `--foreground` | `0 0% 98%` | `#fafafa` |
| Card | `--card` | `240 10% 3.9%` | `#09090b` |
| Card foreground | `--card-foreground` | `0 0% 98%` | `#fafafa` |
| Primary | `--primary` | `0 0% 98%` | `#fafafa` |
| Primary foreground | `--primary-foreground` | `240 5.9% 10%` | `#18181b` |
| Secondary / muted / accent | `--secondary`, `--muted`, `--accent` | `240 3.7% 15.9%` | `#27272a` |
| Muted foreground | `--muted-foreground` | `240 5% 64.9%` | `#a1a1aa` |
| Border / input | `--border`, `--input` | `240 3.7% 15.9%` | `#27272a` |
| Ring | `--ring` | `240 4.9% 83.9%` | `#d4d4d8` |
| Destructive | `--destructive` | `0 62.8% 30.6%` | `#7f1d1d` |

### Chart Colors

Chart colors are allowed only inside chart, plot, and data visualization components.

Light mode:

```css
--chart-1: #e76e50;
--chart-2: #2a9d90;
--chart-3: #274754;
--chart-4: #e8c468;
--chart-5: #f4a462;
```

Dark mode:

```css
--chart-1: #2662d9;
--chart-2: #2eb88a;
--chart-3: #e88c30;
--chart-4: #af57db;
--chart-5: #e23670;
```

### Color Rules

Do:

- Use `bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-muted`, `text-muted-foreground`.
- Use `bg-primary text-primary-foreground` for primary actions.
- Use `bg-destructive text-destructive-foreground` only for destructive actions.
- Use chart colors only under chart/plot components.

Do not:

- Hardcode arbitrary brand blues/greens/purples in UI chrome.
- Use chart colors for buttons, tabs, nav, badges, status tags, or forms.
- Use red for normal “important” actions; reserve it for destructive/error states.
- Introduce custom semantic color palettes without a documented reason.

---

## 4. CSS Variables

Use this as the canonical `globals.css` token target.

```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.5rem;

  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 217.2 91.2% 59.8%;

  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;

  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-primary: 240 5.9% 10%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;

  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;

  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;

  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;

  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;

  --chart-1: 221 83% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;

  --sidebar-background: 240 10% 3.9%;
  --sidebar-foreground: 240 4.9% 83.9%;
  --sidebar-primary: 0 0% 98%;
  --sidebar-primary-foreground: 240 5.9% 10%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 0 0% 98%;
  --sidebar-border: 240 3.7% 15.9%;
  --sidebar-ring: 240 4.9% 83.9%;
}
```

---

## 5. Typography

### Font Family

Use Tailwind’s default sans/system stack. Do not download or bundle a custom UI font.

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif,
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Segoe UI Symbol",
  "Noto Color Emoji";
```

Practical rendering:

- Windows: usually Segoe UI.
- macOS/iOS: system San Francisco via `system-ui`.
- Android/Linux: platform default sans.

### Monospace

Use Tailwind/system monospace:

```css
font-family:
  ui-monospace,
  SFMono-Regular,
  Menlo,
  Monaco,
  Consolas,
  "Liberation Mono",
  "Courier New",
  monospace;
```

### Type Scale

| Role | Size | Weight | Line height | Tailwind direction | Use |
|---|---:|---:|---:|---|---|
| Page title | 30–36px | 600 | 1.1 | `text-3xl font-semibold tracking-tight` | Main page headers |
| Section title | 20–24px | 600 | 1.25 | `text-xl font-semibold tracking-tight` | Cards/panels |
| Card title | 16–18px | 600 | 1.3 | `text-base font-semibold` | Card headers |
| Body | 14–16px | 400 | 1.5 | `text-sm` / `text-base` | Content |
| UI label | 12–14px | 500 | 1.4 | `text-xs font-medium` / `text-sm font-medium` | Forms, metadata |
| Muted text | 12–14px | 400 | 1.45 | `text-muted-foreground` | Secondary copy |
| Table text | 12–14px | 400–500 | 1.4 | `text-sm` | Dense data |
| Code | 12–14px | 400–500 | 1.5 | `font-mono text-xs` | IDs, snippets |

### Typography Rules

Do:

- Use system UI everywhere.
- Use `font-semibold` sparingly for headers and active labels.
- Use `tracking-tight` only for page-level and section-level headings.
- Use `font-mono` for job IDs, work orders, channel names, command snippets, and technical IDs.
- Prefer `text-sm` for dashboard UI density.

Do not:

- Use SF Pro Rounded as a display brand font.
- Use heavy display typography on dense dashboard pages.
- Mix unrelated custom fonts.
- Use excessive font weights to create hierarchy.

---

## 6. Radius, Shape, and Density

This design uses compact shadcn-style radius, not Ollama pill geometry.

### Radius Scale

| Token | Value | Use |
|---|---:|---|
| `--radius` | `0.5rem` / 8px | Default shadcn radius |
| `rounded-sm` | ~6px | Buttons, inputs, badges, tabs |
| `rounded-md` | ~8px | Cards, panels, dialogs, dropdowns |
| `rounded-lg` | ~10px | Larger app containers when needed |
| `rounded-full` | only for avatars, switch thumbs, small status dots | Not default |

### Shape Rules

Do:

- Use `rounded-md` for cards, panels, dialogs, dropdowns.
- Use `rounded-sm` or default shadcn button/input radius for controls.
- Use `rounded-full` only when the underlying shadcn primitive expects it: avatar, switch thumb, radio item, progress bar.
- Keep tables and dense panels compact.

Do not:

- Make every button/input/tag pill-shaped.
- Create custom radius scales.
- Mix random `rounded-xl`, `rounded-2xl`, and `rounded-full` without reason.

---

## 7. Depth & Elevation

Use the default shadcn approach: mostly flat, with subtle borders and very subtle shadows only where shadcn uses them.

### Elevation Levels

| Level | Treatment | Use |
|---|---|---|
| Level 0 | `bg-background` | Page canvas |
| Level 1 | `bg-card border border-border rounded-md` | Cards, panels |
| Level 2 | `bg-popover border border-border shadow-md` | Popovers, dropdowns, dialogs |
| Level 3 | Overlay + dialog content | Modals and alert dialogs |

### Shadow Rules

Do:

- Keep shadows subtle and inherited from shadcn where appropriate.
- Use borders as the primary separation mechanism.
- Use `bg-muted` for low-emphasis sections.

Do not:

- Add heavy custom shadows.
- Use shadows to make every card float.
- Use glassmorphism or blur-heavy effects.

---

## 8. Component Styling Rules

## 8.1 Buttons

Use shadcn `Button`.

### Variants

| Variant | Use |
|---|---|
| `default` | Primary application action; maps to `bg-primary text-primary-foreground` |
| `secondary` | Secondary actions; maps to `bg-secondary text-secondary-foreground` |
| `outline` | Common toolbar/table actions |
| `ghost` | Low-emphasis icon or navigation actions |
| `destructive` | Delete/remove/destructive actions only |
| `link` | Inline text actions only |

### Button Rules

Do:

- Prefer shadcn button variants instead of custom button classes.
- Use `size="sm"` for toolbar/table actions.
- Use icon buttons only through `Button size="icon"`.
- Use `destructive` only for destructive actions.

Do not:

- Create custom black/gray/red button classes outside the primitive.
- Use destructive style for warnings or primary actions.
- Make all buttons pill-shaped.

---

## 8.2 Cards and Panels

Use shadcn `Card` for major content regions.

### App Patterns

- `PageHeader`: title, description, optional right-side actions.
- `SectionCard`: standard shadcn `Card`.
- `MetricCard`: small stat cards built on `Card`.
- `TablePanel`: card wrapper around toolbar + data table.
- `SettingsCard`: card wrapper around settings rows.
- `PlotPanel`: card wrapper around charts/visualizations.

### Card Rules

Do:

- Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.
- Use `bg-card`, `text-card-foreground`, `border-border`.
- Use consistent padding: `p-4`, `p-6`, `gap-4`.

Do not:

- Create page-local card shells with arbitrary borders/radii/shadows.
- Use different card styles for each page.

---

## 8.3 Forms

Use shadcn `Field`, `Label`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`.

### Form Rules

Do:

- Use `Field` or a consistent field wrapper for label/help/error.
- Use `text-muted-foreground` for help text.
- Use `border-input` for inputs.
- Use blue focus ring from `ring`.

Do not:

- Create custom form control visuals.
- Use hardcoded error reds; use `destructive`.
- Mix compact and large input sizing on the same page without reason.

---

## 8.4 Tables and Data Grids

Use shadcn `Table` and the shadcn Data Table pattern.

### Required Table Patterns

- Toolbar above table.
- Column visibility via dropdown.
- Filtering via input/select/popover.
- Pagination via shadcn `Pagination`.
- Row actions via `DropdownMenu`.
- Empty state via shadcn `Empty`.
- Loading via `Skeleton`.
- Bulk actions via `Button` + `Checkbox`.

### Analysis Dashboard Table Rules

For the Database and Inspect Damage pages:

- Use dense `text-sm` or `text-xs` where needed.
- Use `font-mono` for IDs and channel values.
- Keep thin channel columns compact.
- Use `Badge` for state labels.
- Use `DropdownMenu` for row actions.
- Use `Tooltip` for truncated channel names or technical metadata.
- Keep destructive row action visibly destructive only in dropdown/dialog confirmation.

---

## 8.5 Navigation and App Shell

Use shadcn `Sidebar`.

### Recommended Shell

Start from shadcn `dashboard-01`, `sidebar-07`, or `sidebar-03` patterns.

Required shell pieces:

- `SidebarProvider`
- `AppSidebar`
- `SidebarInset`
- `SiteHeader`
- `Breadcrumb`
- `SidebarTrigger`
- `Separator`
- `NavMain`
- `NavUser` if account/user actions exist

### Navigation Rules

Do:

- Use sidebar tokens: `sidebar-background`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`.
- Use standard shadcn sidebar sizing and collapsed behavior.
- Keep navigation labels and icons simple.
- Use Lucide icons consistently.

Do not:

- Build a completely custom sidebar unless shadcn Sidebar cannot satisfy the requirement.
- Use page-local nav item styles.
- Use chromatic active states.

---

## 8.6 Dialogs, Drawers, Sheets

Use shadcn `Dialog`, `AlertDialog`, `Drawer`, and `Sheet`.

### Dialog Rules

- Use `Dialog` for normal modals.
- Use `AlertDialog` for destructive confirmations.
- Use `Sheet` for side panels, filters, mobile drawers, and inspector panels.
- Use `Drawer` only where mobile-first bottom-sheet behavior is desired.

### Dialog Status Icons

- Status badge: `size-8`, `rounded-md` or `rounded-full` depending on shadcn primitive.
- Icon: Lucide `size-4`.
- Error/destructive states may use `text-destructive`.
- Do not use oversized icons inside compact dialogs.

---

## 8.7 Badges and Status

Use shadcn `Badge`.

### Status Rules

| State | Treatment |
|---|---|
| Ready / Calculated / Active | `Badge` default or secondary |
| Queued / Idle / Draft | `Badge variant="outline"` |
| Failed / Error | `Badge variant="destructive"` or text-destructive |
| Admin / Primary role | `Badge` default |
| Metadata IDs | `Badge variant="outline" className="font-mono"` |

Do not invent new color variants unless the app requires a documented semantic category.

---

## 8.8 Upload and Stepper Flows

Use shadcn.io File Upload, Stepper, Dialog, Progress, and Card patterns.

Upload flow should include:

1. Select files/folder.
2. Validate source structure.
3. Parse source data.
4. Preview metadata.
5. Import to database.
6. Show completion or failure.

Use:

- `Card` for step containers.
- `Progress` for step progress.
- `Badge` for step states.
- `AlertDialog` for cancel/delete.
- `Sonner` for completion toasts.
- `Skeleton` for loading.
- `ScrollArea` for logs/details.

---

## 8.9 Charts and Plots

Use shadcn Chart pattern where possible.

Rules:

- Chart colors are allowed only inside chart/plot components.
- UI chrome around charts stays zinc-neutral.
- Chart panels use `Card`.
- Chart legends use muted text and small labels.
- Use `Tooltip`/chart tooltip for values.
- 3D/Three.js visualizations should sit inside a shadcn `Card`/`ResizablePanel`/`Sheet` shell.

---

## 8.10 Empty, Error, Loading, and Notifications

Use:

- `Empty` for empty states.
- `Skeleton` for loading.
- `Spinner` for compact loading.
- `Progress` for long-running jobs.
- `Sonner` for notifications.
- `Alert` for inline error/warning/info.
- `AlertDialog` for destructive confirmations.

Rules:

- Use `destructive` for true errors.
- Use `muted` for neutral information.
- Do not create custom colored alert panels.

---

## 9. Layout Principles

### Dashboard Layout

Use a shadcn dashboard shell:

```text
SidebarProvider
  AppSidebar
  SidebarInset
    SiteHeader
    PageContent
```

### Content Layout

Use consistent spacing:

| Region | Tailwind direction |
|---|---|
| Page wrapper | `flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6` |
| Dashboard sections | `grid gap-4 md:grid-cols-*` |
| Cards | `Card` with `CardHeader` and `CardContent` |
| Toolbars | `flex flex-wrap items-center gap-2` |
| Tables | `rounded-md border` |
| Side panels | `Sheet`, `ResizablePanel`, or `Card` |

### Density

This is a data-heavy engineering app. It may be denser than a marketing site.

Do:

- Prefer compact card/table controls.
- Use `text-sm` and `text-xs` where appropriate.
- Keep filters and table actions in a toolbar.
- Use popovers/dropdowns to hide secondary controls.

Do not:

- Add huge whitespace that reduces engineering usability.
- Turn every screen into a marketing hero section.
- Use ornamental layouts where a table/form/card would be clearer.

---

## 10. Responsive Behavior

Use Tailwind breakpoints and shadcn responsive blocks.

| Breakpoint | Behavior |
|---|---|
| `<640px` | Stack content, hide dense secondary columns, use Sheet/Drawer for filters |
| `640–768px` | Two-column where simple, otherwise stacked |
| `768–1024px` | Sidebar may collapse; tables scroll horizontally |
| `1024–1280px` | Standard dashboard layout |
| `>1280px` | Wider grids, persistent inspector side panels |

### Mobile Rules

- Sidebar collapses or moves behind `Sheet`.
- Tables must horizontally scroll.
- Dense damage channel columns may collapse into expandable rows.
- Filters should move into a sheet/drawer.
- Primary action remains visible.

---

## 11. Do's and Don'ts

### Do

- Use shadcn/ui primitives first.
- Start from shadcn.io or shadcn/ui blocks for page-level layouts.
- Use the zinc token system from this document.
- Use system UI font stack.
- Use `rounded-md` / `rounded-sm`, not pill-first geometry.
- Use `Card`, `Table`, `Dialog`, `Sheet`, `Sidebar`, `Tabs`, `Badge`, `Button`, `Input`, `Select`, `DropdownMenu`, `Sonner`, `Skeleton`, and `Progress`.
- Use `destructive` only for delete/error.
- Keep chart colors inside chart components.
- Use app-level wrappers only to enforce repeated dashboard patterns.
- Keep copied blocks close to their original shadcn structure.

### Don't

- Do not create a parallel custom component library.
- Do not hardcode random hex colors in components.
- Do not use chart colors for normal UI.
- Do not use red except for destructive/error states.
- Do not use SF Pro Rounded or downloaded custom fonts.
- Do not make every interactive control pill-shaped.
- Do not create page-local one-off button/card/table styles.
- Do not bypass shadcn `Sidebar` for the app shell.
- Do not use custom modal/dropdown primitives when shadcn provides them.
- Do not over-style dense engineering screens.

---

## 12. App-Specific Canonical Components

Create thin wrappers around shadcn primitives only where repeated app patterns need consistency.

| App component | Base shadcn primitive |
|---|---|
| `AppPageHeader` | typography + `Button` |
| `AppSectionCard` | `Card` |
| `AppMetricCard` | `Card` |
| `AppTablePanel` | `Card` + `Table` |
| `AppTableToolbar` | `Button`, `Input`, `Select`, `DropdownMenu` |
| `AppStatusBadge` | `Badge` |
| `AppConfirmDeleteDialog` | `AlertDialog` |
| `AppUploadStepper` | `Card`, `Progress`, `Badge` |
| `AppProviderSettingsRow` | `Card`, `Switch`, `Badge` |
| `AppEmptyState` | `Empty` |
| `AppInspectorSheet` | `Sheet` or `Resizable` |
| `AppChartPanel` | `Card` + shadcn Chart pattern |
| `AppCommandSearch` | `Command` |

Rules:

- Wrappers should be thin and boring.
- Wrappers should not replace shadcn primitives.
- Wrappers should not introduce custom colors or styling outside this design system.
- Wrappers should exist to prevent page-local repeated styling.

---

## 13. Required Component Normalization Order

Implement in this order:

1. `globals.css` token replacement.
2. `components.json` verification: `style: "new-york"`, CSS variables enabled, neutral/zinc base.
3. shadcn primitive cleanup:
   - `button`
   - `badge`
   - `input`
   - `textarea`
   - `select`
   - `card`
   - `dialog`
   - `alert-dialog`
   - `dropdown-menu`
   - `popover`
   - `tabs`
   - `table`
   - `sidebar`
   - `sheet`
   - `sonner`
   - `progress`
   - `skeleton`
4. App shell from shadcn Dashboard/Sidebar block.
5. Database page table pattern.
6. Inspect Damage page table + chart + side panel pattern.
7. Upload workflow from File Upload/Stepper/Dialog patterns.
8. Settings/provider pages from Settings/Form blocks.
9. Remove page-local visual one-offs.
10. Add lint/grep guardrails.

---

## 14. shadcn Block Mapping for Analysis Dashboard

Use this as the coding-agent map when searching shadcn.io blocks.

| Analysis Dashboard feature | Search shadcn.io / shadcn/ui blocks for |
|---|---|
| Overall app shell | `dashboard`, `sidebar`, `data table`, `charts` |
| Sidebar layout | `sidebar-07`, `sidebar-03`, `collapsible sidebar` |
| Header/breadcrumb | `dashboard header`, `breadcrumb`, `site header` |
| Database page | `data table`, `tables`, `CRUD`, `filters` |
| Inspect Damage page | `dashboard`, `data table`, `charts`, `resizable`, `tabs` |
| 3D plot side panel | `resizable`, `sheet`, `dashboard charts` |
| Upload modal | `file upload`, `stepper`, `dialog`, `progress` |
| Provider settings | `settings`, `forms`, `account`, `billing` row patterns |
| Login page | `login-03`, `login-04`, auth/login blocks |
| Empty state | `empty state`, `skeleton`, `error` |
| Operations/jobs history | `timeline`, `changelog`, `notification`, `monitoring` |
| Command search | `command menu`, `search` |
| Delete confirmations | `dialog`, `alert dialog`, `error` |
| Notifications | `notification`, `sonner`, `toast` |

---

## 15. Agent Prompt Guide

### General Prompt

Use this when instructing a coding agent:

```text
Refactor this frontend to follow DESIGN.md. Maximize reuse of shadcn/ui primitives and shadcn.io blocks. Do not create custom visual components when an existing shadcn primitive/block can be adapted. Use the LightRAG-style zinc token system, system UI font stack, small-radius shadcn geometry, and red only for destructive/error states. Keep chart colors only inside chart/plot components.
```

### Component Prompt

```text
Update this component to use shadcn/ui primitives and DESIGN.md tokens. Replace hardcoded colors with bg-background, text-foreground, bg-card, bg-muted, text-muted-foreground, border-border, bg-primary, text-primary-foreground, and bg-destructive only where destructive. Preserve behavior and accessibility. Avoid custom CSS unless required.
```

### Page Prompt

```text
Refactor this page using shadcn block patterns before custom layout. Use Card for panels, Table/Data Table for dense tabular data, Sidebar shell where applicable, Dialog/AlertDialog for modals, Sheet/Resizable for side panels, Badge for status, and Sonner/Progress/Skeleton for feedback. Remove page-local one-off visual styles.
```

### Block Search Prompt

```text
Search shadcn.io blocks for a matching block before building this layout manually. Prefer dashboard, sidebar, data table, settings, form, file upload, stepper, dialog, empty state, notification, and chart blocks. Adapt the block to the app domain while keeping shadcn component structure.
```

---

## 16. Acceptance Checklist

A UI change is accepted only if:

- [ ] It uses shadcn/ui primitives where available.
- [ ] It starts from a shadcn block where a suitable block exists.
- [ ] It uses system UI font stack.
- [ ] It uses DESIGN.md CSS variables.
- [ ] It avoids hardcoded UI colors.
- [ ] It uses red only for destructive/error states.
- [ ] It keeps chart colors inside chart/plot components.
- [ ] It uses shadcn radius scale, not pill-everything geometry.
- [ ] It uses `Card`/`Table`/`Dialog`/`Sheet`/`Sidebar`/`Badge` instead of custom equivalents.
- [ ] It preserves accessibility: keyboard focus, labels, dialog semantics, ARIA where needed.
- [ ] It works in light mode.
- [ ] It does not break dark mode tokens.
- [ ] It does not introduce a parallel custom component system.
- [ ] It removes repeated page-local styling where a shared app wrapper exists.

---

## 17. Guardrail Searches

Run these searches during implementation.

### Hardcoded colors

```bash
grep -R "bg-\[#\|text-\[#\|border-\[#\|#[0-9a-fA-F]\{6\}" client/src
```

Allowed mostly in charts, not general UI.

### Non-token colors

```bash
grep -R "bg-blue\|bg-green\|bg-purple\|text-blue\|text-green\|text-purple" client/src
```

Allowed only when documented for chart/visualization.

### Custom destructive styling

```bash
grep -R "text-red\|bg-red\|border-red" client/src
```

Should usually become `destructive` variant or `text-destructive`.

### Over-customized radius

```bash
grep -R "rounded-\[.*px\]\|rounded-2xl\|rounded-3xl\|rounded-full" client/src
```

`rounded-full` is allowed for avatar/switch/radio/progress dots, not every button/input.

### One-off component shells

```bash
grep -R "shadow-\|backdrop-blur\|custom-card\|custom-button" client/src
```

Review all occurrences and replace with shadcn primitives unless justified.

---

## 18. Migration Summary From Previous Ollama Direction

The old design direction emphasized:

- Pure grayscale only.
- SF Pro Rounded display typography.
- Pill-shaped interactive elements.
- 12px container radius.
- Zero shadows.
- No semantic red.

The new design direction is:

- shadcn/Tailwind zinc palette.
- System UI typography.
- Small-radius shadcn geometry.
- Subtle shadcn shadows allowed for popovers/dialogs.
- Red allowed for destructive/error.
- Chart colors allowed inside charts only.
- Maximum reuse of shadcn/ui primitives and shadcn.io blocks.

This is a better fit for Analysis Dashboard because the app is a dense engineering/data application, not a sparse marketing homepage.
