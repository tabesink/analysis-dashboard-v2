# Architecture Design: Database Source Truth, Transfer, and Damage Persistence

**Package:** `13_database_improvement`  
**Related PRD:** [prd.md](./prd.md)  
**Created:** 2026-06-09

---

## Current Architecture Baseline

The app currently centers on one DuckDB database file initialized at startup and exposed through `UnifiedStore`.

```text
FastAPI startup
  -> MigrationRunner
  -> UnifiedStore(data/dashboard.db)
  -> app.state.db
  -> routers/services through dependencies
```

Current upload storage:

```text
CSV/RSP upload
  -> parse/convert/validate
  -> channel map resolves plot columns
  -> dim_event
  -> dim_channel_map
  -> measurements_raw
  -> measurements_lttb
```

Important constraints from current code:

- `measurements_raw` is long format: `event_id`, `timestamp`, `channel_name`, `value`.
- The transformer extracts only unique column indices referenced by the channel map.
- `ingestion_artifacts` currently retains converted CSV artifacts mainly for pending channel-map setup and reprocessing.
- Admin export/import currently packages load-data Parquet files and intentionally excludes managed artifacts and target-local tables.
- Damage inspection reads series from `measurements_raw`, computes synchronously, and returns response rows without persisted run/result records.

## Target Architecture

The target model keeps DuckDB as the ledger and managed artifacts as the immutable file store.

```text
DATA_ROOT/
  dashboard.db
  artifacts/
    sources/
      <source_file_id>/
        original.<ext>
        canonical.csv
        channel_map_snapshot.json
        parser_manifest.json
        checksums.json
```

```text
DuckDB
  source metadata
  artifact metadata
  ingestion lineage
  cases/events
  canonical channels
  raw/canonical measurements
  damage profiles
  damage runs/results
  import/export audit
```

## Table Groups

### Source Truth Tables

```text
source_file
  source_file_id
  original_filename
  original_extension
  original_mime_type
  original_size_bytes
  original_sha256
  uploaded_by_user_id
  uploaded_at
  status

source_artifact
  artifact_id
  source_file_id
  artifact_type          -- original, canonical_csv, channel_map_snapshot, parser_manifest, parser_log
  artifact_uri           -- artifact://sources/<id>/original.rsp
  sha256
  size_bytes
  created_at
  created_by_user_id

ingestion_run
  ingestion_run_id
  source_file_id
  parser_name
  parser_version
  app_version
  status
  started_at
  completed_at
  row_count
  column_count
  warning_count
  error

event_source_link
  event_id
  source_file_id
  ingestion_run_id
  channel_map_snapshot_id
  created_at
```

### Case/Event Tables

```text
dim_case
  case_id
  program_id
  work_order
  job_number
  description
  created_by_user_id
  created_at
  updated_at

dim_event
  event_id
  case_id               -- nullable during migration, required for case-centric workflows later
  program_id
  version
  status
  source_file
  metadata...
```

The existing `program_id` and `version` remain important filters. `dim_case` adds the missing workflow object for "one case has many events."

### Canonical Channel Tables

```text
dim_channel
  channel_id
  channel_key           -- bj_x_force
  label                 -- BJ X Force
  component             -- ball_joint, shock, bushing_front, bushing_rear
  quantity              -- force, moment, displacement, acceleration
  axis                  -- x, y, z, scalar
  default_unit
  display_order
  is_damage_channel
  is_active

event_channel_map
  event_id
  channel_id
  source_column_index
  source_column_name
  source_unit
  scale_factor
  sign_convention
  channel_map_snapshot_id

channel_map_snapshot
  channel_map_snapshot_id
  program_id
  version
  snapshot_json
  snapshot_sha256
  created_by_user_id
  created_at
```

Plot maps should remain visualization concerns. Damage and engineering analysis should resolve through `dim_channel` and `event_channel_map`.

### Measurement Tables

Near-term compatible path:

```text
measurements_raw
  event_id
  timestamp
  channel_name
  value
```

Target path:

```text
measurements_raw
  event_id
  channel_id
  sample_index
  timestamp
  value
```

Optional full-source recovery path:

```text
source_measurement_column
  source_file_id
  source_column_index
  source_column_name
  source_unit
  inferred_type

measurements_source_raw
  source_file_id
  sample_index
  timestamp
  source_column_index
  value
```

If full-source normalized storage becomes too large, keep the source artifact immutable and store full raw source signals as Parquet files referenced by `source_artifact`.

### Damage Tables

```text
damage_profile
  profile_id
  name
  material
  method                -- py_fatigue, FKM, nCode-equivalent, etc.
  settings_json         -- SN curves, binning, units, method parameters
  settings_sha256
  is_default
  created_by_user_id
  created_at

damage_run
  run_id
  profile_id
  requested_by_user_id
  event_selection_hash
  input_lineage_hash
  status
  created_at
  started_at
  completed_at
  error

damage_result
  run_id
  event_id
  channel_id
  source_file_id
  channel_map_snapshot_id
  damage
  status
  error
  created_at
```

Result validity should be based on a stable hash of:

- Damage profile settings.
- Event IDs.
- Source file checksums.
- Channel-map snapshot checksums.
- Parser/app calculation version.

## Artifact URI Contract

Artifact URIs are portable and resolved at runtime:

```text
artifact://sources/src_abc123/original.rsp
artifact://sources/src_abc123/canonical.csv
artifact://sources/src_abc123/channel_map_snapshot.json
artifact://sources/src_abc123/parser_manifest.json
```

