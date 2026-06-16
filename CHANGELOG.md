## [Unreleased]

### Added
- Shared per-event channel resolver and header provider for derived-data readers: plot mappings resolve lookup channel names from each event's stored preview headers (with ingestion artifact `#TITLES` fallback) instead of duplicating ingestion-only header parsing (IDM-28-01).

### Changed
- Inspect Damage 2D damage-plot legends now use a shared right-side vertical overlay with larger text, transparent background, and no border chrome; absolute-by-event cards show all event legend rows (scrollable) and prefer derived RSP event names when available.
- Folder-upload lane rules are now centralized in a pure server policy contract (`server/upload/policies.py`) used by `POST /api/v1/upload/folder/start`: CSV/RSP exclusivity, optional `channel_map.yaml`/`channel_map.yml` companion detection from folder selections, stable upload task/phase names, and explicit unsupported-file handling semantics are now test-covered (REF37-02).
- Client folder-upload preflight now uses shared upload-policy helpers for selected-file classification and metadata payload mapping across side-panel display and submit handling; lightweight validation/info feedback (missing metadata, mixed CSV/RSP rejection, no uploadable files, ignored unrelated files) now flows through the app toast system with focused helper tests (REF37-03).
- Folder-upload operation progress now renders backend folder phases directly in stable order (`upload_received`, `converting`, `validating`, `writing`), ignores non-folder downstream task updates during polling, keeps transient connection-loss details in the upload dialog, and shows explicit completed/failed/cancelled terminal summaries while toasts are limited to high-level lifecycle outcomes (REF37-04).
- Uploaded-data permission semantics are now wired through named server policy helpers (`has_contributor_edit_uploaded_data_policy`, `has_uploaded_data_admin_policy`, `has_scope_delete_uploaded_data_policy`) across channel-map, schedule, and scope-delete routes, with explicit role-behavior regression coverage for contributor-owner, non-owner contributor, and admin paths (REF37-06).
- Database import has been removed from the active product surface: import UI controls are no longer offered in Database settings, and database import upload/start/cancel endpoints now return `410 Gone` with guidance to use database export plus create/connect workflow instead (REF37-07).
- Database export and database create/connect/delete now operate as one explicit admin-only database-administration lane: list/connect routes now enforce admin access, settings copy distinguishes whole-database administration from folder upload, and export lifecycle uses toast feedback for start/cancel/failure/completion while keeping detailed progress/download status in the operation dialog (REF37-08).
- Upload/derived task-kind names are now centralized in shared server constants, and startup reconciliation now terminalizes stale active upload/derived task rows (`queued`/`running` -> `failed/failed`) so restarted servers do not leave misleading in-flight task state or block one-active-derived-task-per-scope reuse checks (REF37-09).
- Upload task polling/SSE payloads now include minimal structured observability fields (`task_owner_user_id`, `task_kind`, `scope`, `terminal_state`, `result_summary`, `error_details`) while keeping existing status/phase/progress/result fields backward-compatible (REF37-12).
- Inspect Damage 2D plot row now shows only **Cumulative by channel** and **Target Δ vs Reference** in a two-column layout with larger cards; the cumulative-by-program/version card was removed. The focused 3D plot now expands to fill all remaining main-panel height below the 2D cards.
- Inspect Damage Reference/Target sidepanel selections now enforce one `program_id/version` scope per side: same-scope multi-select still works, cross-scope picks replace that side with the new scope, and users get explicit toast feedback when replacement occurs (PU-35-01).
- Inspect Damage now renders a sidepanel `Plot Inputs` section below `Target Load Data`; channel selection and value mode are sidepanel-owned comparison controls (with one-channel minimum enforcement), and the 3D overlay rail no longer owns those controls (PU-35-02).
- Inspect Damage now applies damage scaling through a shared `applyDamageScale` transform utility and renders a subtle in-plot `Normal`/`Log` toggle in the focused 3D surface instead of the overlay rail (PU-35-04).
- Inspect Damage now includes a pure cumulative-by-channel 2D plot-spec builder that reads comparison aggregates, applies channel filtering plus absolute/normalized and linear/log transforms, and emits stable Reference/Target grouped-series specs with legend/empty-state metadata (PU-35-05).
- Inspect Damage now includes a cumulative-by-channel 2D grouped-bar renderer card (`CumulativeByChannelPlotCard`) that renders Reference/Target grouped SVG bars in shared card chrome with semantic legend labels, native hover tooltip content, and accessible per-bar labels plus empty/loading/error shell states (PU-35-06).
- Inspect Damage plot area now renders a 2×2 2D card grid plus one focused 3D card: cumulative-by-channel uses the real 2D renderer, other plot types show placeholder cards until later slices, clicking a 2D card switches focused 3D plot type, and the legacy overlay plot rail is removed from the plot surface (PU-35-07).
- Inspect Damage now renders `absolute_by_event` as a real 2D heatmap card: selected Reference/Target events and selected channels drive cell generation, value mode and Normal/Log scale are applied through the shared spec path, tooltips expose event/program-version/channel/dataset/value metadata, and dense selections show truncation summary warnings instead of breaking layout (PU-35-08).
- Inspect Damage now renders `cumulative_by_program_version` as a real 2D card: selected Reference/Target scope labels are shown in subtitle copy, totals use shared value-mode plus damage-scale transforms, missing-side scope selections show explicit empty-state guidance, and the card no longer falls back to placeholder chrome (PU-35-09).
- Inspect Damage now renders `target_delta_vs_reference` as a real 2D diverging card: signed channel deltas (`Target - Reference`) are plotted around a zero baseline, selected-channel filtering is respected, tooltips include reference/target/signed values plus value mode, and low-reference channels surface warning copy for ratio-safety context (PU-35-10).
- Inspect Damage `target_delta_vs_reference` card now includes a subtle local `Absolute / Percent / Ratio` metric toggle: percent (`100 * (target - reference) / reference`) and ratio (`target / reference`) modes are computed per channel, low-reference rows are shown as unavailable for ratio-like modes, and delta tooltip/axis formatting adapts to the active metric mode (PU-35-11).
- Database now owns table access for persisted damage results: `/database` adds `Datasets` and `Damage Table` tabs, `Damage Table` loads all non-deleted program/version events with calculated damage (no manual inspect selection), version event rows are collapsed by default, and `/inspect-damage` is now plot-focused (PU-35-12).
- Inspect Damage session persistence now includes route-scoped comparison state defaults, backup/restore merge behavior, and deterministic comparison helper coverage (default/merge/prune + program/version derivation) to harden upcoming Reference-vs-Target side-panel slices (SPV-33-01).
- Schedule attach/save API now returns explicit command lifecycle outcomes (`schedule_command_outcome`, `damage_task_id`, `damage_task_status`, `damage_prerequisite_report`) so UI callers can distinguish calculation-started/reused vs validation-blocked flows without inferring from sparse fields (DPR-31-01).
- Accepted schedule saves now clear persisted scope damage rows before start/reuse of `damage_calculation`, so stale `event_channel_damage` values do not survive into the next lifecycle run and command-level task dedupe still enforces one active task per scope (DPR-31-02).
- Damage calculation workers now persist missing-channel results as explicit `unavailable` cells, keep mixed `current/error/unavailable` outcomes in one scope run, and persist structured failed-task `failure_report` context on unexpected worker exceptions (DPR-31-03).
- Inspect damage API is now strict query-only on read: inspect scope hydration no longer runs repair/prerequisite policy checks, still returns selected rows when no persisted cells exist, and exposes running/failed task context via read-only metadata (`active_damage_task_id`, `failure_report`) (DPR-31-04).
- Inspect Damage page no longer auto-starts backfill/calculation on load, now shows explicit running-state banner copy from read-only inspect scope metadata, and renders persisted `unavailable` cells directly so selected rows remain visible even when values are missing (DPR-31-05).
- Reset-first scope delete now clears scoped derived-data lifecycle tasks (`damage_calculation`, `channel_reprocess`) in addition to schedule and persisted damage rows, and Inspect Damage stale badges use neutral `Outdated` copy in the table UI (DPR-31-06).
- 3D Inspect Damage plot uses a bright discrete jet-style color scale with black bar outlines and a matching side-panel legend, aligned to FEA stress-contour styling.
- Inspect Damage now folds Reference-vs-Target comparison into the main Inspect Damage workflow: the route-wide side panel uses Reference/Target load-data sections, the 3D overlay owns plot controls, and Table View reads the same union inspect response instead of exposing a separate `Comparison` tab (SPV-33-06 follow-up).
- Internal client refactor: shared route error fallback, event metadata type fields, binary decode core, chart axis-limit scanning, and database/inspect-damage table helpers (Fallow P4 quick dedup; no user-visible behavior change).
- Inspect Damage backfill and channel-reprocess follow-up now repair mixed damage populations (some events `current`, others `error`/missing) by starting a full scheduled recalculation when prerequisites are current; stale-only scopes remain inspectable without automatic recalc (IDM-28-05).
- Assign Channels save and channel-map YAML upload now persist index-based lookup names (`col_N`) in the version-wide channel map instead of freezing the first retained artifact's channel titles across the program/version (IDM-28-02).
- Schedule-driven damage calculation now resolves plot axis channel names from each event's own header metadata before reading `measurements_raw`, so mixed RSP export naming conventions in one program/version calculate correctly under a single index-based channel map (IDM-28-03).
- Channel reprocess now resolves plot axis channel names per event when regenerating cross-plot LTTB data from canonical raw load histories, matching upload-time column-index semantics and keeping plots aligned with damage inputs under mixed export naming conventions (IDM-28-04).

