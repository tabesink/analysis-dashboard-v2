# PRD: Settings Dialog (Modal, Context Engine Visual Parity)

**Feature area:** Admin settings UX, layout shell  
**Iteration:** Brainstorm / implementation package  
**Last updated:** 2026-06-09

---

## Problem Statement

Dashboard admins reach user management via a full-page route (`/settings/users`). The Context Engine UI reference uses a **modal settings dialog** with a left nav rail and right content panel — a more compact pattern that keeps users in context.

The existing Dashboard settings page works functionally (P12) but does not match the reference dialog's layout, navigation model, or visual treatment (overlay blur, 180px sidebar, flat vs bordered headers).

## Solution

Replace route-based admin settings navigation with a **global modal dialog**:

1. **Dialog shell** — fixed-size centered modal (`~980×720px`), frosted overlay, left nav (180px) + scrollable content panel.
2. **Routes inside dialog** — at minimum:
   - **General** — account summary card with CTA to Account panel.
   - **Account** — embedded user management (migrate from `/settings/users`).
3. **Sidebar integration** — Settings icon opens dialog (`openSettingsDialog("general")`) instead of `<Link href="/settings/users">`.
4. **Global mount** — render `<SettingsDialog />` in `providers.tsx` alongside layout children.
5. **State store** — lightweight external store (`settings-dialog-store.ts`) for open/route state.

## User Stories

1. As an admin, I want to open settings from the sidebar without leaving my current page.
2. As an admin, I want a familiar two-column settings layout matching Context Engine UI.
3. As an admin, I want the same user-management capabilities I have today (create, reset password, role, write access, delete, change my password).
4. As an admin, I want the pending-user notification dot to clear when I open settings (same as today).
5. As a non-admin, I want the Settings icon to remain disabled with the existing tooltip.

## Locked-in Decisions

| Decision | Choice |
|----------|--------|
| Dialog vs route | Modal dialog is primary; `/settings/users` may redirect to dashboard or open dialog (agent choice — prefer redirect + dialog) |
| Panel scope (v1) | General + Account only |
| Reference panels excluded | Knowledge Graph, Providers, Documents (Context Engine–specific) |
| Auth gating | Unchanged — admin-only for Account panel; General visible to all signed-in users |
| Store pattern | `useSyncExternalStore` lightweight store (match reference, no new Zustand store) |
| Radix primitive | `@radix-ui/react-dialog` primitives directly in `SettingsDialog` (match reference overlay/content classes) |
| Styling tokens | CSS variables (`--background`, `--border`, `--secondary`, etc.) — already aligned in Dashboard `globals.css` |
| Account panel source | Migrate logic from `client/src/app/settings/users/page.tsx`, not from reference `AccountSettingsPanel` wholesale (Dashboard has `can_write`, password masking, change-my-password card) |

## Visual Parity Requirements

See [VISUAL_SPEC.md](./VISUAL_SPEC.md). Summary:

- Overlay: `bg-white/70 backdrop-blur-[1px]`
- Content: `rounded-xl border shadow-sm`, `grid-cols-[180px_1fr]`
- Nav buttons: `rounded-lg px-2.5 py-2`, active = `bg-[var(--secondary)]`
- Close button: ghost icon-sm, rounded-full, top of left aside
- Content header: bordered bottom for General/Account; flat header optional for future panels
- Account panel inputs: `rounded-full` pill inputs (reference Account panel) OR retain Dashboard monochrome table styling inside the dialog content area

**Acceptance:** side-by-side screenshot comparison with reference dialog at 1280×800 should show matching shell geometry and nav styling. Panel content may differ (Dashboard-specific columns).

## Implementation Decisions

- Extract user-management JSX from `settings/users/page.tsx` into `AccountSettingsPanel.tsx` with `embedded` prop.
- Add `settings-dialog-store.ts` mirroring reference API: `openSettingsDialog`, `closeSettingsDialog`, `setSettingsDialogRoute`, `setSettingsDialogOpen`.
- Mount dialog in `client/src/app/providers.tsx`.
- Update `AppSidebar.tsx`: replace Settings `<Link>` with `<button onClick={() => openSettingsDialog("general")}>`, keep notification dot + `markVisited` on open.
- Optional: keep `/settings/users` as a thin redirect that calls `openSettingsDialog("account")` for bookmark compatibility.

## Testing Decisions

- Component test: dialog opens when sidebar Settings clicked (admin).
- Component test: non-admin Settings button remains disabled.
- Component test: route switching between General and Account updates header title.
- Existing server tests for user CRUD remain unchanged.
- Manual: pending-user dot clears on open; create/reset/delete flows still work inside dialog.

## Out of Scope

- Knowledge Graph domain management panel.
- AI provider / document parser settings panel.
- Settings for non-admin users (beyond General summary card).
- Mobile-specific settings layout (desktop modal is sufficient for v1).

## Dependencies

- P12 admin settings + permissions (DONE) — `usersApi`, auth store, sidebar gating.
- P13 template patterns (DONE) — reference file copy approach.
- Context Engine UI reference at `.references/context-engine-ui`.

## Further Notes

The reference `AccountSettingsPanel` is **simpler** than Dashboard's current page (no `can_write` toggle, no change-my-password card, no masked password column). The implementation should use the reference for **shell styling** and the Dashboard page for **business logic**.
