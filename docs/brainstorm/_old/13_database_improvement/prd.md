# PRD: Database Improvement for Source-of-Truth Engineering Projects

**Feature area:** Database, ingestion, source artifacts, portability, damage inspection  
**Iteration:** Roadmap / architecture PRD  
**Last updated:** 2026-06-09

---

## Problem Statement

The dashboard currently stores processed upload data well enough for filtering, plotting, and early damage inspection, but it does not yet treat uploaded files as immutable engineering sources of truth. Successful uploads can be reduced to the mapped channels needed by plot definitions, while retained artifacts are mainly tied to pending channel-map workflows. This creates risk for future 21-channel damage analysis, auditability, recalculation, and transfer between machines.

Engineers need to prove where a result came from: the exact uploaded file bytes, parser/conversion version, channel-map snapshot, source column lineage, calculation profile, and resulting damage values. Admins also need transfer workflows that move complete analysis projects, not only processed load-data tables.

The current database portability feature is admin-only and useful, but it is closer to load-data backup/restore than a project/database manager. It exports/imports Parquet ZIP load data and intentionally excludes managed artifacts and local app state. That model is not enough once original files, canonical channel mappings, and persisted damage results become first-class project data.

## Solution

Evolve the database model into a portable engineering project store.

The app should keep the DuckDB file as the tabular ledger for metadata, lineage, source hashes, canonical channels, calculation profiles, and results. Large source artifacts should live in a managed artifact store under `DATA_ROOT`, referenced by portable artifact URIs and verified by checksums. Export/import should become a project package format that includes both the database data and the source artifacts required to reproduce calculations.

The target model introduces:

- Immutable source-file and source-artifact records for every uploaded file, successful or pending.
- Ingestion-run records linking uploaded bytes to parsed/canonical data, events, channel-map snapshots, and parser manifests.
- A first-class case/event model for workflows where one case contains many events.
- Canonical engineering channels decoupled from visualization plot maps.
- Damage profiles, damage runs, and persisted damage results with reproducibility metadata.
- Project-package export/import that includes database tables, artifacts, manifests, and checksums.
- A future database manager that can import as a new named database/project instead of immediately replacing the live database.

## User Stories

1. As an engineer, I want every uploaded CSV/RSP file preserved as an immutable source artifact, so that I can prove which file produced an event.
2. As an engineer, I want the app to store a SHA-256 checksum for each source artifact, so that transferred or restored data can be verified.
3. As an engineer, I want converted canonical CSV files retained when RSP files are converted, so that parser output can be inspected without rerunning conversion.
4. As an engineer, I want parser manifests stored for each ingestion, so that row counts, column counts, parser version, warnings, and units are auditable.
5. As an engineer, I want the exact channel map used during ingestion snapshotted, so that later edits to the active map do not change historical lineage.
6. As an engineer, I want an event to link back to its source file and ingestion run, so that metadata, channels, and measurements are traceable.
7. As an engineer, I want all future damage calculations to record which source data and channel-map snapshot they used, so that results are reproducible.
8. As an engineer, I want canonical engineering channels independent from plot definitions, so that damage analysis is not coupled to dashboard visualization configuration.
9. As an engineer, I want a 21-channel damage model supported by canonical channel metadata, so that damage tables can expand beyond the current plot-derived 12 channels.
10. As an engineer, I want source columns to remain recoverable even if they were not used by the original plot map, so that future calculations can use newly mapped channels.
11. As an engineer, I want damage results persisted by calculation run, event, and channel, so that large selections do not require repeated synchronous recalculation.
12. As an engineer, I want damage profiles stored in the database, so that SN curves, material assumptions, units, binning, and method versions are explicit.
13. As an engineer, I want to compare damage runs produced by different profiles, so that material or method changes are reviewable.
14. As an engineer, I want stale damage results identified when source data, channel mappings, or profiles change, so that I do not trust obsolete results.
15. As a writer, I want successful uploads and pending channel-map uploads to follow the same source-artifact lifecycle, so that one path is not less auditable than the other.
16. As a writer, I want duplicate uploads detected by full source checksum, so that accidental re-ingestion can be prevented or clearly handled.
17. As an admin, I want export packages to include source artifacts and manifests, so that another machine can reproduce the project.
18. As an admin, I want import validation to verify artifact checksums before activation, so that corrupted transfer packages are rejected.
19. As an admin, I want import validation to report missing artifacts, unknown artifact types, incompatible schema versions, and newer app versions, so that I can make an informed decision.
20. As an admin, I want artifact paths stored as portable URIs instead of host-specific absolute paths, so that exports can move between Linux, Windows, containers, and future deployments.
21. As an admin, I want to import a project package as a new named database/project, so that importing does not immediately destroy the active dataset.
22. As an admin, I want to see the active database/project name, size, event count, source artifact count, and schema version, so that database state is obvious.
23. As an admin, I want to clone the current database/project, so that I can test imports or recalculations without risking production data.
24. As an admin, I want a blank database/project creation flow, so that separate durability programs can start cleanly.
25. As an admin, I want rollback or backup visibility before any destructive replace, so that accidental replacement can be recovered.
26. As an auditor, I want import/export events logged with package checksum, user, timestamp, and result, so that transfers are traceable.
27. As a developer, I want source artifact storage encapsulated behind a small service, so that ingestion, export, and damage code do not build paths directly.
28. As a developer, I want schema changes implemented as small, testable migrations, so that production database evolution is controlled.
29. As a developer, I want transfer package validation tested independently from the UI, so that corrupted packages are rejected deterministically.
30. As a developer, I want damage calculation moved toward background runs, so that long calculations do not block request/response paths.
31. As a QA engineer, I want fixture exports with artifacts, checksums, and damage results, so that round-trip portability can be regression-tested.
32. As a product owner, I want the database roadmap split into phases, so that source truth, transfer, channel taxonomy, and damage persistence can ship incrementally.

