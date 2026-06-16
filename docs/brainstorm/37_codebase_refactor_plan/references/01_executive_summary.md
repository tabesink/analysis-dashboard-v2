# 01 — Executive Summary

## Overall assessment

`analysis-dashboard-v2` is correctly shaped as a lightweight local-network modular monolith. The stack is appropriate for the product: FastAPI backend, DuckDB persistence, and Next.js frontend. The architecture should not be overcorrected into microservices or a heavyweight distributed system.

The upload area is the main place where production complexity is accumulating. It currently mixes HTTP parsing, file validation, upload task orchestration, ingestion, derived-data triggers, dataset lifecycle behavior, and DB portability concerns too closely.

## Target direction

Refactor upload into four lanes plus DB portability:

1. **Folder upload** — CSV/RSP load histories into canonical raw data.
2. **Channel map upload** — YAML map into channel assignments and LTTB reprocess.
3. **Schedule upload** — durability schedule into schedule rows and damage calculation.
4. **DB import** — Parquet ZIP restore/replace flow. `DEVELOPER NOTES: remove db import; we do not need this now since we can create new databases and connect them`
5. **DB export** — mirror portability flow.

## Primary architecture objective

Keep the same public endpoints and lane boundaries, but make each workflow independently understandable and testable. This is a lean modular monolith; the refactor should deepen the existing modules before adding new architectural layers.

## Top 5 recommendations

1. Use TDD tracer bullets for the first wave: one behavior test, one minimal change, then refactor while green.
2. Extract small pure policy helpers for upload lane rules, especially “one batch = CSV or RSP, never both.”
3. Keep `IngestionService`, `ExportService`, `DamageCalculationTaskService`, and `UnifiedStore` as the production services until a narrower interface proves useful.
4. Harden the current write boundaries: folder upload should require write/admin permission, and successful DB import should not leave stale runtime query cache entries.
5. Keep task infrastructure incremental: shared task-kind constants and stale-task reconciliation first; defer a generic task runner and upload file staging to later reliability slices.

## What not to do

- Do not replace DuckDB prematurely.
- Do not rewrite the entire app in one pass.
- Do not introduce Celery/RQ/Redis unless in-process execution becomes a proven bottleneck.
- Do not let `POST /damage/inspect` mutate data. The explicit write-user backfill command may remain as a visible repair path.
- Do not merge DB import/export into folder upload. It is a separate portability lane.
- Do not add broad ports/adapters/repositories just to satisfy a clean-architecture diagram.
