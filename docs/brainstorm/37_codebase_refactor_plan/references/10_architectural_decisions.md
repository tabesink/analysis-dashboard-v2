# 10 — Architectural Decisions to Document

## ADR 1 — Upload lanes and ownership

Document that upload is split into:

1. Folder upload
2. Channel map upload
3. Schedule upload
4. DB import
5. DB export

Each lane has different ownership and task semantics.

Folder upload is a write path and should require write/admin permission.

## ADR 2 — Folder upload creates canonical raw data only

Folder upload owns `measurements_raw` and ingestion artifacts. It should not calculate damage directly.

## ADR 3 — Channel map triggers channel reprocess only

Channel map upload/save writes channel assignment lineage and plot-ready derived data. It does not calculate damage.

## ADR 4 — Schedule triggers damage only when prerequisites are ready

Schedule upload/save writes schedule rows and starts `damage_calculation` only if channel prerequisites are current.

## ADR 5 — Inspect Damage is read-only

`POST /damage/inspect` reads `event_channel_damage`. It should not silently compute, repair, or backfill during a read request.

`POST /damage/backfill` remains a separate explicit write-user repair command. It may start or reuse `damage_calculation` when prerequisites allow it.

## ADR 6 — DuckDB remains the primary local store

DuckDB is kept because the app is a local-network engineering dashboard. Migration to Postgres should require a concrete need for multi-process writes, higher concurrency, or remote collaborative access.

## ADR 7 — Background work remains in-process for now

In-process background work remains acceptable for the current deployment model. The first refactor wave should add task-kind constants and stale-task reconciliation before introducing a bounded shared runner. External queues should be introduced only when reliability or concurrency requirements justify them.

## ADR 8 — DB import/export is whole-database portability

DB import/export is not an event-level upload. It is an admin portability workflow that validates, previews, confirms, and swaps/restores database state.

## ADR 9 — Upload staging is filesystem-backed

Large upload files may later be streamed to a scratch directory and cleaned by task lifecycle rules. This is a deferred reliability feature, not a first-wave prerequisite.

## ADR 10 — Frontend follows the same lane model

`/database` owns folder upload and DB portability. Edit Metadata owns channel map and schedule workflows. Progress UI should reflect task kind explicitly.

## ADR 11 — Lean vertical extraction over full clean architecture

The first refactor wave should use TDD tracer bullets, pure policy helpers, and small orchestration functions around existing services. Do not create broad ports/adapters/repository scaffolding until a concrete behavior test proves that the current boundary blocks safe change.

## ADR 12 — Scope ownership policies remain distinct

Channel-map and schedule edits use contributor edit semantics. Program/version scope delete uses exclusive-owner-or-admin semantics. DB import/export are admin portability operations. Preserve these as named policies rather than collapsing them into one generic scope rule.
