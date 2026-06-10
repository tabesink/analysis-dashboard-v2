# PRD: Lean Source-of-Truth Database Improvement

**Feature area:** Database, upload ingestion, channel maps, event previews, durability schedules, portability  
**Iteration:** V2 lean first-release scope  
**Last updated:** 2026-06-09

---

## Problem Statement

The dashboard accepts CSV and RSP uploads, transforms selected channel data into measurement rows, and creates LTTB data for plotting. It also supports channel maps either from uploaded YAML or from the client UI. This is useful, but the current model does not make the uploaded raw data lifecycle explicit enough.

The product needs a low-entropy design where every uploaded raw data file has one clear source of truth, while all other stored data is understood as derived. Engineers and admins should be able to answer: what exact file was uploaded, what channel map was used, what preview was shown for each event, what LTTB rows were generated for plotting, and what durability schedule was attached to the program/version.

Without this, future damage inspection, transfer, debugging, and audit workflows will depend on partially reconstructed context. The risk is not only missing files; it is conceptual drift where original uploads, canonical CSVs, measurements, LTTB rows, channel maps, and schedules are all treated as competing sources of truth.

## Solution

Introduce a lean source-of-truth ingestion model:

1. Store the exact original CSV or RSP upload as the immutable source artifact.
2. For RSP uploads, derive a canonical CSV artifact used by the same downstream processing path as CSV uploads.
3. Normalize uploaded YAML channel maps and client-UI-authored channel maps into the same channel-map snapshot model.
4. Link each event to the channel-map snapshot used when its measurement rows and LTTB rows were derived.
5. Store a lightweight CSV preview for each event, derived from the canonical CSV, not a second full CSV copy in DuckDB.
6. Continue creating LTTB data as derived plot data for fast dashboard rendering.
7. Allow one active durability schedule attachment per program/version, stored as a managed artifact with checksum and parse/preview metadata.
8. Ensure transfer/export includes the source artifacts, channel-map snapshots, event previews, durability schedule artifacts, and the derived data needed for immediate use.

This iteration intentionally avoids a large database-platform redesign. It should not introduce multi-database switching, persisted damage runs, a case model, or a full canonical 21-channel registry as first-release requirements. Those remain compatible future phases.

## User Stories

