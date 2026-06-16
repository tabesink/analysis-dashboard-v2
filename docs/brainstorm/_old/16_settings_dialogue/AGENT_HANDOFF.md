# Agent Handoff — Settings Dialog

**Read this first.** Scope and decisions: [prd.md](./prd.md)

---

## Your mission

Implement the **settings modal dialog** with visual parity to the Context Engine UI reference. Migrate existing Dashboard user-management behavior into the Account panel. Do not add Context Engine–specific panels (Knowledge Graph, Providers).

---

## Quick start checklist

```
[ ] 1. Read prd.md, VISUAL_SPEC.md, and this handoff
[ ] 2. Study reference/context-engine-ui/components/settings/SettingsDialog.tsx
[ ] 3. Study reference/dashboard/client/src/app/settings/users/page.tsx (behavior to preserve)
[ ] 4. Create branch: settings-dialog-modal
[ ] 5. Follow STEP_BY_STEP.md in order
[ ] 6. Verify visual parity against VISUAL_SPEC.md checklist
[ ] 7. Run client tests + build
```

---

## File creation order (recommended)

| Step | Action | Target path |
|------|--------|-------------|
| 1 | Copy store | `client/src/stores/settings-dialog-store.ts` |
| 2 | Create dialog shell | `client/src/components/settings/SettingsDialog.tsx` |
| 3 | Create General panel | `client/src/components/settings/panels/GeneralSettingsPanel.tsx` |
| 4 | Extract Account panel | `client/src/components/settings/panels/AccountSettingsPanel.tsx` |
| 5 | Mount globally | `client/src/app/providers.tsx` |
| 6 | Wire sidebar | `client/src/components/layout/AppSidebar.tsx` |
| 7 | Handle legacy route | `client/src/app/settings/users/page.tsx` (redirect or thin wrapper) |

---

## Visual parity — non-negotiables

Copy these class strings **verbatim** from `reference/context-engine-ui/components/settings/SettingsDialog.tsx`:

- Overlay classes
- Content container size/position classes
- `grid-cols-[180px_1fr]` layout
- Aside border/padding
- Nav button active/inactive classes
- Close button styling

Do **not** substitute shadcn `<Dialog>` for the shell — the reference uses `@radix-ui/react-dialog` primitives directly for precise class control.

---

## Behavior parity — non-negotiables

From `reference/dashboard/client/src/components/layout/AppSidebar.tsx`:

- Admin-only: non-admins see disabled Settings control
- Pending-user red dot on Settings icon
- `usersApi.markVisited()` + `setPendingCount(0)` when admin opens settings
- All CRUD from current users page: role, `can_write`, masked password, reset, delete, change-my-password

---

## Verification commands

```bash
cd client && npm test
cd client && npm run build
```

Manual checks:

1. Admin clicks Settings → dialog opens on General panel (no route change).
2. Click Account in left nav → user table appears with all P12 columns.
3. Create user, reset password, toggle write access — all work.
4. Close dialog (X or overlay) → returns to previous page unchanged.
5. Non-admin: Settings icon disabled, no dialog.

---

## Rules of engagement

1. **Shell from reference, logic from Dashboard** — do not drop `can_write` or password features.
2. **No scope creep** — no KG/Providers panels in v1.
3. **Surgical diff** — only touch files listed in STEP_BY_STEP.md unless a missing export forces a barrel update.
4. **Match existing conventions** — Dashboard uses mixed quote styles; match the file you edit.
5. **No new backend routes** — frontend-only unless you find a blocking gap.

---

## When done

- Append `docs/decisions/log.md` if you chose redirect vs delete for `/settings/users`.
- Add `docs/tasks/P16-01.md` implementation notes if non-trivial.
- Update `docs/master-build-plan.md` with a P16 task row if one exists or create Phase 16 entry.
- Add `CHANGELOG.md` entry under `[Unreleased]` when feature ships.

---

*Last updated: 2026-06-09*