### Fixed
- Assign Channels reprocess now preserves canonical raw load histories and regenerates only cross-plot data, so changing channel mappings no longer rewrites the full-resolution source data used by damage calculation (UP-24-07).
- Channel reprocess progress modals opened from Edit Metadata are clickable again: shell operation modals use `pointer-events-auto` above the editor's Radix modal layer, so **Close and continue in background** and summary **Close** work as intended; the channel-map upload picker also dismisses immediately when a file is selected so progress is shown only in the derived-data modal.

### Changed
- When channel reprocess continues in the background with the progress modal dismissed and Edit Metadata closed, the Database page shows a compact banner with program/version scope, live progress message, and **Reopen progress** to restore the shell-mounted modal (AC-25-03).
- Assign Channels save and channel-map YAML upload no longer show a fleeting loading toast; the shell-mounted derived-data progress modal is the sole in-flight feedback after the start API returns a task id. Validation/API errors and reset/restore success toasts are unchanged (AC-25-02).
- Channel reprocess and schedule damage progress modals now mount once on the Database page shell (alongside upload/delete operation modals) instead of inside Edit Metadata, use a shared `z-[70]` layer above the editor, and keep scoped store-driven open/dismiss/summary behavior unchanged (AC-25-01).
- Folder import progress now shows per-file RSP conversion and validation messages with a moving progress bar instead of staying at 10% during long batches.