Runtime resolution:

```text
artifact://sources/src_abc123/original.rsp
  -> DATA_ROOT / artifacts / sources / src_abc123 / original.rsp
```

Rules:

- Store artifact URIs, not absolute file paths.
- Reject path traversal, null bytes, and unknown URI schemes.
- Treat artifacts as immutable once linked to an ingestion run.
- Never overwrite an artifact in place; create a new artifact/version.
- Store and verify SHA-256 checksums.

## Project Package Format

Recommended export structure:

```text
analysis_project_export.zip
  manifest.json
  database/
    dashboard.db                 -- full-backup mode, optional
    tables/                      -- project-export mode, Parquet tables
      dim_event.parquet
      source_file.parquet
      source_artifact.parquet
      ingestion_run.parquet
      event_source_link.parquet
      dim_channel.parquet
      event_channel_map.parquet
      damage_profile.parquet
      damage_run.parquet
      damage_result.parquet
  artifacts/
    sources/
      <source_file_id>/
        original.rsp
        canonical.csv
        channel_map_snapshot.json
        parser_manifest.json
  export_report.json
```

Example manifest:

```json
{
  "package_type": "analysis_dashboard_project_export",
  "package_version": "1.0",
  "created_at": "2026-06-09T00:00:00Z",
  "app_version": "1.3.7",
  "schema_version": 1,
  "export_mode": "project",
  "database": {
    "format": "parquet_tables",
    "tables_path": "database/tables"
  },
  "artifacts": [
    {
      "source_file_id": "src_abc123",
      "artifact_type": "original",
      "relative_path": "artifacts/sources/src_abc123/original.rsp",
      "sha256": "..."
    }
  ]
}
```

## Import Validation Rules

Reject or block activation when:

- `manifest.json` is missing or invalid.
- Required source tables are missing.
- A database record references a source artifact absent from the package.
- A package artifact checksum does not match the manifest.
- A package uses an unsupported package type.
- A package was produced by a newer incompatible app/schema version.
- Any artifact path escapes the package root.
- Unknown artifact types appear without an explicit compatibility strategy.

Warn when:

- Optional derived data such as LTTB or damage results is absent but rebuildable.
- Package app version is older and requires migrations.
- Package excludes local app state such as sessions or user preferences.

## Export Modes

### Project Export

Moves engineering project data:

- Source truth and artifacts.
- Programs/cases/events.
- Canonical channels.
- Measurements.
- Damage profiles/runs/results.
- Optional saved analysis views if product decides they belong to the project.

Excludes target-local operational state:

- Sessions.
- Password hashes.
- Runtime task records.
- Local admin settings, unless explicitly selected.

### Full Backup

Moves the whole app state for disaster recovery:

- DuckDB snapshot.
- Artifacts.
- Users and admin configuration.
- Audit logs.
- Sessions if desired.

This mode should be admin-only and clearly labeled as a backup/restore operation, not a collaboration package.

## Runtime Flow Changes

### Upload

```text
receive upload
  -> write original source artifact
  -> compute source SHA-256
  -> parse/convert
  -> write canonical artifact if conversion occurred
  -> write parser manifest
  -> create ingestion_run
  -> snapshot channel map
  -> create/update event
  -> create event_source_link
  -> write canonical measurements
  -> write LTTB
  -> invalidate caches
```

### Damage

```text
POST /damage/runs or /damage/inspect
  -> normalize event selection
  -> resolve active damage profile
  -> compute input_lineage_hash
  -> find valid existing result rows
  -> create damage_run for missing/stale work
  -> compute from canonical raw measurements
  -> persist damage_result rows
  -> return current result set
```

### Export

```text
admin starts export
  -> checkpoint database
  -> collect project table rows
  -> collect referenced artifacts
  -> write manifest with checksums
  -> zip package
  -> log export
```

### Import As New Project

```text
admin uploads package
  -> validate package structure
  -> verify checksums
  -> create staging database/project
  -> copy artifacts to staging artifact store
  -> rewrite portable artifact URIs only if package version requires it
  -> run schema migrations
  -> show preview
  -> admin makes active
```

## Migration Strategy

1. Add source tables without changing existing upload behavior.
2. Begin writing source artifacts for all new uploads.
3. Backfill `source_file` and `event_source_link` best-effort for existing events using `dim_event.source_file` and `file_hash`; mark lineage as partial when original bytes are unavailable.
4. Keep legacy `ingestion_artifacts` readable during transition.
5. Add canonical channel tables and bridge from existing `dim_channel_map`.
6. Add damage tables and populate only for new runs.
7. Introduce project-package export/import alongside current load-data export/import.
8. Deprecate load-data-only export only after project export is stable.

## Key Risks

| Risk | Mitigation |
|------|------------|
| Artifact path traversal | Use artifact URI resolver with strict scheme/root validation |
| Huge storage growth | Store original artifacts plus canonical engineering channels first; evaluate full-source Parquet as optional |
| Import corrupts active DB | Import as new project/database first; keep staging and explicit activation |
| Stale damage results | Use input lineage hashes and profile settings hashes |
| Existing exports break | Keep legacy load-data export/import until project package mode is proven |
| Schema migration complexity | Add tables first, backfill partial lineage, avoid destructive column changes |
| Multi-user write conflicts | Reuse ownership checks, audit log, cache invalidation, and task progress patterns |
