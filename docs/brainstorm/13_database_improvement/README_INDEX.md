# 13 - Database Improvement Roadmap

Brainstorm package for evolving the dashboard database from a plot-oriented upload store into a portable engineering analysis project store.

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Product requirements for source-of-truth artifacts, project transfer, canonical channels, damage persistence, and database management |
| [architecture-design.md](./architecture-design.md) | Proposed target data model, artifact package format, runtime flows, and table groups |
| [implementation-plan.md](./implementation-plan.md) | Phased implementation roadmap with `DB-13-XX` task slices, dependencies, and verification |
| [design-grill.md](./design-grill.md) | Decision-tree questions and assumptions to resolve before coding high-risk schema/runtime changes |

## Why This Exists

The current app is strong for upload, filtering, plotting, admin portability, and early damage inspection. The next product step is different: engineers need an auditable source-of-truth archive that can reproduce calculations, transfer complete projects between machines, and support persisted damage analysis across cases, events, and canonical engineering channels.

## Current-State Summary

The active runtime store is one DuckDB file at `data/dashboard.db`. The schema is declared in `server/schema.yaml` and summarized in `docs/database-schema.txt`.

Today:

- Successful uploads are transformed into event metadata, plot channel maps, raw long-format measurements, and LTTB plot data.
- Pending channel-map uploads retain converted CSV artifacts under the managed channel-map artifact folder.
- Export/import is admin-only and load-data oriented; managed artifacts are intentionally excluded from the current Parquet ZIP.
- Damage inspection computes synchronously from `measurements_raw` and returns results to the UI, but does not persist calculation runs or results.
- Raw measurements are extracted from plot channel maps, so unmapped source columns are not guaranteed to be present in `measurements_raw`.

## Target Direction

Move from:

```text
uploaded files -> events -> plot maps -> measurements -> UI calculations
```

to:

```text
source artifacts -> ingestion runs -> cases -> events -> canonical channels
  -> raw/canonical measurements -> calculation profiles -> damage runs/results
  -> portable project package
```

## Recommended Reading Order

1. Start with [prd.md](./prd.md) for product scope and user stories.
2. Read [architecture-design.md](./architecture-design.md) for the target model and package format.
3. Use [design-grill.md](./design-grill.md) to resolve open decisions with humans.
4. Hand [implementation-plan.md](./implementation-plan.md) to coding agents once the decision tree is resolved.
