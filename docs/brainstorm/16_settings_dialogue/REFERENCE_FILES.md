# Reference Files Index

Every file under `reference/` and why an implementer needs it.

---

## `reference/context-engine-ui/` — Visual source of truth

Copied from [`.references/context-engine-ui`](../../../.references/context-engine-ui).

### Core dialog

| File | Purpose |
|------|---------|
| `stores/settings-dialog-store.ts` | Lightweight open/route store — copy almost verbatim |
| `components/settings/SettingsDialog.tsx` | **Primary visual reference** — shell layout, overlay, nav, panel switching |
| `components/settings/panels/GeneralSettingsPanel.tsx` | General tab content pattern |
| `components/settings/panels/AccountSettingsPanel.tsx` | Account tab table + nested dialog styling (simpler than Dashboard) |

### Context Engine panels (visual reference only — do not ship in Dashboard v1)

| File | Purpose |
|------|---------|
| `components/settings/panels/KnowledgeGraphSettingsPanel.tsx` | "Flat header" panel style; neutral-200 bordered cards; custom radio rows |
| `components/settings/panels/AIModelSettingsPanel.tsx` | Provider card grid, credential accordion, document parser cards |
| `components/settings/panels/AIModelSettingsPanel.test.tsx` | Test patterns for provider panel interactions |
| `components/settings/panels/DocumentsSettingsPanel.tsx` | Admin document upload panel (not wired in dialog; styling reference) |

### Integration patterns

| File | Purpose |
|------|---------|
| `components/layout/AppSideRail.tsx` | `openSettingsDialog("general")` on Settings button click |
| `components/layout/AppSideRail.test.tsx` | Mock pattern for settings-dialog-store in sidebar tests |
| `app/providers.tsx` | Global `<SettingsDialog />` mount point |

### Supporting dependencies (for reading panel imports)

| File | Purpose |
|------|---------|
| `stores/auth-store.ts` | `selectIsAdmin`, `useAuthStore` used by panels |
| `types/user.ts` | `AdminUser`, `UserRole`, payload types |
| `lib/api/users.ts` | API client shape (Dashboard has equivalent at `client/src/lib/api/users.ts`) |
| `lib/utils.ts` | `errorMessage`, `cn` helpers |

### UI primitives (styling reference)

| File | Purpose |
|------|---------|
| `components/ui/button.tsx` | `size="icon-sm"` used by close button |
| `components/ui/dialog.tsx` | Nested dialog styling in Account panel |
| `components/ui/alert-dialog.tsx` | Delete confirmation |
| `components/ui/badge.tsx` | "You" badge on current user row |
| `components/ui/input.tsx` | Pill input styling |
| `components/ui/label.tsx` | Form labels in nested dialogs |
| `components/ui/select.tsx` | Role dropdown |
| `components/ui/table.tsx` | User table |
| `components/ui/dropdown-menu.tsx` | Row actions menu |
| `components/ui/card.tsx` | Provider/parser cards (reference only) |
| `components/ui/switch.tsx` | Not in reference Account panel; needed for Dashboard `can_write` |

### Design tokens

| File | Purpose |
|------|---------|
| `app/globals.css` | CSS variable values — compare with Dashboard `client/src/app/globals.css` (already aligned) |

---

## `reference/dashboard/` — Behavior source of truth

Snapshots of the **current Dashboard app** at package creation time.

| File | Purpose |
|------|---------|
| `client/src/app/settings/users/page.tsx` | **Full user-management logic to migrate** — `can_write`, password masking, change-my-password, New badge, markVisited |
| `client/src/components/layout/AppSidebar.tsx` | Current Settings link, pending dot, admin gating — edit target for Step 6 |
| `client/src/app/providers.tsx` | Current provider tree — edit target for Step 5 |

---

## Mapping: reference → Dashboard target

| Reference | Dashboard target |
|-----------|------------------|
| `stores/settings-dialog-store.ts` | `client/src/stores/settings-dialog-store.ts` |
| `components/settings/SettingsDialog.tsx` | `client/src/components/settings/SettingsDialog.tsx` |
| `components/settings/panels/GeneralSettingsPanel.tsx` | `client/src/components/settings/panels/GeneralSettingsPanel.tsx` |
| `panels/AccountSettingsPanel.tsx` + `dashboard/.../users/page.tsx` | `client/src/components/settings/panels/AccountSettingsPanel.tsx` |
| `app/providers.tsx` | `client/src/app/providers.tsx` |
| `AppSideRail.tsx` (button pattern) | `client/src/components/layout/AppSidebar.tsx` |

---

## Files intentionally excluded

| Path | Reason |
|------|--------|
| `lib/api/ai-settings.ts`, `knowledge-graph-admin.ts`, etc. | Context Engine backend — not in Dashboard |
| `public/openai_logo.svg`, `aws_logo_transparent.png` | Provider panel assets — out of scope |
| `components/settings/panels/DocumentsSettingsPanel.tsx` dependencies | Admin documents API — not in Dashboard |

---

## Refreshing references

If `.references/context-engine-ui` changes, re-copy:

```bash
REF=".references/context-engine-ui"
DEST="docs/brainstorm/16_settings_dialogue/reference/context-engine-ui"
cp "$REF/stores/settings-dialog-store.ts" "$DEST/stores/"
cp "$REF/components/settings/SettingsDialog.tsx" "$DEST/components/settings/"
# ... repeat for changed files
```

Update Dashboard snapshots similarly from `client/src/`.