### Added
- Post-upload precompute idempotency hardening closes Phase 27: end-to-end tests cover repeated trigger idempotency, channel-before-schedule and Inspect Damage repair workflow permutations, and unscheduled-event exclusion; rollout boundaries are documented in `docs/architecture/derived-data-upload-pipeline.md` (PPU-27-06).
- Damage calculation completion now refreshes Inspect Damage and Edit Metadata schedule-context queries centrally; automatic precompute blocked states and automatic failures use concise toast-only feedback while manual flows keep the existing derived-data modal behavior (PPU-27-05).
- Inspect Damage now auto-backfills completely missing persisted damage for write users when prerequisites are ready: the page reuses an active `damage_calculation` task or starts one through the precompute orchestrator, shows progress in the existing derived-data modal, and uses toast-only feedback when prerequisites are blocked; read-only users never start mutation work (PPU-27-04).
- Schedule-only edits to repeats, weight, or multiplier now rescale persisted scheduled damage synchronously when base damage is current for every scheduled event/channel row, using `base_damage * repeats * weight * multiplier` without starting py-fatigue; missing, stale, or error base damage and event-matching changes still fall back to full `damage_calculation` (PPU-27-03).
- Schedule upload/replacement and schedule-row save now route through the post-upload precompute orchestrator after persisting schedule data: prerequisites current → start/reuse `damage_calculation`; missing/stale channel prerequisites → blocked decision without a doomed task; invalid schedule rows still fail whole-task validation (PPU-27-02).
- Channel reprocess completion now auto-starts or reuses a `damage_calculation` task when an active durability schedule exists and damage prerequisites are current; missing prerequisites return a blocked decision without creating a doomed task (PPU-27-01).
- Post-upload precompute orchestrator (`server/services/post_upload_precompute.py`) exposes deterministic decisions: `no_op`, `blocked`, `start_damage_calculation`, `reuse_active_task`, and `rescale_scheduled_damage`.
- Derived-data upload pipeline hardening closes cross-flow gaps: active-task reuse returns the stored task kind, folder uploads stay independent of derived tasks, end-to-end schedule damage and stale-marking behavior is regression-tested, and rollout documentation is published in `docs/architecture/derived-data-upload-pipeline.md` (UP-24-06).
- Inspect Damage now reads persisted `event_channel_damage` rows instead of computing damage on read; stale values stay visible with page-level warnings and cell/column stale badges, missing results show a Calculate Damage empty state, and write users can start or reuse background `damage_calculation` tasks from the page (UP-24-05).
- Durability schedule upload and save now show damage-calculation progress in the metadata edit dialog when the server returns `damage_task_id`, including close-only modal behavior, scoped inline banner, locked live messages, prerequisite reports without polling, and a failure summary that reopens the schedule editor with highlighted fields (UP-24-04).
- Durability schedule upload and save now trigger a background `damage_calculation` derived-data task when prerequisites are current, or return a structured `damage_prerequisite_report` when raw load histories or cross-plot data are missing or stale (UP-24-03).
- Latest schedule-driven load-history damage persists in `event_channel_damage` (one row per event/channel) with current, stale, and error status; channel or schedule changes mark prior results stale without deleting them (UP-24-03).
- Assign Channels save and channel-map YAML upload now show a derived-data progress modal that polls the background `channel_reprocess` task, with close-only behavior, scoped inline banner, and completion summaries for success and partial failure (UP-24-02).
- Assign Channels save and channel-map YAML upload now start a background `channel_reprocess` derived-data task with creator-scoped polling instead of blocking the browser until retained-artifact reprocessing completes (UP-24-01).
- Metadata edit dialog three-section hardening: Durability Schedule dirty state participates in shared discard-close and pending scope-change prompts; read-only users cannot upload schedules from the popup; schedule save/upload refresh the scoped query baseline (DMD-23-03).
- Database table metadata edit dialog now includes a **Durability Schedule** left-nav section directly below Assign Channels; opens scoped to the clicked program/version with inline `.sch` upload, schedule table, Reset, and Save while preserving table context (DMD-23-02).
- Reusable `DurabilitySchedulePanel` extracted from the Edit Metadata route for scope-driven schedule load, attach/extract, inline edit, reset, save, dirty reporting, and write-permission gating; full-page route keeps side-panel upload while the panel supports inline upload for dialog embedding (DMD-23-01).
- Assign Channels **Upload** action for scoped `channel_map.yml` / `channel_map.yaml` uploads: opens a channel-map-only popup, applies the map to the current program/version, processes retained artifacts through the same path as manual save, and refreshes the editor table (DMD-22-01).
- Metadata edit dialog cross-section hardening: combined metadata + channel-map dirty-close prompts, shared channel-map save invalidation (Database table, filters, event catalog), write-permission parity for Assign Channels, and regression tests for save refresh and accessible nav switching (DMD-21-03).
- Database table metadata edit dialog now includes an **Assign Channels** left-nav section that renders the same scoped channel-map editor and CSV preview as the full-page `/database/edit` route; both sections stay mounted while the dialog is open so drafts persist when switching (DMD-21-02).
- Reusable `AssignChannelsPanel` extracted from the Edit Metadata route for scope-driven channel-map load, save, dirty reporting, and write-permission gating (DMD-21-01).
- Database table version-row pencil opens an inline **Edit Metadata** dialog pre-scoped to the clicked program/version; settings-style modal with left navigation rail, no route change, and table filters/selection preserved on close (DMD-20-02).
- Metadata edit dialog now confirms before discarding unsaved changes on close or when opening another version row; write/admin permission rules and post-save query invalidation match the full-page Edit Metadata workflow (DMD-20-03).
- Database scope delete confirmation and progress modal: admins see a scope summary before delete, a blocking phased progress dialog during long program/version hard-deletes, and a completion summary with counts and elapsed time. UI follows shadcn.io `dialog-bulk-actions`, `dialog-confirm-delete`, `dialog-loading`, and `dialog-success` block patterns.
- **PUT** `/api/v1/dashboard/program-version/schedule` to persist edited durability schedule table rows (`event_rows`, `multiplier`, `delimiter_token`) on the active schedule preview metadata without re-uploading `.sch` bytes; audits `DURABILITY_SCHEDULE_EDITED`.
- Editable Durability Schedule tab: inline row editing, Save/Reset with dirty tracking, hydration from saved `event_rows` on GET, and readonly mode for non-write users.
- Pure client durability schedule row matcher (`discoverEventDelimiter`, `rspEventNameFromFile`, `matchSchedulePattern`, `buildDurabilityScheduleRows`) aligned with `rsp_file_name_extraction_v2.ipynb` — delimiter discovery, longest-substring pattern match, and unit tests for PRD fixture filenames.
- Durability schedule attach/read API regression tests covering GET active context, POST validation (empty/non-`.sch`), admin cross-owner attach, identical checksum dedupe, and parser edge cases (`*summary`, missing metadata defaults, zero repeats).
- **Settings** modal dialog (sidebar icon): two-column layout with **User Management** and **Database** panels. User Management preserves admin CRUD (role, write access, password reset). Database panel embeds Transfer Data actions (create, connect, export, import).
- Inspect Damage displays persisted per-event schedule damage for the 12 canonical channels derived from the existing plot channel map.
- CSV and RSP uploads now retain immutable original file bytes under managed `artifacts/sources/` with SHA-256 checksums and portable `artifact://` URIs recorded in `source_artifacts`.
- CSV and RSP uploads now derive canonical CSV artifacts under `artifacts/canonical/` with ingestion-run audit records and per-event lineage links.
- YAML and UI channel-map authoring now normalize into immutable snapshots under `artifacts/snapshots/` with one active snapshot per program/version and per-event snapshot lineage.
- Each ingested event now stores lightweight preview metadata (headers, units, sample rows, counts, warnings, artifact references) derived from canonical CSV in `event_previews`.
- Derived measurement and LTTB rows now record explicit lineage to canonical CSV and channel-map snapshots in `event_derived_data`; LTTB is classified as plot-only data; Pending events are marked stale when the active snapshot changes.
- Admin database export now produces a transfer package with `manifest.json`, lineage Parquet tables, and portable `artifacts/` files (sources, canonical CSV, snapshots, schedules). Import validates artifact checksums and rejects missing references before applying data.

