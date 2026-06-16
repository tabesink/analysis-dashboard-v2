# Step-by-Step Implementation Checklist

Follow in order. Each step lists the reference file to copy from and the Dashboard target path.

---

## Prerequisites

- [ ] Read [prd.md](./prd.md) and [VISUAL_SPEC.md](./VISUAL_SPEC.md)
- [ ] Confirm `@radix-ui/react-dialog` is installed (`client/package.json` — already used by shadcn dialog)
- [ ] Confirm lucide icons available (`Settings`, `UserRound`, `X`, `ShieldCheck`)

---

## Step 1 — Settings dialog store

**Copy from:** `reference/context-engine-ui/stores/settings-dialog-store.ts`  
**Create:** `client/src/stores/settings-dialog-store.ts`

Dashboard v1 routes type:

```ts
export type SettingsRoute = "general" | "account";
```

Remove `"knowledge-graph"` and `"provider"` from the union.

**Export from** `client/src/stores/index.ts` if the project uses a barrel (optional).

**Verify:** `openSettingsDialog("account")` sets `{ isOpen: true, route: "account" }`.

---

## Step 2 — Settings dialog shell

**Copy from:** `reference/context-engine-ui/components/settings/SettingsDialog.tsx`  
**Create:** `client/src/components/settings/SettingsDialog.tsx`

Adaptations:

1. `ROUTES` array — only `general` and `account` entries.
2. Remove `useFlatHeader` branches for KG/provider (always bordered header in v1).
3. Remove imports for `KnowledgeGraphSettingsPanel`, `AIModelSettingsPanel`.
4. Import `GeneralSettingsPanel` and `AccountSettingsPanel` from local panels folder.
5. Filter `allowedRoutes`: hide `account` for non-admin OR show it with gate card inside panel (reference shows account nav to all but gates content — **prefer hiding account nav for non-admin** to match Dashboard admin-only settings).

**Verify:** Dialog renders when `isOpen` is true; nav switches panels.

---

## Step 3 — General panel

**Copy from:** `reference/context-engine-ui/components/settings/panels/GeneralSettingsPanel.tsx`  
**Create:** `client/src/components/settings/panels/GeneralSettingsPanel.tsx`

Minimal changes — uses `useAuthStore` and `setSettingsDialogRoute("account")`.

For non-admin users, hide "Open account" button or disable with tooltip "Admin only".

---

## Step 4 — Account panel (migrate logic)

**Source of behavior:** `reference/dashboard/client/src/app/settings/users/page.tsx`  
**Visual hints:** `reference/context-engine-ui/components/settings/panels/AccountSettingsPanel.tsx`

**Create:** `client/src/components/settings/panels/AccountSettingsPanel.tsx`

Migration approach:

1. Copy the entire page component body into `AccountSettingsPanel({ embedded = false })`.
2. Remove `useRouter` redirect — replace with inline admin gate card (like reference).
3. Remove page-level layout wrappers (`Card` page chrome) — keep table + dialogs.
4. Keep Dashboard-specific features:
   - `can_write` toggle column
   - Masked password column + reset
   - Change-my-password card (place above user table)
   - `lastVisitAt` / "New" badge for self-registered users
5. Call `usersApi.markVisited()` when panel mounts (admin only), not only on sidebar click.
6. Apply reference class constants for nested dialogs:
   - `inputClassName = "rounded-full border-[var(--border)] bg-[var(--background)] shadow-none"`
   - `pillButtonClassName = "rounded-full shadow-none"`

**Verify:** All P12 user-management flows work inside the dialog.

---

## Step 5 — Mount dialog globally

**Reference:** `reference/context-engine-ui/app/providers.tsx`  
**Edit:** `client/src/app/providers.tsx`

Add:

```tsx
import { SettingsDialog } from "@/components/settings/SettingsDialog";
```

Inside the provider return, after `{children}`:

```tsx
<SettingsDialog />
```

Place inside `ClientLayout` wrapper (sibling to children) so dialog has access to auth state.

**Verify:** Dialog available on every authenticated page.

---

## Step 6 — Wire sidebar Settings icon

**Reference:** `reference/context-engine-ui/components/layout/AppSideRail.tsx` (button pattern)  
**Edit:** `client/src/components/layout/AppSidebar.tsx`

Changes:

1. Import `openSettingsDialog`, `useSettingsDialogStore` from settings-dialog-store.
2. Read `settingsOpen = useSettingsDialogStore((s) => s.isOpen)`.
3. Replace admin Settings `<Link href="/settings/users">` with:

```tsx
<button
  type="button"
  onClick={() => {
    void usersApi.markVisited().catch(() => undefined).finally(() => setPendingCount(0));
    openSettingsDialog("general");
  }}
  ...
>
```

4. Update `isActive` to `settingsOpen || settingsActive` for admin.
5. Keep non-admin disabled button unchanged.

**Verify:** Clicking Settings opens dialog; URL does not change to `/settings/users`.

---

## Step 7 — Legacy route handling

**Edit:** `client/src/app/settings/users/page.tsx`

Option A (recommended): thin client redirect

```tsx
"use client";
import { useEffect } from "react";
import { openSettingsDialog } from "@/stores/settings-dialog-store";
import { useRouter } from "next/navigation";

export default function SettingsUsersRedirect() {
  const router = useRouter();
  useEffect(() => {
    openSettingsDialog("account");
    router.replace("/dashboard");
  }, [router]);
  return null;
}
```

Option B: delete route and accept broken bookmarks (not recommended).

**Verify:** Navigating to `/settings/users` opens Account panel then lands on dashboard.

---

## Step 8 — Tests (minimal)

**Reference:** `reference/context-engine-ui/components/layout/AppSideRail.test.tsx`

Add `client/src/components/settings/SettingsDialog.test.tsx`:

- Renders nothing when closed
- Shows General panel when open
- Switches to Account on nav click
- Hides Account nav for non-admin (if implemented)

Add sidebar test update if `AppSidebar.test.tsx` exists.

---

## Step 9 — Final verification

```bash
cd client && npm test
cd client && npm run build
```

Manual smoke test checklist:

- [ ] Admin: open settings, create user, delete user
- [ ] Admin: pending dot clears on open
- [ ] Admin: change my password
- [ ] Non-admin: settings disabled
- [ ] Dialog closes on X and overlay click
- [ ] Visual check per VISUAL_SPEC.md

---

## Files touched summary

| Action | Path |
|--------|------|
| Create | `client/src/stores/settings-dialog-store.ts` |
| Create | `client/src/components/settings/SettingsDialog.tsx` |
| Create | `client/src/components/settings/panels/GeneralSettingsPanel.tsx` |
| Create | `client/src/components/settings/panels/AccountSettingsPanel.tsx` |
| Edit | `client/src/app/providers.tsx` |
| Edit | `client/src/components/layout/AppSidebar.tsx` |
| Edit | `client/src/app/settings/users/page.tsx` |
| Create (optional) | `client/src/components/settings/SettingsDialog.test.tsx` |
