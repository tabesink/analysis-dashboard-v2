# 14 — Lean Source-of-Truth Database Improvement (V2)

Brainstorm package for implementing a lean source-of-truth ingestion model with explicit lineage from original upload artifacts to derived data.

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Product requirements and implementation/testing decisions |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | Start-here instructions for coding agents |
| [issues/](./issues/) | AFK/HITL vertical-slice implementation issues |

## Execution summary

| Phase | Focus | Key issues |
|-------|-------|------------|
| 0 | Data model + artifact contracts | DB14-01, DB14-02 |
| 1 | Channel map snapshots + event previews | DB14-03, DB14-04 |
| 2 | Derived data lineage + stale handling | DB14-05 |
| 3 | Durability schedule attachments | DB14-06 |
| 4 | Transfer package + validation | DB14-07 |
| 5 | End-to-end regression coverage | DB14-08 |

## Quick start

1. Read [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).
2. Pick one unblocked issue from [`issues/`](./issues/).
3. Implement only that slice and verify against acceptance criteria.