1. As a writer, I want to upload a CSV file and have the exact uploaded bytes retained, so that the file remains the source of truth for the resulting event.
2. As a writer, I want to upload an RSP file and have the exact uploaded bytes retained, so that conversion does not erase the original source.
3. As a writer, I want RSP uploads to produce a canonical CSV artifact, so that CSV and RSP uploads can share one downstream ingestion path.
4. As an engineer, I want the original upload identified separately from derived canonical CSV data, so that I never confuse converted data with the source of truth.
5. As an engineer, I want every source artifact to have a checksum, so that imports, exports, and audits can verify that the source has not changed.
6. As an engineer, I want every event to link to its source artifact, so that I can trace event data back to the exact uploaded file.
7. As an engineer, I want every event to link to the ingestion run that produced it, so that parser/conversion details are auditable.
8. As an engineer, I want every event to have a lightweight CSV preview, so that I can inspect headers, units, first rows, row counts, and warnings without loading the full file.
9. As an engineer, I want event previews derived from canonical CSV data, so that CSV and RSP previews behave consistently.
10. As an engineer, I want event previews to be stored as lightweight metadata, so that the database does not duplicate full uploaded files.
11. As an engineer, I want measurement rows derived from canonical CSV plus the selected channel-map snapshot, so that data lineage is explicit.
12. As an engineer, I want LTTB rows derived from measurement data or the canonical CSV processing path, so that plotting stays fast but remains clearly derived.
13. As an engineer, I want LTTB rows treated as plot data only, so that engineering calculations do not accidentally use downsampled values as authoritative data.
14. As a writer, I want to upload a channel map as YAML, so that existing file-based workflows remain supported.
15. As a writer, I want to define or edit a channel map in the client UI, so that I can recover from missing or incorrect maps without editing YAML manually.
16. As a writer, I want uploaded YAML maps and UI-defined maps to normalize into the same channel-map snapshot model, so that the system does not maintain two competing map formats.
17. As an engineer, I want a program/version to have one active channel-map snapshot for new ingestion, so that current behavior is easy to understand.
18. As an engineer, I want each event to retain the channel-map snapshot used during ingestion, so that later channel-map edits do not rewrite history.
19. As an engineer, I want channel-map snapshots to record whether they came from uploaded YAML or the UI, so that authoring provenance is visible without changing the runtime model.
20. As an engineer, I want derived measurement rows and LTTB rows to be marked stale or regenerated when the active channel-map snapshot changes for pending/reprocessed events, so that visualizations do not silently mix incompatible mappings.
21. As a writer, I want each program/version to allow one active durability schedule attachment, so that schedules align with the metadata editing scope.
22. As a writer, I want durability schedules attachable by users with write access or admins, so that schedule setup does not require admin-only intervention.
23. As an admin, I want durability schedule attachments to store checksum and parse/preview metadata, so that imported or replaced schedules are auditable.
24. As an engineer, I want an event to inherit the active durability schedule from its program/version, so that schedule context is available without per-event duplication.
25. As an engineer, I want replacing a version schedule to be explicit, so that users understand which schedule is active for the version.
26. As an admin, I want exports to include original source artifacts, canonical CSV artifacts, channel-map snapshots, event previews, and version schedules, so that transferred data remains usable and auditable.
27. As an admin, I want imports to verify checksums for source and schedule artifacts, so that corrupted packages are rejected before use.
28. As an admin, I want imports to validate that database records do not reference missing artifacts, so that transferred datasets are complete.
29. As a developer, I want source artifact writes encapsulated in a small storage service, so that upload code does not hand-build artifact paths.
30. As a developer, I want channel-map normalization encapsulated in a small service, so that YAML and UI map inputs converge before storage.
31. As a developer, I want event preview generation encapsulated in a small service, so that preview behavior is consistent across CSV and RSP uploads.
32. As a developer, I want durability schedule parsing and storage encapsulated in a small service, so that schedule attachments do not complicate event ingestion.
33. As a QA engineer, I want round-trip tests for CSV uploads, so that source artifact, preview, measurements, LTTB, and transfer behavior are covered.
34. As a QA engineer, I want round-trip tests for RSP uploads, so that original RSP and canonical CSV artifacts are both preserved.
35. As a QA engineer, I want tests for YAML and UI-authored channel maps producing equivalent snapshots, so that both authoring paths stay aligned.
36. As a product owner, I want the first release kept lean, so that source truth, preview, plotting, channel-map lineage, and version schedules can ship before larger damage-analysis persistence work.

## Implementation Decisions

### Original uploads are the only source of truth

The exact uploaded CSV or RSP bytes are the source of truth. They are stored as immutable managed artifacts and referenced from database lineage records.

Canonical CSV is derived data. For CSV uploads, the canonical CSV may be the same logical tabular content as the original. For RSP uploads, it is the normalized converted representation used by parsing, preview generation, measurement derivation, and LTTB generation.

### Store artifacts outside DuckDB

Large files should remain in a managed artifact store under the configured data root. DuckDB stores artifact metadata, checksums, portable artifact URIs, lineage, preview metadata, and relationships.

This avoids bloating the database with full file contents while still making the database the ledger of what exists and how it was used.

### Use portable artifact URIs

Artifact records should use portable URIs resolved relative to the runtime data root. Absolute local paths should not be durable database truth.

The storage model should distinguish artifact types such as original upload, canonical CSV, channel-map snapshot, event preview metadata, durability schedule, and parser manifest.

### Normalize channel maps into snapshots

Uploaded YAML channel maps and client-UI-authored channel maps are authoring methods. After validation, both produce the same normalized channel-map snapshot.

The first release should support one active channel-map snapshot per program/version for new ingestion. Each event records the snapshot used to derive its measurement rows and LTTB rows. Later edits create or replace the active snapshot for future work without changing historical event lineage.

### Measurement rows are derived data

Measurement rows are derived from canonical CSV plus the channel-map snapshot used at ingestion time. They remain useful full-resolution data for querying and analysis, but they are not the original source artifact.

The PRD does not require storing every original source column as normalized database rows in the first release. The lean requirement is that every original source file is retained and reprocessable.