### Changed
- Channel-map save/upload API responses now return `{ task_id, task_kind, reused_existing_task }` instead of synchronous process counts; client progress UI lands in UP-24-02 (UP-24-01).
- Edit Metadata tab logic extracted into reusable `EditMetadataPanel` (scope-driven); full-page `/database/edit` route behavior unchanged — prepares inline Database table metadata dialog (DMD-20).
- Upload, delete, and database transfer dialogs now use a compact 32px status badge with 16px icons and avoid repeating the header title inside summaries.
- Database folder import now shows progress and completion in a blocking operation dialog (matching scope delete and DB import/export), instead of inline progress in the upload side panel.
- Identical durability schedule re-upload (same checksum already active for the program/version) is now a silent no-op with no duplicate audit log entry.
- Folder uploads now poll DuckDB-backed task status instead of relying on SSE, so long ingests complete reliably even when the progress stream disconnects.
- Admin database export now uses the transfer package format; legacy load-data-only archives without `manifest.json` can still be imported.
- Sidebar settings control renamed from "Admin settings" to **Settings**; opens a modal instead of navigating to `/settings/users`.
- `/settings/users` bookmarks redirect to the dashboard and open the User Management panel in the settings dialog.
- Inspect Damage now uses canonical column labels such as `BJ X Force` and `Bushing F Z Momt`, backed by existing `measurements_raw` plot-channel rows.

