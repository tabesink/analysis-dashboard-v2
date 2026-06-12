# LightRAG / shadcn DESIGN.md Package

This package replaces the earlier Ollama-inspired `DESIGN.md` with a LightRAG WebUI-style shadcn/zinc design system.

## Files

- `DESIGN.md` — the modified design system document to copy into the repo.
- `SHADCN_BLOCK_MAPPING.md` — quick reference for which shadcn/shadcn.io block families to use by app feature.
- `IMPLEMENTATION_PROMPT.md` — prompt to give coding agents.

## Intended repo destination

Copy `DESIGN.md` to the root of:

```text
analysis-dashboard-v2/DESIGN.md
```

Then instruct coding agents to update:

```text
client/src/app/globals.css
client/components.json
client/src/components/ui/*
client/src/components/layout/*
client/src/app/database/page.tsx
client/src/app/inspect-damage/page.tsx
client/src/app/settings/*
client/src/components/upload/*
```

## Core decision

Use shadcn/ui and shadcn.io blocks as the default implementation path. Do not build custom UI from scratch unless no suitable shadcn primitive/block exists.
