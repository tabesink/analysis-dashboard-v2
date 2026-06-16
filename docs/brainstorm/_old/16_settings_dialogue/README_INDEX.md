# 16 — Settings Dialog (Visual Parity Package)

Brainstorm package for replacing the `/settings/users` full-page route with a **modal settings dialog** that matches the visual language of the Context Engine UI reference.

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Product requirements, scope, and locked decisions |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | Start-here instructions for coding agents |
| [VISUAL_SPEC.md](./VISUAL_SPEC.md) | Layout, tokens, and class-level visual parity checklist |
| [STEP_BY_STEP.md](./STEP_BY_STEP.md) | Implementation checklist with file touch list |
| [REFERENCE_FILES.md](./REFERENCE_FILES.md) | Index of every file in `reference/` and why it matters |
| [reference/](./reference/) | Local copies of reference + current Dashboard sources |

## What this package is for

The Dashboard app already has a working **admin settings page** at `/settings/users` (P12). The Context Engine UI reference app uses a **two-column modal dialog** opened from the sidebar instead of navigating to a route.

This package gives a junior dev or coding agent everything needed to:

1. Recreate the **dialog shell** (sidebar nav + scrollable panel area) with matching visual parity.
2. **Embed** the existing user-management logic into an Account panel.
3. Wire the sidebar Settings icon to **open the dialog** instead of routing to `/settings/users`.
4. Preserve existing behavior: admin-only access, pending-user notification dot, `markVisited` clearing.

## What is out of scope (for now)

- Knowledge Graph and Providers panels from the reference app (Context Engine–specific).
- New backend endpoints — reuse existing `usersApi` and auth store.
- Non-admin settings routes (read-only users still see a disabled sidebar icon).

## Quick start

1. Read [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).
2. Open [VISUAL_SPEC.md](./VISUAL_SPEC.md) and compare against the reference `SettingsDialog.tsx`.
3. Follow [STEP_BY_STEP.md](./STEP_BY_STEP.md) in order.
4. Use files under `reference/context-engine-ui/` as the **visual source of truth**.
5. Use files under `reference/dashboard/` as the **behavior source of truth** to migrate.

## Reference source

Canonical reference codebase: [`.references/context-engine-ui`](../../../.references/context-engine-ui)

Local copies for offline agent work: [`reference/context-engine-ui/`](./reference/context-engine-ui/)
