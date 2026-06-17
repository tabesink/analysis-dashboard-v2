# LightRAG / shadcn DESIGN.md Package

This package replaces the earlier Ollama-inspired `DESIGN.md` with a LightRAG WebUI-style shadcn/zinc design system.

## Files

- `DESIGN.md` — the modified design system document to copy into the repo.
- `SHADCN_BLOCK_MAPPING.md` — quick reference for which shadcn/shadcn.io block families to use by app feature.
- `IMPLEMENTATION_PROMPT.md` — prompt to give coding agents.
- `CLIENT_COMPONENT_AUDIT.md` — full inventory of client visual components classified as shadcn native, shadcn-io, custom, or hybrid; drift patterns and Phase 38 rollout risks.
- `CLIENT_TYPOGRAPHY_AUDIT.md` — font stacks, type scale, weights, line height, monospace usage, and typography drift vs `DESIGN.md` §5; mapped to UI38 issues.

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


## CRITICAL

For this development phase AVOID modifying dashboard and damage plot cards (these cards are customized so take care NOT to modify these cards)

Make surgical and clean modifications to attempt to standardize / elevate the UIUX quality of this app