### Fixed
- Folder upload task polling and dataset list refresh no longer hit the strict upload write rate limit (429) during long ingests.
- Switching to another managed database no longer forces users to recreate accounts or log back in.
- Connecting to a different database no longer shows stale program/version dropdowns from the previous database on Edit Metadata (server query cache is cleared on switch; client data queries are invalidated).
- Large folder uploads no longer report false "Upload stream error" failures when server ingestion succeeds but the browser loses the SSE connection (for example during auth redirect mid-upload).

### Security
- Program-version metadata updates (`PUT /api/v1/dashboard/program-version/metadata`) now require write permission; read-only users can no longer bypass the edit-page route guard via direct API calls.
- Folder upload start (`POST /api/v1/upload/folder/start`) now enforces write/admin permission at the route guard, preventing read-only users from triggering payload parsing or ingestion task creation.

## [1.3.7] - 2026-05-19

### Changed
- Staging Parquet import tunes DuckDB for large ZIPs: `preserve_insertion_order=false`, single-threaded load, 10GB staging memory limit (configurable), and a reduced live-connection cap during import.
- Docker server `mem_limit` increased to 12 GiB to match multi-gigabyte measurement imports.
- Load-data export/import now omits retained raw CSV/RSP artifacts and `ingestion_artifacts`, so portable ZIPs carry processed load data only and legacy `managed_artifacts` entries are skipped during import.
- Deployment docs clarify disk vs RAM after artifact exclusion: plan for extracted Parquet tables, staging DB, backup, and scratch margin rather than retained raw files.

