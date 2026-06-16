# Coding Agent Prompt

Refactor the frontend to follow the updated `DESIGN.md`.

Requirements:

1. Maximize reuse of shadcn/ui primitives.
2. Search shadcn.io / shadcn/ui blocks before building page layouts manually.
3. Use LightRAG-style shadcn zinc tokens:
   - `--background: #ffffff`
   - `--foreground: #09090b`
   - `--muted: #f4f4f5`
   - `--muted-foreground: #71717a`
   - `--border: #e4e4e7`
   - `--primary: #18181b`
   - `--primary-foreground: #fafafa`
   - `--destructive: #ef4444`
4. Use system UI font stack. Do not download a custom font.
5. Use small shadcn radius. Do not make everything pill-shaped.
6. Use red only for destructive/error states.
7. Use chart colors only inside chart/plot/data visualization components.
8. Replace page-local visual styles with shadcn primitives or thin app wrappers.
9. Preserve behavior and accessibility.

Refactor order:

1. `client/src/app/globals.css`
2. `client/components.json`
3. `client/src/components/ui/*`
4. `client/src/components/layout/*`
5. `client/src/app/database/page.tsx`
6. `client/src/app/inspect-damage/page.tsx`
7. upload/settings/provider workflows
8. add grep/lint guardrails for visual drift