## Implementation Decisions

### Source artifacts are stored outside DuckDB

The DuckDB database should store metadata, hashes, portable URIs, lineage, and validation state. The original uploaded files, converted canonical files, channel-map snapshots, parser manifests, and logs should be stored in a managed artifact folder or future object store.

Do not store large source files as DuckDB blobs by default. This keeps the database smaller, keeps artifacts inspectable, and makes future backup/object-storage strategies easier.

### Portable artifact URIs are the storage contract

Database records should use stable portable URIs such as:

```text
artifact://sources/<source_file_id>/original.rsp
artifact://sources/<source_file_id>/canonical.csv
artifact://sources/<source_file_id>/channel_map_snapshot.json
artifact://sources/<source_file_id>/parser_manifest.json
```

The runtime resolves these URIs relative to `DATA_ROOT`. Absolute host paths must not be treated as durable truth.

### Upload lineage becomes explicit

Introduce records equivalent to:

- `source_file`
- `source_artifact`
- `ingestion_run`
- `event_source_link`
- `channel_map_snapshot`

Each successfully ingested event should point back to an ingestion run and source file. Pending channel-map uploads should use the same source artifact model instead of a separate retained-artifact-only concept.

### Canonical engineering channels are separate from plot maps

Plot maps can remain for dashboard visualization, but damage analysis should use canonical engineering channel definitions. A canonical channel should capture component, quantity, axis, default unit, display order, sign convention, and source-column mapping.

### Full source recoverability is mandatory

The app should always preserve original uploaded bytes. For canonical measurements, the preferred model is to persist all engineering channels needed by analysis while keeping the source artifact available for future reprocessing. If storage is acceptable, persist all source columns in a normalized raw-column table or Parquet signal store as well.

### Damage results become first-class records

Persist damage profiles, runs, and results. The current `/damage/inspect` behavior can remain as a compatibility path during transition, but the target flow is:

```text
select events -> find valid results -> create/reuse damage run -> compute missing work -> persist -> return results
```

### Transfer becomes project-package based

The export/import contract should move from load-data-only Parquet ZIP toward a package containing:

- Manifest and package metadata.
- Database tables or DuckDB snapshot, depending on selected mode.
- Source artifacts.
- Channel-map snapshots and parser manifests.
- Checksums for every packaged item.
- Optional derived data such as LTTB data and damage results.

### Multi-database management is a future layer

Do not let admins directly upload arbitrary `.db` files and switch to them. Prefer package import as a new named database/project, validate it, preview it, then allow an explicit "Make Active" action.

## Testing Decisions

### What makes a good test

Tests should verify externally visible behavior and durable contracts: source files are retained, hashes match, event lineage is recoverable, export packages contain required artifacts, imports reject corruption, and damage results can be reproduced from stored lineage. Avoid tests that assert private helper names or incidental folder formatting beyond the documented URI/package contract.

### Modules to test

| Area | Expected coverage |
|------|-------------------|
| Source artifact service | Writes immutable artifacts, computes checksums, resolves portable URIs, rejects unsafe paths |
| Ingestion service | Stores source artifacts for successful and pending uploads; links events to source lineage |
| Schema/migrations | Adds source, channel, case, and damage tables idempotently; upgrades existing databases |
| Export/import service | Packages artifacts, validates manifest, verifies checksums, rejects missing/corrupt artifacts |
| Damage services | Reuses valid persisted results; marks stale/missing results; records profile/run/result metadata |
| Admin database UI/API | Shows active project info; imports as new project; prevents accidental destructive replacement |

### Prior art

Build on existing server tests around ingestion artifacts, export/import preservation, admin route guards, damage query service behavior, and upload task progress. The existing tests already prove that current export excludes managed artifacts; new tests should intentionally change that expectation for the new project-package mode while keeping legacy load-data export behavior if it remains supported.

## Out of Scope

- Migrating from DuckDB to Postgres.
- Supporting arbitrary direct `.db` uploads as a primary admin workflow.
- Building a cloud object-storage backend in the first implementation phase.
- Implementing every possible fatigue method immediately.
- Replacing dashboard plot rendering or LTTB storage.
- Full horizontal scaling of concurrent writers.
- Reprocessing all historical datasets automatically without an explicit migration/backfill plan.

## Further Notes

This roadmap should be implemented in phases. The first durable win is source-of-truth artifact storage for every upload. The next is project-package transfer that carries those artifacts. Canonical channels and persisted damage runs should follow before the 21-channel damage workflow spreads plot-derived assumptions deeper into the UI and API.

Human decisions still needed before coding are captured in [design-grill.md](./design-grill.md).
