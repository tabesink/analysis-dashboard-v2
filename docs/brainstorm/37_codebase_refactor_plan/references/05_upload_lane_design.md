# 05 — Upload Lane Design

## Lane 1 — Folder upload / canonicalization

### Purpose

Ingest load histories into canonical raw data.

### Files

- `.csv`
- `.rsp`
- optional `channel_map.yaml` or `channel_map.yml`

### Rule

One batch may contain CSV or RSP files, never both.

Folder upload is a write path and should require write/admin permission.

### Owns

- source file bytes in the current implementation
- source file staging in a later reliability slice
- RSP to CSV conversion
- source validation
- `measurements_raw`
- ingestion artifacts
- event records
- upload task progress
- `pending_channel_map`

### Does not own

- damage calculation
- channel reprocess after explicit channel map save
- durability schedule assignment
- DB import/export

### Server phases

```text
upload_received → converting → validating → writing → completed/failed
```

### Client phases

```text
uploading → validating → processing → completed/failed
```
`DEVELOPER NOTES: would the intented code modification handle early cancelation during upload? Does it fail gracefully incase backend services become unavailable? What about status polling and reporting to user that is uploading, currently I observe on the upload dialogue inaccurate completion status percentage reporting; i observe non-sequential task completion cases where polling would report on a downstream task and then start reporting on an upstream task and flip-flop between these - is it possible to ensure sequential upload / damage related task completion percentage reporting?`
---

## Lane 2 — Channel map upload / channel reprocess

### Purpose

Map raw columns into domain channels and regenerate plot-ready derived data.

### Files

- `channel_map.yaml`
- `channel_map.yml`

### Owns

- channel map validation
- `dim_channel_map`
- lineage/versioning of channel assignments
- `measurements_lttb`
- `channel_reprocess` task
- contributor edit policy for users who own part of the program/version scope

### Does not own

- damage calculation
- schedule persistence
- raw load history ingestion

---

## Lane 3 — Schedule upload / damage calculation

### Purpose

Persist durability schedule rows and trigger damage calculation when prerequisites are ready.

### Owns

- schedule rows
- pattern/repeats/weight/multiplier/RSP event mapping
- `damage_calculation` task
- `event_channel_damage`
- stale/current/error state of calculated damage
- contributor edit policy for users who own part of the program/version scope

### Formula

```text
scheduled_damage = base_damage × repeats × weight × multiplier
```

### Does not own

- raw measurements
- channel assignment
- DB import/export

---

## Lane 4 — DB import `DEVELOPER NOTES: we're going to remove this capability since admins can now export an existing database and can connect to it (remove this capability since it is somewhat redundant now)`

### Purpose

Restore or replace a whole DuckDB state from a Parquet ZIP.

### Files

- Parquet ZIP

### Owns

- ZIP validation
- import preview
- admin confirmation
- background DB import task
- DB swap/replace semantics
- runtime query-cache clearing after successful import

### Does not own

- event-level ingestion
- channel map upload
- schedule upload

---

## Mirror lane — DB export

### Purpose

Create a portable Parquet ZIP snapshot.

### Owns

- background export task
- export artifact
- download endpoint
- admin progress wizard

---

## Task kinds

```text
folder_upload
channel_reprocess
damage_calculation
database_import
database_export
```

The current `upload_tasks.task_kind` can remain the shared task table for folder and derived tasks. Application code should treat each kind as a separate workflow. DB import/export may keep their existing export-service task model until a concrete need appears.

## Inspect Damage boundary

`POST /damage/inspect` is a read model. It reads persisted `event_channel_damage` rows and must not calculate, repair, or backfill as a side effect of the read.

`POST /damage/backfill` is a separate write-user repair command. It may start or reuse a `damage_calculation` task when prerequisites allow it. This keeps repair visible and preserves the current workflow-order recovery path without making reads mutate data.

## Scope ownership policies

Do not collapse all program/version authorization into one generic rule:

- channel-map and schedule edits use contributor edit semantics
- scope delete uses exclusive-owner-or-admin semantics
- DB import/export remain admin portability operations