## [1.3.6] - 2026-05-19

### Changed
- Parquet import/export task status is persisted under `data/tmp/parquet-tasks` so polling survives API restarts; orphaned running tasks are marked failed on startup.
- Large imports now load into an isolated `dashboard.db.staging` file and atomically replace the live database only after success, so a crash or segfault during load no longer leaves a partial `dashboard.db`. Load-data tables commit per table to reduce peak memory.
- Docker server healthcheck uses `/health/live` instead of `/health/ready` so DuckDB probes do not run against a locked database during import.

### Fixed
- Import UI no longer shows only “task state no longer available” when the server restarts mid-import: it recovers persisted task status or compares live event counts to the archive when possible.
- Readiness returns immediately while a background import is active, avoiding healthcheck hangs during heavy Parquet loads.

## [1.3.5] - 2026-05-19

### Changed
- Database import backup step reports byte-level progress during `dashboard.db` copy and shows clearer copy in the import dialog while backing up.

## [1.3.4] - 2026-05-19

### Changed
- Database import progress now reports backup, load-data, and finalization phases, retries transient server gateway errors during heavy imports, and pauses background data-version polling while an import is active.

### Fixed
- Changelog page loads in production Docker images (`CHANGELOG.md` is bundled at `/app/CHANGELOG.md`).
- React hydration error (#418) from nested `<main>` elements in the app shell layout.

## [1.3.3] - 2026-05-19

### Fixed
- LAN Docker proxy now streams large database import uploads to the API instead of buffering them on the proxy's small cache tmpfs, and the compressed import upload limit is now 60 GiB end-to-end.

## [1.3.2] - 2026-05-19

### Fixed
- Production Docker import/export now stages large Parquet ZIP temp files under `data/tmp` on the persistent data volume instead of the server container’s 128 MB `/tmp` tmpfs (fixes HTTP 500 on multi‑hundred‑MB uploads after the nginx body-size fix).

## [1.3.1] - 2026-05-19

### Fixed
- LAN Docker proxy now allows large database import uploads (`client_max_body_size` aligned with API `max_upload_size_mb`; extended API proxy timeouts for multi-GB ZIP uploads).

## [1.3.0] - 2026-05-19

### Added
- Cross-user data refresh: authenticated sessions poll for database changes and automatically refresh event catalogs, filters, and program/version lists.
- Admin-only Load Data Transfer section on the Database page for Parquet ZIP export and import.
- Version label in the header now shows client/server versions plus live and target database schema versions.

### Changed
- Event metadata updates require the row's last-modified token and return HTTP 409 when another user changed the same event first.
- Filter dropdowns and event listings now share validated server-side filter semantics for consistent results.

## [1.2.1] - 2026-05-19

### Fixed
- Production startup now reconciles declared schema DDL before runtime backfills, fixing crash loops on legacy databases missing `users.can_write`.
- Docker production server sets `MPLCONFIGDIR=/tmp/matplotlib` so matplotlib cache writes work on read-only root filesystems.

## [1.2.0] - 2026-05-15

### Added
- Direct `.rsp` uploads in the Database panel, converting them through the existing channel-map-based ingestion flow.
- Env-primary production deployment files with a one-shot LAN deployment script and version/schema status visibility.

### Changed
- Database upload now uses a single drag-and-drop import control instead of separate file and folder buttons.
- The committed server settings file is now a development template; production secrets are expected from environment variables.

### Security
- Parquet ZIP import now rejects unsafe archive paths before extraction to keep failed imports inside managed temporary directories.

## [1.1.0] - 2026-03-31

### Added
- Creator-scoped CSV upload progress over SSE with DuckDB-backed task state for durable progress visibility.
- Dataset listing pagination metadata (`total`, `limit`, `offset`, `has_more`) plus server-side global facets for filter dropdowns.
- Unified `Load Data` panel that replaces the historical/new-data split and simplifies event selection/caching behavior.
- Group-level axis sync in the plot grid so Bushing plots sync independently from BJ/Shock plots.
- Release governance tooling around root `VERSION` sync (`release_version.py`, `check_version_sync.py`, CI drift checks).

### Changed
- Database export/import UI block is temporarily hidden in the Database side panel while preserving backend portability endpoints.
- Interactive Viewer now falls back to rendered events when selected events are empty, reducing false "No curves visible" states after navigation.
- Dashboard side panel now scrolls as one column, and `Load Data` participates in shared panel scrolling to avoid nested-scroll clipping.
- Upload `Status` defaults to `Pending`, remains visible for all users, and is role-locked in the UI for non-admin users.
- Database hardening boundaries: upload dataset reads moved behind `UploadQueryService`, dashboard event username enrichment owned by service layer, and frontend event-loading contracts aligned with backend filters.
- Session API client payload typing now aligns with backend session models.

### Fixed
- Export-task polling and long-running database operations no longer fail from mixed DuckDB connection modes or stale connection handles (`ConnectionException` / `bad_weak_ptr` race path).
- Metadata update workflows now enforce service-layer ownership checks, audit logging, cache invalidation, and shared weight-range derivation with fewer router/service drift risks.

## [1.0.0] - 2026-01-26

### Added
- FastAPI server with DuckDB unified storage
- CSV data ingestion with ETL pipeline
- Dashboard API for time-series data queries
- Session management for user state persistence
- Export API for data extraction
- Next.js client with real-time data visualization
- Performance monitoring middleware
- CORS configuration for cross-origin requests

### Technical
- Python 3.11+ with FastAPI framework
- DuckDB for high-performance analytics
- Next.js 16 with React 19
- TanStack Query for data fetching
- Zustand for state management