### LTTB rows are plotting data

LTTB rows are derived data for fast plotting. They should be generated during ingestion or reprocessing as they are today, but the model should document that LTTB rows are not authoritative engineering input.

### Event preview is lightweight derived metadata

Each event should have a preview generated from canonical CSV data. The preview should include enough information for the UI and debugging, such as headers, units when available, first rows, row count, column count, parser warnings, and source artifact references.

The preview should not duplicate the full source file in DuckDB.

### Durability schedules are version-scoped

Each program/version can have one active durability schedule attachment. The schedule is stored as a managed artifact with checksum and parse/preview metadata. Events inherit schedule context from their program/version.

The first release does not require per-event schedule overrides or schedule version history. Replacement can be explicit and auditable without exposing a full version manager.

### Transfer includes source truth and derived usability data

The transfer package should include the original source artifacts, canonical CSV artifacts, channel-map snapshots, event previews, durability schedule artifacts, measurements, LTTB rows, and manifest/checksum metadata required to validate the package.

Legacy load-data export/import can remain during transition, but the lean source-truth export should be the target for this feature.

### Larger platform work is deferred

The following are compatible future phases, not first-release requirements:

- Multi-database or project manager UI.
- Runtime database switching.
- Case modeling.
- Canonical 21-channel engineering taxonomy.
- Persisted damage profiles, damage runs, and damage results.
- Full source-column normalized storage for every uploaded column.

## Testing Decisions

### What makes a good test

Good tests should assert durable behavior and user-visible contracts: artifacts are retained, checksums are correct, event lineage is recoverable, previews are generated, LTTB rows are created, channel-map authoring paths normalize to the same snapshot shape, schedules attach at program/version scope, and transfer packages reject missing or corrupted artifacts.

Tests should avoid checking incidental private helper names or exact folder implementation details beyond the documented artifact URI contract.

### Modules to test

| Area | Tests |
|------|-------|
| Source artifact storage | Stores original CSV and RSP bytes immutably; computes checksum; rejects unsafe artifact paths |
| Canonical CSV derivation | Produces canonical CSV for RSP; keeps CSV and RSP downstream processing consistent |
| Channel-map normalization | Uploaded YAML and UI-authored maps validate into equivalent snapshots; each event links to the snapshot used |
| Ingestion lineage | Event links to source artifact, canonical CSV artifact, ingestion run, channel-map snapshot, measurements, and LTTB rows |
| Event preview generation | Preview exists for each event; preview is lightweight; preview includes headers/units/first rows/counts/warnings |
| LTTB generation | LTTB rows are created after ingestion and remain distinct from source truth and full-resolution measurements |
| Durability schedules | One active schedule attaches to program/version; replacement is explicit; write/admin permissions are enforced |
| Transfer package | Export includes artifacts and manifest; import verifies checksums; missing artifact references fail validation |

### Prior art

Use existing ingestion tests for pending channel-map artifacts, upload status, RSP conversion, and dataset deletion as starting points. Use existing export/import service tests for package validation and preserved-table behavior. Use existing dashboard/channel-map tests to verify that uploaded maps and UI-authored maps remain compatible.

## Out of Scope

- Persisted fatigue damage runs and damage result tables.
- Full canonical 21-channel damage taxonomy.
- Multi-database creation, switching, or project manager UI.
- Direct upload of arbitrary DuckDB `.db` files.
- Storing large source file bytes directly in DuckDB.
- Full normalized storage of every source column in the first release.
- Per-event durability schedule overrides.
- Schedule attachment history UI.
- Migration or reconciliation of historical events whose original source files are no longer available.

## Further Notes

The guiding rule for this version is: one source of truth, many derived views.

For upload data, the source of truth is always the exact original CSV or RSP upload. Canonical CSV, measurement rows, LTTB rows, event previews, and any future damage calculations are derived from that source plus the channel-map snapshot used for ingestion.

For channel maps, YAML upload and UI definition are authoring paths, not separate long-term concepts. After validation, they become the same normalized channel-map snapshot.

For durability schedules, the first-release model is intentionally simple: one active schedule per program/version. This matches the metadata editing scope and avoids per-event schedule complexity until a real workflow requires it.
