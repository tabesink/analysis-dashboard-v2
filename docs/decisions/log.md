# Decision Log

Append-only log of architectural and implementation decisions.

---

## DEC-001: Establish project documentation baseline (2026-03-09)

**Context:** The codebase had grown organically without a formal build plan, PRD, or test strategy. AGENTS.md referenced `docs/master-build-plan.md` and `docs/database_schema.txt` but these files were empty or missing. Moving forward, all agent-driven development needs tracked tasks and documented decisions.

**Decision:** Reverse-engineer five foundational documents from the existing codebase:
- `docs/master-build-plan.md` -- phases and tasks reflecting what was actually built
- `docs/prd.md` -- product requirements derived from implemented features
- `docs/tech-stack.md` -- technology inventory from dependency files
- `docs/database-schema.txt` -- complete schema from schema.yaml + database.py
- `docs/test-strategy.md` -- test approach with current gaps identified

Reorganize doc structure: flat top-level for core docs, `decisions/log.md` (renamed from `decisions_made.md`), `tasks/` (renamed from `tasks_output/`).

**Rationale:** Leaner file naming (no project-name prefix since we're already in the project). Append-only decision log is simpler than per-decision files. The build plan includes a Phase 8 (multi-user hardening) capturing known gaps from a concurrency/correctness brainstorm.

**Alternatives considered:**
- Keep `deeppatient-` prefixed filenames from reference -- rejected, wrong project name
- Create per-decision markdown files -- rejected, append-only log is leaner for this project size
- Skip PRD since project is already built -- rejected, PRD serves as requirements baseline for Phase 8-9 work

---

## DEC-002: Multi-user hardening as Phase 8 (2026-03-09)

**Context:** Brainstorm analysis identified several gaps preventing production multi-user usage: a kwarg mismatch bug in the upload path, missing ownership checks on metadata updates, no cross-user cache invalidation mechanism, and no optimistic concurrency control.

**Decision:** Add Phase 8 to the build plan with three priority tiers:
- P0: Fix upload bug and add ownership checks (correctness)
- P1: data_version counter, frontend polling, cache invalidation, optimistic locking (multi-user coordination)
- P2: Secret management, secure cookies, horizontal scaling documentation (production hardening)

Keep single DuckDB + single API instance architecture. Do not migrate to Postgres until write concurrency or horizontal scaling is needed.

**Rationale:** The current single DuckDB file and single API instance handle the expected load. Adding a lightweight data_version polling mechanism provides cross-user sync without the complexity of WebSockets or Redis pub/sub. (Connection serialization details: DEC-015.)

---

## DEC-003: Program-version metadata updates use bulk endpoint + refetch (2026-03-09)

**Context:** Edit Metadata needed to update actual event metadata for a selected `program_id` + `version`, expose audit-style selection metadata fields, and keep Database columns/Global Filters behavior aligned. Existing UI flow updated filter-option catalogs, not event metadata rows.

**Decision:** Add `PUT /api/v1/dashboard/program-version/metadata` to apply role-aware metadata updates across all events for a selected program/version. Keep last-write-wins concurrency, preserve owner/admin authorization, and record updater identity via `dim_event.last_updated_by_user_id` plus audit-log entries. Frontend uses targeted query invalidation/refetch after save instead of optimistic patching.

**Rationale:** A dedicated bulk endpoint keeps update logic centralized, avoids many per-event client calls, and keeps UI behavior deterministic with low implementation complexity. Refetch-first synchronization is simpler and safer for this phase than optimistic client merges.

---

## DEC-004: Keep save UX explicit while moving program-version writes to DB batch update (2026-03-09)

**Context:** Metadata saves can run long enough to hit frontend timeouts or leave users unsure whether save completed. The previous backend implementation updated each event row in a loop, adding avoidable latency for large program/version groups.

**Decision:** Implement explicit save lifecycle feedback in the Edit Metadata page (`saving` state, pending toast, success/error replacement toast, disabled controls during save), raise timeout only for known slow endpoints, preserve Database table visibility during refresh, and replace per-event metadata writes with a scoped batch update query plus aggregate audit record.

**Rationale:** This keeps UX predictable with minimal surface-area change while improving backend write performance. Endpoint-specific timeout overrides avoid broad global timeout changes. Batch update reduces DB round-trips and preserves current RBAC, cache invalidation, and response contract behavior.

---

## DEC-005: Move Edit Metadata route to `/database/edit` and align page shell with Database split-pane layout (2026-03-09)

**Context:** Edit Metadata lived at `/database/filter-values` and used a centered single-card layout that diverged from the Database workspace UX. The requested UX update required a two-pane composition, sticky/collapsible left controls, and a simplified placeholder for Custom Fields.

**Decision:** Introduce `/database/edit` as the canonical route, keep `/database/filter-values` as a compatibility redirect, and refactor Edit Metadata UI to a Database-style split-pane shell (`320px` expanded, collapsed rail) while preserving existing program/version metadata edit-save behavior for Filter Values. Replace Custom Fields tab content with a local under-construction placeholder GIF.

**Rationale:** This keeps behavior stable while improving visual consistency and navigation clarity with minimal implementation risk. Keeping a redirect avoids breaking existing bookmarks/links during route migration.

---

## DEC-006: Evaluate weight range buckets on raw values via SQL predicates (2026-03-09)

**Context:** Global filters still expose range buckets for GVWR/FGAWR/RGAWR, while Edit Metadata captures raw numeric values. Filtering by iterating records in application code would add avoidable latency and duplicate logic across events/program/version queries.

**Decision:** Implement a shared weight-range SQL condition helper and apply it in backend query paths (`events`, `program-ids`, `versions`). Selected bucket labels (for example `1000-1500`) are parsed into numeric bounds and translated into SQL predicates against raw columns (`gvw`, `fgawr`, `rgawr`) using numeric casts.

**Rationale:** Set-based SQL filtering avoids per-record Python loops, keeps behavior consistent across endpoints, and preserves existing filter contracts in the UI while storing only raw numeric metadata.

---

## DEC-007: Replace legacy `phase` with boolean applicability flags (2026-03-09)

**Context:** Edit Metadata needed visible phase applicability controls (RFQ/DV/PV/Post-Prod checkboxes), while Global Filters needed true/false semantics and the legacy single `phase` string no longer matched the data model.

**Decision:** Replace `phase` usage across schema, API models, routers, and client types with boolean fields `rfq`, `dv`, `pv`, and `post_prod`. Keep Global Filter options user-facing as `Applicable` / `Not Applicable`, map those to boolean predicates server-side, and update Edit Metadata to store raw weight values via numeric inputs while preserving range-based filtering behavior.

**Rationale:** Boolean flags better represent applicability than a mutually-exclusive phase string, make filtering explicit, and align the UI editing model with backend query semantics without introducing client-side filtering loops.

---

## DEC-008: Frontend production audit — typography tokens, SidePanelLayout, bundle cleanup (2026-03-10)

**Context:** A full frontend audit (10-section review per `app-frontend-reviewer.md`) identified 6/10 production readiness: arbitrary pixel font sizes, duplicated side panel layout, unused packages inflating the bundle, no route-level loading/error UI, raw `<button>` elements bypassing the design system, hardcoded SVG colors, and keyboard accessibility gaps.

**Decision:** Implement the top 10 improvements from the audit in a single pass:
1. Add `loading.tsx` / `error.tsx` to all routes using existing `LoadingSpinner` and `Button` components.
2. Define `text-caption` (10px) and `text-label` (11px) CSS utility classes via `@theme inline` variables; replace all `text-[10px]` / `text-[11px]` instances.
3. Extract `SidePanelLayout` shared component from 3 duplicated wrappers (`SidePanel`, `DatabaseSidePanel`, `UploadSidePanel`).
4. Replace raw `<button>` with shadcn `Button` in 11 component files.
5. Use `next/dynamic` for `SidePanel` and `DashboardContent` on the dashboard route.
6. Add keyboard accessibility (`role`, `tabIndex`, `onKeyDown`) to `ColorLegend` group items and arrow-key repositioning for `GridActionToolbar` drag handle.
7. Tokenize SVG colors in `SVGAxes.tsx` via CSS variable references.
8. Remove dead `lib/chart-core/` directory; deduplicate `EmptyState` definitions.
9. Remove `radix-ui` meta-package, unused `tailwindcss-animate`; move `@types/js-yaml` to devDependencies.
10. Write comprehensive audit document to `docs/frontend-audit.md`.

**Rationale:** Batching these changes reduces review overhead while addressing the most impactful quality gaps. Each change is isolated (typography, layout, accessibility, bundle) with no cross-dependencies. Dark mode, Suspense boundaries, and form label accessibility are deferred to backlog as lower-priority items that require more design decisions.

**Alternatives considered:**
- Incremental single-issue PRs — rejected for this phase since the changes are all independent and small enough to review together.
- Full dark mode implementation — deferred; requires design decisions on color palette and user preference persistence.
- Converting pages to RSC — deferred; auth-guard pattern requires client components for the current architecture.

---

## DEC-009: Export database uses File System Access API with anchor fallback (2026-03-10)

**Context:** The export database button was fully wired (API call, blob download, success toast) but used an invisible anchor element with `a.download`, which silently downloads to the browser's default Downloads folder. Users expected a native Save As dialog and perceived the feature as broken. Import was already properly wired with file picker, validation modal, and confirmation flow.

**Decision:** Replace the anchor-download pattern in `handleExportDatabase` with the File System Access API (`showSaveFilePicker`), falling back to the original anchor approach for browsers that don't support it. Handle user cancellation of the Save As dialog gracefully (suppress `AbortError`).

**Rationale:** `showSaveFilePicker` provides the native Save As dialog on Chrome and Edge (the primary target browsers). Firefox lacks support but the anchor fallback preserves existing behavior there. No new dependencies, no backend changes — single function edit in `client/src/app/database/page.tsx`.

---

## DEC-010: Prompt Save As before export network call to preserve browser user activation (2026-03-10)

**Context:** Even after adding `showSaveFilePicker`, some environments may not display the dialog when it is invoked only after awaiting the export API call. Browser activation heuristics can treat that as outside the immediate user gesture.

**Decision:** Refactor export flow to open the Save As picker immediately on click (when supported), then execute the export API request and write the resulting blob to the selected file handle. Keep the fallback anchor download path for unsupported browsers.

**Rationale:** This preserves reliable dialog behavior in Chromium browsers, keeps Firefox compatibility, and remains lean (single-function frontend change, no backend or dependency changes).

---

## DEC-011: Use direct export endpoint download for Firefox/unsupported browsers (2026-03-10)

**Context:** The fallback path for unsupported browsers was using `Blob` + `URL.createObjectURL` + `a.click()`. This works, but it remains browser-managed, does not provide completion callbacks, and can be less transparent than a native download request flow in Firefox.

**Decision:** For browsers without `showSaveFilePicker`, trigger a direct navigation download to `${API_BASE}/api/v1/export/database` and rely on backend `Content-Disposition: attachment` to hand off to the browser download manager. Keep the Chromium path unchanged (`showSaveFilePicker` + explicit write/close).

**Rationale:** This keeps the fallback lean, avoids extra client-side blob handling for unsupported browsers, and aligns behavior with native browser download mechanics while preserving existing auth/session and backend export contract.

---

## DEC-012: Estimate export duration from database size and browser downlink hint (2026-03-10)

**Context:** Users requested clearer feedback about how long export may take based on database size. Existing export UX only showed start/success states and did not indicate expected duration.

**Decision:** Add a lightweight estimate before export using `/api/v1/export/database/info` (`size_mb`) and browser `navigator.connection.downlink` when available. Display a toast such as `Database size: X MB (~Ys). Download ...` and gracefully degrade to size-only messaging when network hint is unavailable.

**Rationale:** This gives actionable user feedback with minimal complexity and no backend changes (existing info endpoint reused). Estimates are intentionally approximate and do not block export when metadata lookup fails.

---

## DEC-013: Introduce `app_env` mode switch for non-container runs and enforce production security gates (2026-03-10)

**Context:** The application needed to stay localhost-only in development while becoming network-reachable in production, including non-container deployments. Existing settings made this easy to misconfigure and did not enforce production-safe constraints.

**Decision:** Add `app_env` (`development`/`production`) to server settings, apply mode-based defaults (`development` -> `host=127.0.0.1`, `debug=true`; `production` -> `host=0.0.0.0`, `debug=false`, `auth_cookie_secure=true`), and enforce startup validation in production mode (no wildcard CORS, secure cookie required, `jwt_expiry_hours <= 24`, strong non-placeholder JWT secret, non-localhost host bind). Align frontend scripts so `dev` binds to localhost and `start` binds to `0.0.0.0`. For Docker, set `APP_ENV=production` and make `NEXT_PUBLIC_API_URL` configurable via `PUBLIC_API_URL`.

**Rationale:** A single explicit mode switch reduces accidental exposure in local development, keeps production behavior predictable across container and non-container runs, and fails fast on insecure production configuration instead of silently starting with weak settings.

---

## DEC-014: Parquet ZIP portability export/import (supersedes raw `.db` download API) (2026-03-20)

**Context:** Raw `dashboard.db` downloads/uploads did not compress large time-series, loaded entire uploads into server RAM (`await file.read()`), and duplicated temp I/O for validate + import. Databases can be 10+ GB on disk.

**Decision:**

1. **Format:** Export all user tables via DuckDB `COPY … TO` Parquet with ZSTD; emit `schema.sql` (sequences, tables, indexes from catalog) and `load.sql` (per-table `COPY … FROM` relative paths); zip the folder as `dashboard_export.zip`. Import unpacks, runs `schema.sql`, runs each `COPY` with the export directory as working directory, then `_init_schema()` + `update_schema_metadata()`.
2. **API:** Replace synchronous `GET /api/v1/export/database` and byte-buffer validate/import with task-based Parquet routes under `/api/v1/export/database/parquet/` (`export/start`, `task/{id}`, `download/{id}`, `upload`, `import/{upload_id}`) and `DELETE …/upload/{upload_id}` to discard staged ZIPs when the user cancels.
3. **Streaming:** Uploads write to a temp file in fixed-size chunks with a max size guard.
4. **Client:** Poll task status (~2s); show per-table progress strings from the server; import modal receives validation from the upload response (no second upload).

**Rationale:** Columnar Parquet+zstd shrinks transfer and storage for numeric measurement tables; streaming avoids OOM; single upload + `upload_id` removes redundant writes; background threads keep FastAPI responsive for long exports/imports.

**Supersedes (for product behavior, not historical record):** DEC-011’s direct `GET …/export/database` download URL — Firefox/unsupported browsers now use the same task + blob download path as Chromium after export completes.

---

## DEC-015: UnifiedStore DuckDB connections — RW + RLock (no read_only mix) (2026-03-20)

**Context:** Parquet export runs in a background thread with `write_connection()` (read-write DuckDB connection). Task polling and auth dependencies concurrently called `read_connection`, which used `duckdb.connect(..., read_only=True)`. DuckDB raises `ConnectionException: Can't open a connection to same database file with a different configuration than existing connections` when those overlap.

**Decision:** Stop using `read_only=True` for the shared read path. Use one lazy-open read-write connection for reads, guarded by the same `threading.RLock()` that serializes `write_connection()` entry (reentrant lock so nested `write_connection` from `_init_schema` / `close` remains safe). `write_connection` continues to close the shared connection before opening its transactional connection so DuckDB never sees two simultaneous connections to the file during long exports.

**Rationale:** Fixes the export + poll race with a small change localized to `server/storage/database.py` and no edits to dozens of `read_connection` call sites. Alternatives (copy-on-export, wrapping every read in a global lock without changing `read_only`) were heavier or awkward.

**Alternatives considered:** Temporary DB copy for export only (large disk spike); keep read_only and require lock around every read call site (invasive).

---

## DEC-016: Single DuckDB connection + guarded reads (fix `bad_weak_ptr`) (2026-03-20)

**Context:** After DEC-015, reads and writes both used read-write mode, but `write_connection` still closed the shared connection and opened a short-lived second connection. Other threads could keep using a stale `read_connection` Python wrapper after the underlying C++ connection was closed, producing `_duckdb.Error: bad_weak_ptr` during concurrent export and task polling.

**Decision:** Use one persistent connection for the whole process. `write_connection` runs transactions on it without closing. Serialize every read `execute`/`fetch*` and `read_connection.description` through `_GuardedConnection` / `_GuardedResult` under the same lock; stash `description` in `threading.local()` per thread for the post-fetch column pattern. `close()` checkpoints and fully closes the shared connection so `import_from_parquet` can replace the file without a dangling file handle.

**Rationale:** Eliminates use-after-close on shared handles while keeping the existing `read_connection.execute(...).fetch*()` call shape across the codebase.

---

## DEC-017: Database page pagination + server-side facets (2026-03-26)

**Context:** `GET /api/v1/upload/datasets` returned a flat `list[DatasetInfo]` capped at 100 rows (newest first, max 500). The database page had no pagination, so events from older programs were silently hidden. Column-filter dropdowns only showed values present on the visible page.

**Decision:**
1. Replace the flat list response with `DatasetListResponse` containing `items`, `total`, `limit`, `offset`, `has_more`, and a `facets` dict (distinct values per filterable column across all non-deleted rows, computed via a single `ARRAY_AGG(DISTINCT …)` query).
2. Default page size raised to 200 (max 1000). Client hook manages `page`/`pageSize` state; UI has pagination controls (first/prev/next/last) and a rows-per-page selector.
3. `getUniqueValues` on the client prefers server `facets` for known columns, falling back to page-local computation for dynamic metadata columns.

**Rationale:** Pagination keeps response sizes bounded as data grows (2000+ events expected). Returning facets alongside the page avoids a second round-trip and ensures filter dropdowns always show the full set of programs, versions, etc. regardless of which page is displayed.

**Key files:** `server/models/upload.py` (`DatasetListResponse`), `server/routers/upload.py` (endpoint + facets query), `client/src/hooks/use-uploaded-datasets.ts`, `client/src/app/database/page.tsx`.

---

## DEC-018: Per-group axis syncing (BJ+Shock / Bushing) (2026-03-26)

**Context:** The plot grid's "sync axes" feature computed a single global min/max envelope across all 8 plots (BJ, Shock, and Bushing). Because Bushing force magnitudes differ significantly from BJ/Shock, synced axes compressed one group or inflated another, making the grid less useful when sync was enabled.

**Decision:** Replace the single `globalAxisLimits` with group-level limits. Plot keys starting with `bushing_` share one axis envelope; all other keys (BJ and Shock) share another. The `getAxisGroup` classifier in `PlotGrid.tsx` maps each plot key to its group. Each `SVGPlotCard` receives its group's merged limits via the existing `globalAxisLimits` prop. The Interactive Viewer remains unaffected (local `calculateAxisLimits` from visible curves).

**Rationale:** Minimal code change (single file, ~20 lines diff) that preserves the sync/unsync toggle UX while producing physically meaningful axis ranges. Adding a new group later only requires extending the `AxisGroup` union and the `getAxisGroup` function.

**Key files:** `client/src/components/dashboard/plot-grid/PlotGrid.tsx`.

---

## DEC-019: Unify Load Data Panel -- remove baseline/new-data partition split (2026-03-26)

**Context:** The dashboard side panel had two separate sections -- "Historical Data" (Approved/Obsolete status) and "New Data" (Pending status) -- each with its own `HierarchicalEventTree`, selection state (`baseline_state` / `new_data_state`), and color system (program-based for baseline, black/grey for new data). This complexity permeated the entire stack: separate `EventsResponse` arrays, partition-aware query service, partition-tagged curve models, and dual-path coloring logic.

**Decision:** Merge both sections into a single "Load Data" panel with one unified `HierarchicalEventTree`. Full-stack refactor:
- **Backend models:** `EventsResponse` flattened to single `events` array. `partition` field removed from `PlotSeries`, `SVGCurveData`, `CurveData`, `ClickQueryResponse`. `EventsRequest` simplified to `global_filters` only. Session models use `data_state` instead of `baseline_state` + `new_data_state`.
- **Backend query:** `get_partition_events()` replaced by `get_all_events()` -- single query, no status-based split.
- **Backend binary format:** Partition byte removed from binary plot data encoding.
- **Frontend types:** `PartitionState` renamed to `DataState`. `SessionState.data_state` replaces dual partition states. `SVGCurveData` and `Curve` types drop `partition`.
- **Frontend hooks:** `useFilterState` returns unified `dataState`/`updateDataState`. `useEventCatalog` returns single `events` array. `useCurveColoring` applies program-version coloring uniformly to all events.
- **Frontend components:** New `LoadDataSection` replaces `BaselinePartition` + `NewDataPartition`. `SidePanel` simplified. `CurveSelector` receives single `events` prop. `ColorGroupingPanel` and `ColorLegend` remove partition-specific sections.
- **Session migration:** Server-side migration merges legacy `baseline_state.selected_event_ids` + `new_data_state.selected_event_ids` into `data_state` on session load.
- **Database:** `data_state` column added to `sessions` and `saved_filters` tables via `ALTER TABLE IF NOT EXISTS`. Old columns kept for migration.

**Rationale:** Eliminating the partition concept removes ~40% of branching logic in the data pipeline, simplifies the mental model for users (no need to understand status-based categorization to select data), and makes the coloring system uniform. The migration path preserves existing sessions by merging selected event IDs.

**Key files:** `server/models/dashboard.py`, `server/models/session.py`, `server/services/query.py`, `server/services/session.py`, `server/services/plot_image.py`, `server/routers/dashboard.py`, `server/routers/session.py`, `server/storage/database.py`, `client/src/types/api.ts`, `client/src/types/session.ts`, `client/src/hooks/use-filter-state.ts`, `client/src/hooks/use-all-events.ts`, `client/src/hooks/use-event-catalog.ts`, `client/src/hooks/use-curve-coloring.ts`, `client/src/components/dashboard/side-panel/SidePanel.tsx`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`.

---

## DEC-020: Interactive viewer uses rendered-event fallback for empty selection (2026-03-26)

**Context:** The Interactive tab displayed `No curves visible` when `selected_event_ids` was empty, even if the Grid still had rendered/cached curves from `rendered_event_ids`. This commonly happened when navigating away to Edit and returning to Dashboard while preserving the Interactive tab.

**Decision:** In `InteractiveViewer`, derive the visibility source from:
1. `allSelectedEventIds` when non-empty (primary behavior),
2. `renderedEventIds` when selection is empty (fallback continuity behavior).

The `No curves visible` state now keys off this effective source, while loading/error precedence and tab-preservation behavior remain unchanged.

**Rationale:** This aligns Interactive behavior with what users already see in Grid, avoids false empty states during route navigation, and keeps the change small and localized to one component without altering session models or rendering pipeline contracts.

**Key files:** `client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx`.

---

## DEC-021: Temporarily hide Database export/import subsection in Database side panel (2026-03-30)

**Context:** The Database route needed a surgical UI change to remove visibility of portability actions (Export Database and Import Database) without changing backend behavior or broader page layout.

**Decision:** In `DatabaseSidePanel`, comment out rendering of the `DatabaseSection` block and its adjacent divider, leaving upload controls and side-panel structure intact.

**Rationale:** This is the smallest reversible change that hides the subsection immediately while preserving existing code paths for a future re-enable.

**Key files:** `client/src/components/upload/DatabaseSidePanel.tsx`.

---

## DEC-022: CSV upload progress uses creator-scoped SSE over DB-backed task rows (2026-03-30)

**Context:** CSV uploads previously used a single request (`POST /upload/folder`) with only multipart byte progress on the client and one final response after server processing. During validation/DB insertion there was no per-event visibility, and in-memory task state would not survive process restarts or support lightweight multi-user hardening.

**Decision:** Replace the CSV upload contract with:
- `POST /api/v1/upload/folder/start` (multipart) returning `task_id`
- `GET /api/v1/upload/folder/events/{task_id}` (SSE, `text/event-stream`) for progress events

Persist upload task state in DuckDB (`upload_tasks`) keyed by `task_id` and `created_by_user_id`, with short TTL cleanup. Stream access is creator-only. Refactor ingestion writes to per-event commit semantics and emit progress after each event commit (including LTTB insertion).

**Rationale:** This keeps the implementation lightweight (no Redis/WebSockets), supports per-event persisted progress, and improves multi-user correctness by enforcing user-scoped stream authorization and durable task state.

**Key files:** `server/routers/upload.py`, `server/services/ingestion.py`, `server/storage/database.py`, `server/models/upload.py`, `client/src/lib/api/upload.ts`, `client/src/hooks/use-upload.ts`, `client/src/types/upload.ts`.

---

## DEC-023: Keep 24h auth policy and raise CSV upload timeout to 60 minutes for local-network usage (2026-03-30)

**Context:** Users observed upload interruption risk for large CSV folders. For this deployment (small local-network user group), the goal was to avoid added auth/session complexity while reducing client-side upload failures.

**Decision:** Keep authentication policy unchanged (`jwt_expiry_hours` remains 24 in production mode), and increase CSV multipart upload timeout in the client upload API path to 60 minutes (`3_600_000 ms`).

**Rationale:** This is the smallest operationally simple fix that targets the likely failure mode (XHR timeout) without introducing refresh-token or heartbeat logic.

**Key files:** `client/src/lib/api/upload.ts`.

---

## DEC-024: Make dashboard side panel scroll as a single column when Global Filters expand (2026-03-30)

**Context:** Expanding Global Filters and multiple accordion subsections could push side-panel content beyond viewport height, while the panel content stack had no vertical overflow handler. This caused clipped content in the dashboard side panel.

**Decision:** Add `overflow-y-auto` to the main dashboard side-panel content container in `SidePanel.tsx` so Global Filters and Load Data share one vertical scrollable column in grid and interactive contexts.

**Rationale:** This is the smallest targeted fix that restores reachability for overflowing content without restructuring section components or changing existing tree-level scroll behavior.

**Key files:** `client/src/components/dashboard/side-panel/SidePanel.tsx`.

---

## DEC-025: Let Load Data grow in the shared SidePanel scroll flow (2026-03-30)

**Context:** After enabling panel-level scrolling, users could reach the bottom of expanded Global Filters but still had trouble reaching deep content in expanded Load Data because the section remained constrained by flex-fill sizing intended for internal scrolling.

**Decision:** Remove `flex-1 min-h-0` sizing from `LoadDataSection`'s `SidePanelSection` wrapper/content classes, keeping only horizontal overflow support so Load Data participates in the same outer side-panel vertical scroll.

**Rationale:** This keeps one consistent scrollbar for Global Filters and Load Data together and avoids nested-scroll dead zones caused by section-level flex constraints in overflow scenarios.

**Key files:** `client/src/components/dashboard/side-panel/LoadDataSection.tsx`.

---

## DEC-026: Deepen plot/session and metadata mutation boundaries for safer refactors (2026-03-30)

**Context:** Plot data lifecycle logic was duplicated across frontend hooks, session/filter behavior had implicit storage/cache coupling, metadata mutation orchestration lived in the dashboard router, and weight-range derivation rules were duplicated across ingestion and metadata update paths.

**Decision:** Consolidate these seams into deeper boundaries:
- Add `client/src/lib/plot-pipeline.ts` as the shared fetch/decode/transform module used by both lazy and sequential plot hooks.
- Add `client/src/lib/session/session-sync.ts` to centralize session sync/storage helpers and selection-vs-rendered diff logic.
- Move metadata mutation orchestration (ownership checks, normalization, derived weights, audit, cache invalidation, response shaping) from `server/routers/dashboard.py` into `QueryService`.
- Extract shared weight-range derivation into `server/utils/weight_ranges.py` and consume it from ingestion + metadata update paths.
- Remove unused/stale `UnifiedDatabase` protocol from `server/protocols.py` and route auth cookie user resolution through an `AuthService` method instead of direct DB reach-through in dependencies.

**Rationale:** This reduces cross-layer coupling and duplicated logic, creates stable boundaries for tests, and keeps routers focused on HTTP concerns while services own mutation workflows.

**Key files:** `client/src/lib/plot-pipeline.ts`, `client/src/lib/session/session-sync.ts`, `server/services/query.py`, `server/routers/dashboard.py`, `server/utils/weight_ranges.py`, `server/services/ingestion.py`, `server/protocols.py`, `server/services/auth.py`, `server/dependencies.py`, `tests/server/services/test_query_service_metadata.py`, `tests/server/utils/test_weight_ranges.py`.

---

## DEC-027: Enforce single-version release sync with root `VERSION` and CI drift guard (2026-03-30)

**Context:** The repository already had a root `VERSION` file and runtime version exposure, but version fields in `client/package.json`, `server/pyproject.toml`, and frontend build injection could drift. This creates confusion about which client/server package version is actually running.

**Decision:** Keep one product version in root `VERSION`, and enforce synchronization via:
- `scripts/release_version.py <semver>` to atomically update `VERSION`, `client/package.json`, and `server/pyproject.toml`.
- `scripts/check_version_sync.py` to fail when mirrored versions diverge from root `VERSION`.
- `.github/workflows/version-sync.yml` to run the drift check automatically on pull requests and main/master pushes.
- `client/next.config.ts` reading version from root `VERSION` instead of `client/package.json`.
- `docs/release-versioning.md` as the release/changelog checklist.

**Rationale:** This keeps release metadata deterministic with a single canonical version while preserving package-level version fields required by ecosystem tooling. CI catches drift early, and frontend/server version display remains aligned to the same source of truth.

---

## DEC-028: Upload `Status` defaults to Pending and is role-locked for non-admin users (2026-03-30)

**Context:** The upload workflow needed explicit role behavior for metadata `Status`: all uploads should default to `Pending`, admins should be able to select alternative values, and non-admin users should still see the field while being unable to change it.

**Decision:** Set upload form default/reset `Status` to `Pending` in the Database page state, always render the `Status` control in `UploadDataSection`, disable and ghost it for non-admin users, and keep server-side enforcement that non-admin ingest requests resolve to `Pending`.

**Rationale:** This keeps UI behavior transparent for all users, prevents non-admin overrides at both UI and backend layers, and preserves admin flexibility without expanding API surface area.

**Key files:** `client/src/app/database/page.tsx`, `client/src/components/upload/UploadDataSection.tsx`, `server/services/ingestion.py`, `tests/server/services/test_ingestion_service_status.py`.

---

## DEC-029: Minimal DB hardening via service boundaries and contract alignment (2026-03-30)

**Context:** Dashboard and upload routes still had boundary leaks where transport-layer code could directly depend on DB internals (`query_service.db` reach-through and SQL in upload router). Frontend event listing also applied client-side filtering over a capped unfiltered dataset, and session API payloads were typed too broadly versus backend models.

**Decision:** Apply a minimal hardening pass that avoids large architectural churn:
- Move username enrichment ownership fully into `QueryService` and remove dashboard router DB reach-through.
- Introduce `UploadQueryService` and route dataset list/facets reads through it instead of router-level SQL.
- Align event catalog retrieval with backend filtering semantics by sending allowed global filters to `/dashboard/events` instead of filtering a capped list only in the client.
- Tighten session API request contracts with explicit create/update payload types aligned to backend session models.
- Add focused regression tests around DB invariants and user-scoped session access.

**Rationale:** For single-instance local-network deployment, this is the highest-value risk reduction without overengineering. It preserves existing runtime behavior while reducing accidental DB-coupling regressions and improving testable boundaries.

**Key files:** `server/services/query.py`, `server/routers/dashboard.py`, `server/services/upload_query.py`, `server/routers/upload.py`, `server/dependencies.py`, `client/src/hooks/use-all-events.ts`, `client/src/hooks/use-event-catalog.ts`, `client/src/types/session.ts`, `client/src/lib/api/session.ts`, `tests/server/services/test_boundary_regressions.py`.

---

## DEC-030: Database page uses nested Program > Version > Event tree with raw-column lookup (2026-04-16)

**Context:** The Database page previously rendered a flat table with one row per event and separate `Program ID`, `Version`, and `Event` columns. This made it hard to scan how many versions/events exist per program, duplicated the program/version text on every row, and required a `display*` indirection layer on the client row type to map between UI column keys (`displaySuspension`, `meta:status`, ...) and the underlying `DatasetInfo` fields. The indirection went stale and caused metadata columns to render as dashes even when the server returned values.

**Decision:** Replace the flat table with a three-level Collapsible tree (Program ID > Version > Event) and remove the `display*` / `meta:` indirection layer entirely:
- New `client/src/components/upload/DatabaseEventTree.tsx` component groups `DatasetInfo[]` by `program_id` then `version`, renders shadcn `Collapsible` nodes with a `chevron-down` toggle, default-expands programs and default-collapses versions, and draws indent guide lines with a darkest-to-lightest gray shading ramp (program > version > event) for level legibility.
- Parent rows show a child count and a rolled-up status pill; `Version` and `Event` column headers are removed and those values nest under `Program ID`.
- Status is a version-level concept only. The status pill is rendered on version rows, removed from event rows, and `Status` remains available as a filterable column header at program level.
- Delete is scoped to program and version nodes only. Event-level checkboxes and the select-all control are removed; users cannot delete individual events from this view.
- `DatasetRow` is aliased to `DatasetInfo`; `toDatasetRow`, `displayKeyToServerColumn`, and the `displayProgramId`/`displayVersion`/`displaySuspension`/`meta:*` keys are deleted. Column keys are the raw DB column names (`program_id`, `version`, `status`, `suspension_component`, `axle_location`, ...), and `getColumnValue` is a direct `(dataset as unknown as Record<string, unknown>)[columnKey]` lookup.

**Rationale:** The nested tree matches how users reason about the data (programs contain versions, versions contain events) and eliminates repeated program/version text. Collapsing status and deletion to the levels where they are semantically meaningful prevents nonsensical per-event status edits and accidental single-event deletes. Removing the `display*` indirection removes a class of silent-miss bugs where adding a server column required touching a mapping table to surface it in the UI, and keeps the UI column contract aligned with `DatasetInfo` by construction.

**Alternatives considered:**
- Keep the flat table and add a `Program` grouping filter -- rejected, does not convey hierarchy visually and keeps redundant columns.
- Use shadcn `Accordion` -- rejected in favor of `Collapsible` because we need independent open/closed state per program and per version without accordion's single-open constraint.
- Keep the `display*` layer and fix the mapping -- rejected; the indirection had no consumer beyond the one-to-one remap, so removing it is strictly simpler than maintaining it.

**Key files:** `client/src/components/upload/DatabaseEventTree.tsx`, `client/src/app/database/page.tsx`, `client/src/types/upload.ts`, `client/src/lib/status-badge.ts`.

---

## DEC-031: Edit Events uses split draft/baseline state so mixed-null metadata groups save through (2026-04-16)

**Context:** `PUT /api/v1/dashboard/program-version/metadata` (DEC-003) applies a metadata update to every event under a selected `program_id` + `version`. When Edit Events loaded a group where some events already had a value (e.g. `suspension_component = "A-Arm (UCA)"`) and other events under the same program/version were `null` for the same field, the UI showed the existing non-null value in the form but `Save` was a no-op. The client diffed `draftValues` against `baselineDraftValues`, both of which `buildProgramVersionDraftValues` pre-filled with the same dominant value, so the diff produced zero changed keys and no API call was made. The `null` events stayed `null` and the Database tree kept showing dashes, even after the user clicked Save and reloaded.

**Decision:** Split the draft state into two values -- what the form displays (`draft`) and what the diff compares against (`baseline`) -- and have `buildProgramVersionDraftValues` return both:
- All events in the group share the same non-empty value -> `draft = value`, `baseline = value` (no diff, no save).
- Some events have a value and others are `null` (mixed-null) -> `draft = value` (so the user still sees the existing value in the field), `baseline = ''` (so a Save without any edit still produces a diff and propagates the value to every event in the group).
- Multiple distinct values or all empty -> `draft = ''`, `baseline = ''` (user must explicitly pick a value to save).

**Rationale:** The server endpoint is inherently a bulk overwrite for the selected `program_id` + `version`, so the correct user-visible contract is "Save applies the currently displayed value to every event under this program/version". Splitting draft from baseline lets us preserve that semantic without changing the API or asking users to re-enter values that are already partially populated. The mixed-null case is the one that silently broke before and is now the case that explicitly forces a Save to propagate.

**Alternatives considered:**
- Treat mixed-null as "no value" and clear the field -- rejected, hides existing data from the user and forces re-entry.
- Always send all non-empty draft values on Save regardless of diff -- rejected, would issue updates on every save click even when nothing changed, inflating audit-log noise and `last_updated_by_user_id` churn.
- Change the endpoint to per-event diff -- rejected, much larger surface change for a UI-layer bug.

**Key files:** `client/src/app/database/edit/page.tsx`.

---

## DEC-032: Closed-registration auth model with admin bootstrap and `can_write` permission tier (2026-04-22)

**Context:** The previous auth flow auto-created a `user` row on first login for any unknown username (passwordless), and `admin_secret` was consulted on every login attempt. There was no way to distinguish a read-only user from a write-capable user, no admin UI for managing users, and no self-serve registration path. New product requirements called for an admin-managed user roster with explicit per-user write permission, plus an opt-in self-registration path that defaults to read-only.

**Decision:** Replace the open auto-create model with a closed model and three coordinated changes:

1. **Closed login.** `AuthService.authenticate` now only verifies an existing `users` row + bcrypt password, raising `AuthenticationError` otherwise. The `_authenticate_admin` branch and all auto-create logic are removed.
2. **Admin bootstrap.** A new `UserService.bootstrap_admin()` runs once at app startup (FastAPI lifespan): if no admin row exists, it inserts one from `settings.admin_secret` (bcrypt-hashed if it looks like plaintext) with `can_write=TRUE`. After this, `admin_secret` is never consulted again at login time -- the DB row is the only source of truth, so admins can rotate their password from the UI without touching environment config.
3. **`can_write` permission tier.** A new `can_write BOOLEAN DEFAULT FALSE` column on `users` (admin rows forced TRUE) gates write surfaces independently of role. New `require_write_or_admin` dependency replaces `require_admin` on upload/custom-field/program-version-metadata mutations. The per-version `Status` field gate stays `require_admin` -- only admins can change program-version status. The entire `/admin/users` surface is admin-only.

Self-registration via `POST /auth/register` creates a `role=user, can_write=FALSE` row and immediately logs the user in. Frontend gets a Register tab on `/login`, a Settings icon at the end of `<SidebarContent>` (admin-only, with a notification dot when new self-registered users have appeared since `last_settings_visit_at`), and a `/settings/users` admin page for create/reset-password/promote/toggle-write/delete. Read-only users see Database/Edit Filters as disabled in the sidebar and are redirected to `/dashboard` if they navigate there directly.

**Rationale:** Closing the auth model is the prerequisite for any meaningful per-user authorization -- as long as login auto-creates rows, ownership and write checks are toothless. Bootstrapping the admin from `admin_secret` once (instead of consulting it every login) keeps deployments easy to seed while letting admins rotate their password without changing the environment. A boolean `can_write` column is the smallest change that lets us split read-only from write-capable users without inventing a full RBAC system; reserving the per-version `Status` gate for admins preserves the existing approval workflow without expanding role count.

**Alternatives considered:**
- Keep open auto-create and bolt approval onto it -- rejected, leaves an unauthenticated row-creation surface even after approval logic is added.
- Full role table (admin/editor/viewer/owner) -- rejected, three semantic tiers (admin / write user / read user) are sufficient and avoid the migration churn of a role table.
- Email-link or invite-token registration -- deferred; self-register-then-promote is enough for the single-tenant deployment and avoids adding an email subsystem.
- Re-check `admin_secret` on every login -- rejected, would force admin password rotation to go through env-var redeploys and double-source the admin password.

**Key files:** `server/storage/database.py`, `server/services/user.py`, `server/services/auth.py`, `server/models/auth.py`, `server/models/user.py`, `server/dependencies.py`, `server/routers/auth.py`, `server/routers/admin_users.py`, `server/routers/upload.py`, `server/routers/dashboard.py`, `server/middleware/rate_limiter.py`, `server/main.py`, `client/src/lib/api/auth.ts`, `client/src/lib/api/users.ts`, `client/src/stores/auth-store.ts`, `client/src/app/login/page.tsx`, `client/src/app/settings/users/page.tsx`, `client/src/components/layout/AppSidebar.tsx`, `client/src/components/layout/NavMain.tsx`, `client/src/config/sidebar-config.ts`.

---

## DEC-033: Interactive viewer empty state renders an axes-only plot instead of a text message (2026-04-22)

**Context:** When the Interactive viewer had a `selectedPlotKey` but every curve was hidden via the side panel's curve-visibility toggles, the card rendered a centered text block ("No curves visible / Enable curves from the side panel"). This was visually inconsistent with the Grid view, where empty cards already render an axes-only chart via `<SVGPlot curves={[]} ... renderMode="grid" />` so the page keeps its plot-grid shape.

**Decision:** Drop the text-block empty state from `InteractiveViewer` and unconditionally render `InteractiveCanvasPlot` whenever a plot is selected and there is no error/loading state. With `curves=[]` the renderer's existing fallbacks take over: `calculateAxisLimits` returns its default empty range, the offscreen canvas and spatial-grid lookups are no-ops, and `SVGAxes` still draws -- producing an axes-only plot that mirrors the Grid empty card. The bottom `PlotLabel` (plot title) is preserved across all states; `PinnedEventsOverlay` is gated on `curves.length > 0` so it does not float over an empty plot.

**Rationale:** Reusing the same renderer for empty and populated states keeps the visual layout stable as the user toggles curves on and off (no layout jump, no loss of axis labels), and aligns Interactive with the Grid card's behavior the user already expects. Using `InteractiveCanvasPlot` (rather than `SVGPlot` with `renderMode="grid"`) was chosen so the empty plot inherits the larger interactive padding/font sizes that match the populated interactive view, instead of looking like a shrunken grid card. The change also lets us delete `effectiveEventIds`/`visibleEventIds` (added in P5-30 as inputs to the now-deleted gate) and the redundant secondary `LoadingState` fallback, since the `curves` memo already collapses to `[]` whenever the cache is missing or fully filtered.

**Alternatives considered:**
- Render `SVGPlot` with `curves=[]` for an exact pixel-match to the Grid empty card -- rejected, the smaller padding/font sizes would look out of place at the Interactive viewer's larger card size.
- Keep a small text hint underneath the empty plot ("Enable curves from the side panel") -- rejected, the user explicitly asked for the message removed and the empty plot itself signals the state.
- Hide the entire card body when no curves are visible -- rejected, it would lose the axis context (units, range orientation) that helps users decide which curves to re-enable.

**Key files:** `client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx`.

---

## DEC-034: Dashboard side-panel program/version status pills replaced with inline version-row icons (2026-04-22)

**Context:** The shared `HierarchicalEventTree` rendered a colored status pill (Approved/Pending/Obsolete) on every program row, visible in both the Load Data side panel and the Interactive viewer's `CurveSelector`. The pills duplicated information already shown in the Database table, added visual noise to the side panels, and the program-level pill required a priority-based aggregation (`Obsolete > Pending > Approved`) over events that does not match how the data is actually curated (status is uniform per version).

**Decision:** Remove the program-row badge and its `programStatusForBadge` aggregator from `HierarchicalEventTree` entirely. On version rows, when the version's status is `Pending` or `Obsolete`, render a tiny neutral lucide icon immediately to the right of the version name (`AlertCircle` for Pending, `History` for Obsolete) with a native `<title>` tooltip showing the status label. Approved versions show no icon. The per-event leaf badge (`showStatusBadge` prop) is untouched, so the Database table page continues to render full status pills exactly as before. Status is read directly off `vg.events[0].status` since a version always has uniform status across its events.

**Rationale:** Side panels are dense navigation surfaces, not status surfaces -- collapsing the pill to a small mono-color icon for the only two states the user needs to act on (Pending = needs review, Obsolete = avoid) cuts visual weight without losing the signal. Reading status from the first event (instead of aggregating) drops dead branches that existed only to handle a "mixed status per version" case that does not occur in the data. Keeping the database table's full pills intact preserves the curation workflow's high-information view where it belongs.

**Alternatives considered:**
- Color-tint the icons to match the badge palette (amber/red) -- rejected, defeats the goal of reducing side-panel visual noise.
- Show an aggregate icon on the program row whenever any version under it is Pending/Obsolete -- rejected, the version row is the actionable unit; a program-level summary would re-introduce the same duplication problem.
- Keep an Approved badge on version rows and use icons only for Pending/Obsolete -- rejected, no-icon is itself a clear "approved/normal" signal and avoids two parallel visual languages on the same row.

**Key files:** `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`.

---

## DEC-035: Collapse dual color systems to single program/version palette (2026-04-22)

**Context:** Two parallel curve-coloring systems coexisted in the frontend. System A was the `useColorSelectionStore` Zustand store with a `colorMode: 'byVersion' | 'byFilter'` switch, plus legacy non-program-scoped `versionColors`/`eventColors`/`historicalColor` palettes and a "By Filter" focus mode (focus filter + shaded values + "other" color). It was driven by `ColorGroupingPanel`/`ColorGroupingSelector`. System B was the `ColorLegend` dockable panel with its own `ColorGroupingMode`/`ColorGroupingCategory` model spanning `'none' | 'program_version' | 'filter_category'` and per-group toggle/color overrides, backed by a `colorLegendPanel` slice on `useUIStore` and the `DockablePanel` UI primitive. Neither `ColorGroupingPanel`, `ColorGroupingSelector`, nor `ColorLegend` had any JSX call site in the live UI. The grid-mode side panel showed program/version color swatches via `LoadDataSection`, but the interactive-mode side panel (`CurveSelector`) did not, so users could not tell from the panel which curves on the chart belonged to which version.

**Decision:** Add the missing version swatches to the interactive `CurveSelector` and, in the same change, delete both dead color systems so the swatch shown in the side panel is guaranteed to equal the curve color rendered on the chart (modulo per-event override). Concretely:

1. **Swatch parity.** Extract a `useEventTreeColorProps()` hook that wires `HierarchicalEventTree`'s color-swatch slice to `useColorSelectionStore`. Both `LoadDataSection` and `CurveSelector` consume it and spread it into the tree. No new UX -- interactive panel matches grid panel exactly (per-version `ColorPicker` + per-program reset).
2. **Pinned-only event overrides.** `usePinnedEventsStore.togglePin`/`unpinEvent`/`clearAllPinned` now call `useColorSelectionStore.getState().resetEventOverrideColor(...)` on any unpin transition, so a recolored curve always reverts to its version palette color when the event leaves the pinned set. The previous duplicate cleanup inside `PinnedEventsOverlay`'s X button is removed.
3. **System A trim.** Drop `colorMode`/`setColorMode`/`_cachedVersionColors`/`_cachedEventColors`/`focusFilter`/`focusColor`/`otherColor`/`filterValueColors`/`setFocus*`/`setFilterValueColor`/`resetFilterValueColor`/`resetFilterMode`/`getFilterValueColor`/`syncFilterValueColors`, the legacy non-program-scoped `versionColors`/`eventColors`/`historicalColor` triplets and their setters/getters/sync, and the constants `DEFAULT_FOCUS_COLOR`/`DEFAULT_OTHER_COLOR`/`GREY_PALETTE`/`FILTER_CONFIG`. `useCurveColoring.getCurveColor` collapses to `eventOverrideColors[id] ?? getProgramVersionColor(...)`. `partialize` now persists only `programColors`/`programVersionColors`/`eventOverrideColors`; a `version: 2` `migrate` strips legacy keys from older payloads. `DEFAULT_HISTORICAL_COLOR` lives in `config/settings.ts` and is referenced as a literal default by `InteractiveViewer`/`PlotGrid`'s `ColorConfig`.
4. **System B removal.** Delete `ColorLegend`, its `index.ts`, the `colorLegendPanel`/`DockEdge`/`DockablePanelState` slice and all `setColorLegend*`/`dock*`/`undock*` actions on `useUIStore`, the orphaned `DockablePanel` primitive, and the frontend types `ColorGroupingMode`/`ColorGroupingCategory`/`ColorGroupingConfig`/`ColorGroup` along with the `UIPreferences.color_grouping` field. Server-side `ColorGroupingConfig` (`server/models/dashboard.py`, `server/services/plot_image.py`) is intentionally untouched -- the frontend never sent it and removing it is tied to the legacy image renderer's lifecycle.

**Rationale:** Two parallel coloring systems, both unmounted, cost more than they bought: future swatch features had to ship with weasel-words about when the swatch was honest, returning users could land in dead `byFilter` state via persisted localStorage, and the LLM/devs had to reason about three sources of truth for the same concept. Collapsing to one deterministic function (`override ?? programVersion`) makes the side-panel swatch a faithful preview of the chart and shrinks the store's surface area by roughly half. Constraining per-event overrides to the pinned lifecycle (rather than letting them outlive unpinning) is the smallest change that prevents "ghost" color overrides from silently outliving the only UI that exposes them (`PinnedEventsOverlay`). Keeping the server-side `color_grouping` field out of scope confines the blast radius to the frontend.

**Alternatives considered:**
- Ship swatch parity only and leave both dead systems intact -- rejected, the "swatch may lie when colorMode is byFilter" caveat would have to be documented and the dead surface keeps misleading future readers.
- Keep `byFilter` "for future use" behind a feature flag -- rejected, no concrete product requirement for it; reviving filter-based coloring later is better designed against current needs than preserved as a vestigial branch.
- Store the pinned/override invariant as a `useEffect` listener rather than inside `usePinnedEventsStore` -- rejected, putting the rule inside the store keeps it active regardless of which component mounts and avoids race conditions on first paint.
- Remove server-side `ColorGroupingConfig` in the same PR -- deferred, the legacy image renderer still references it and that decision belongs with the renderer's own lifecycle review.

**Key files:** `client/src/hooks/use-event-tree-color-props.ts` (new), `client/src/hooks/use-curve-coloring.ts`, `client/src/stores/color-selection-store.ts`, `client/src/stores/pinned-events-store.ts`, `client/src/stores/ui-store.ts`, `client/src/stores/index.ts`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`, `client/src/components/dashboard/side-panel/index.ts`, `client/src/components/dashboard/interactive-viewer/CurveSelector.tsx`, `client/src/components/dashboard/interactive-viewer/PinnedEventsOverlay.tsx`, `client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx`, `client/src/components/dashboard/plot-grid/PlotGrid.tsx`, `client/src/components/dashboard/index.ts`, `client/src/components/dashboard/shared/index.ts`, `client/src/config/settings.ts`, `client/src/types/session.ts`, `client/src/types/api.ts`, `client/src/types/index.ts`. Deleted: `client/src/components/dashboard/shared/ColorGroupingPanel.tsx`, `client/src/components/dashboard/side-panel/ColorGroupingSelector.tsx`, `client/src/components/dashboard/color-legend/` (directory), `client/src/components/ui/dockable-panel.tsx`.

---

## DEC-036: Live color propagation, no refetch gate (2026-04-22)

**Context:** After DEC-035 collapsed coloring to a single program/version palette, both side panels wrote into the same `useColorSelectionStore`, so a swatch change was already in the right place data-wise. But neither viewer actually re-rendered when those colors changed. `useCurveColoring` selected the *function reference* `getProgramVersionColor` (which Zustand never recreates) without subscribing to the underlying `programColors`/`programVersionColors` data, so `getCurveColor`'s `useCallback` deps never invalidated and the cached `plotsData`/`curves` memos kept stale baked-in colors. The grid compensated with a `colorRevision` vs `lastRenderedColorRevision` diff that flashed an amber "Selection or colors changed -- click Render to update" banner and forced a full server refetch on click. The interactive viewer had no banner and no trigger -- color edits there were silently swallowed until something else invalidated the curves memo. The compensation was conceptually wrong: colors are applied client-side in `SVGPlot` and `InteractiveCanvasPlot`, the streamed payload from `useSequentialPlotData` carries no color information, and a color tweak therefore never needs a roundtrip.

**Decision:** Make color edits propagate live to both viewers and remove the obsolete refetch gate. Concretely:

1. **Reactive coloring.** `useCurveColoring` subscribes to `programColors` and `programVersionColors` (the data, not the getter) and adds them to `getCurveColor`'s `useCallback` deps. The body is unchanged -- `getProgramVersionColor` still reads fresh state via `get()`; the change just lets React know when to re-derive.
2. **Drop the color half of the click-Render gate.** Remove `useColorSelectionStore`'s `colorRevision` subscription, `useRenderStore`'s `lastRenderedColorRevision`/`setLastRenderedColorRevision` reads, the `setLastRenderedColorRevision(colorRevision)` call inside `PlotGrid`'s render-trigger effect, and the `hasUnrenderedColorChanges` derivation. `DashboardContent` collapses to feeding the toolbar `hasPendingRerenderChanges={hasUnrenderedChanges}` (selection-only). The amber banner copy becomes "Selection changed -- click Render to update". `lastRenderedColorRevision` and `setLastRenderedColorRevision` are deleted from `render-store.ts`.
3. **Active-tab gate for the grid recompute.** `PlotGrid.plotsData` short-circuits to a `plotsDataRef` cache when `activeTab !== 'grid'`. The shadcn ColorPicker fires `onChange` continuously while the user drags, so per-frame recomputation of all 11 grid plots while the user is on the Interactive tab is wasted work. When the user tabs back to Grid, `activeTab` flips, the memo recomputes once with the latest store state, and the new colors land in a single frame. The interactive viewer renders one plot, so live per-frame propagation there is trivially affordable.

**Rationale:** Three small edits, net code shrinks. Color is cosmetic client-side state -- treating it like data that needs a server commit was the inverted priority. Per-event override behavior (pinned-only lifecycle) is unchanged because it was already correct after DEC-035.

**Alternatives considered:**
- Debounce / commit-on-release on the color picker -- rejected, kills the live preview that makes color matching pleasant and adds a code path the picker doesn't natively support.
- Per-view color scopes (interactive vs grid) -- rejected, two scopes mean two identities for the same program/version and inevitable drift between what the side-panel swatch shows and what the chart draws. The single shared identity is the entire point.
- Keep the amber banner flashing for color changes as an info-only indicator -- rejected, "click Render to update" is a lie when there is nothing to click and nothing to update.
- Per-frame recompute on both tabs -- rejected, the `plotCacheRef` short-circuit in `PlotGrid` checks `previous.getCurveColor === getCurveColor`, and after edit 1 that reference now changes every drag tick, so without the active-tab gate every color drag would recompute 11 hidden plots.

**Key files:** `client/src/hooks/use-curve-coloring.ts`, `client/src/components/dashboard/plot-grid/PlotGrid.tsx`, `client/src/components/dashboard/DashboardContent.tsx`, `client/src/stores/render-store.ts`.

**Follow-up (same day):** Edit 3's `activeTab` gate (`if (activeTab !== 'grid') return plotsDataRef.current`) was found to be dead code. `DashboardTabs` uses Radix `TabsContent` without `forceMount`, so `PlotGrid` is unmounted whenever the user is on a different tab and the gate's early-return branch is unreachable. Removed the `activeTab` subscription, the `plotsDataRef`, the early-return, and `activeTab` from the `plotsData` memo deps. Replaced with a comment documenting the unmount invariant. Cross-tab color propagation is unaffected because: (a) `cachedPlots` survives in `useRenderStore`, (b) on remount `useCurveColoring` reads the latest store state, and (c) the fresh `plotCacheRef` guarantees a full recompute with current colors. Per-frame thrash on color drags is also already prevented by the unmount itself (the inactive tab's subtree, including `PlotGrid`, doesn't exist in the React tree). If a future change introduces `forceMount` on the Grid tab, the gate must be reintroduced.

---

## DEC-037: Selection is scoped to the active dimension filter (2026-04-22)

**Context:** `LoadDataSection`'s toggle handlers append to `dataState.selected_event_ids` based purely on the user's click and never reconcile with the visible event set. When a user previously plotted events A, B, C, then applied a global filter that excluded them and selected D, E from the filtered tree, the session still held `[A, B, C, D, E]`. On Render, `PlotGrid` sent the entire array to the backend and A, B, C came back as plotted curves alongside D, E -- the user's filter intent was silently overridden. There was no place in the codebase that intersected `selected_event_ids` with the dimension-filter-passing event set, and the bug surfaced regardless of how carefully the user clicked through the filtered tree.

**Decision:** Establish a scoped contract for selection state and add a single reactive sync hook to enforce it. Concretely:

1. **Scoped selection.** `selected_event_ids` always equals "currently visible after dimension filters AND checked". When a dimension filter changes, IDs that no longer pass the filter are pruned from `selected_event_ids` immediately. Clearing the filter does NOT bring previously pruned IDs back -- the contract is "scope, then commit", not "remember everything ever clicked".
2. **Event-ID search is a find tool, not a filter.** `globalFilters.event_id_query` narrows what the LoadData tree displays but never causes pruning. `useEventCatalog` now strips `event_id_query` from the server request and applies the substring match client-side, so the server response (`allEvents`) reflects the dimension filters only and is the canonical pruning whitelist (`dimensionFilteredEventIds`). The tree view (`events`) is `allEvents` filtered client-side by the search.
3. **Grid stays as-is until next Render.** `rendered_event_ids` and `streamedPlots` are intentionally NOT pruned by the sync hook. After pruning `selected_event_ids`, `selected != rendered`, so the existing "Selection changed -- click Render to update" banner (`hasUnrenderedSelection` in `session-sync.ts`, surfaced in `PlotGrid.tsx`) automatically appears. The next Render click sets `rendered_event_ids = current selection` and `startSequentialFetch` calls `clearCachedPlots()`, so the new fetch carries the pruned payload only -- the bug is fixed without touching `PlotGrid` or its `plotCacheRef` memo.
4. **New hook `useFilterSelectionSync`.** Mounted once in `DashboardContent`. Subscribes to `dimensionFilteredEventIds` and prunes `dataState.selected_event_ids` whenever the whitelist changes. Guards: (a) waits for `isSessionReady && !isLoading` so the initial mount before the catalog returns does not wipe the persisted selection on page reload; (b) uses a `lastWhitelistRef` identity check so it runs once per catalog refresh, not on every render.

**Rationale:** Three small additive edits, no changes to the hot grid path. The dirty-state banner was specifically built to signal "your selection no longer matches the grid" -- reusing it is consistent with the existing UX model where Render is an explicit, deliberate action. Pruning `rendered_event_ids` and intersecting curves inside `PlotGrid.plotsData` was considered (Approach A in the plan) but rejected because it would extend the `PlotCacheEntry` cache key, add a new memo dep, and introduce a second source of truth for "what's plotted" (intersection layer on top of `streamedPlots`) for marginal "live update" benefit. Doing the search client-side is cheap (`useAllEvents` caps at 500) and gives a single-source-of-truth whitelist without an extra fetch. Initial-mount guards prevent the most plausible regression -- wiping a freshly hydrated session before the catalog query resolves.

**Alternatives considered:**
- Intersect curves with `renderedEventIdSet` inside `PlotGrid.plotsData` so the grid updates live on filter change -- rejected, more code, extends a hot memo, and unreachable the existing dirty banner.
- Auto-trigger a Render whenever pruning shrank the selection -- rejected, hides an implicit network call inside an unrelated user action and conflicts with the "Render is explicit" model.
- Run a parallel `useAllEvents` query without `event_id_query` to derive the whitelist -- rejected, double fetch for no gain over the cheap client-side substring filter.
- Treat `event_id_query` as a pruning trigger like the dimension filters -- rejected, the search box is a focus/find tool; pruning on each keystroke would aggressively destroy selections during typo correction.
- Make selection per-filter-view (restore previous selection when the filter is reverted) -- rejected, cross-view restoration adds invisible state with surprise behavior; "scope, then commit" is the simpler contract.

**Key files:** `client/src/hooks/use-event-catalog.ts`, `client/src/hooks/use-filter-selection-sync.ts` (new), `client/src/hooks/index.ts`, `client/src/components/dashboard/DashboardContent.tsx`.

---

## DEC-038: design-guidelines folder converted to invokable audit-and-align-ui skill (2026-04-23)

**Context:** The `.cursor/skills/design-guidelines/` folder previously documented an unrelated "Atmospheric Glass" weather design system (dark glassmorphism, Inter font, Material-3 tokens). It was a passive reference: no `SKILL.md` frontmatter, no audit/refactor workflow, and no relationship to the actual client UI. Meanwhile the real client (`client/src/app/globals.css`, `client/src/app/layout.tsx`, `client/src/components/ui/*`) had crystallized into a distinctive Apple-inspired light minimal system on Geist + shadcn + Tailwind v4 + Radix + lucide-react -- and the user wanted that system templated so other codebases could be brought into alignment with it.

**Decision:** Convert the folder into an invokable Cursor skill named `audit-and-align-ui` and formally designate the current `client/` as the canonical "Multimatic Workbench" template. Concretely:

1. **Skill shape.** Add `SKILL.md` with frontmatter (`name: audit-and-align-ui`, third-person description with WHAT and WHEN trigger terms) and a five-phase workflow: Discovery -> Audit -> Plan -> Approval -> Execute. Approval gate is mandatory before any file edit; execution lands in the working tree (no auto-commit, no PR).
2. **Stack-specific scope.** The skill targets Next.js + Tailwind v4 + shadcn + Radix + lucide-react codebases. Phase 1 (Discovery) halts and reports if the target stack does not match.
3. **Reference files (one level deep from `SKILL.md`):** `DESIGN.md` (canonical spec, frontmatter tokens + body sections), `theme.css` (portable Tailwind v4 `@theme inline` + `:root` + Proposed dark `:root.dark` snippet), `design_tokens.json` (DTCG-format export), `AUDIT.md` (13-category checklist with severity criteria + ripgrep recipes), `REFACTOR.md` (ordered playbook with before/after recipes per category).
4. **Token vocabulary.** Shadcn-only naming (mirrors `globals.css :root` 1:1). All Material-3 vocabulary (`surface`, `on-surface`, `tertiary-container`, etc.) removed. No per-component token blocks -- shadcn `cva` variants in `components/ui/*.tsx` are the source of truth for component shapes.
5. **Type ramp.** Replaced the unused M3 ramp (`display-lg`, `headline-md`, `body-lg`, `label-sm`) with semantic role -> Tailwind class string mappings (display, title, heading, card-title, section-title, body-lg, body, subtitle, caption, label).
6. **Expert UX additions.** Codified disciplined extensions of the existing aesthetic that the client implicitly follows but did not document: 5-level elevation hierarchy (flat / surface / raised / overlay / modal), z-index scale (9 layers), iconography rules (lucide-only, 5-step size scale), accessibility minimums (WCAG AA contrast, focus-visible spec, motion-reduce, 44x44 hit targets, ARIA conventions), form patterns (vertical layout, label-above-input, `space-y` rhythm), feedback state catalog (loading/empty/error/toast/notification-dot).
7. **Proposed dark palette.** Derived an Apple-style dark palette (iOS dark system colors: `#000`, `#1c1c1e`, `#2c2c2e`, `#8e8e93`, `#ff453a`, plus dark-shifted chart palette) and shipped it as a clearly-labelled "Proposed -- review before adding to globals.css" block in both `DESIGN.md` frontmatter and `theme.css`. Not yet wired into the client's `globals.css`.
8. **Tailwind config artifact.** Deleted `tailwind.config.js` from the skill folder (the client uses Tailwind v4 with `@theme inline` -- no JS config). Replaced with `theme.css` mirroring the real `globals.css` block byte-for-byte except for the documented omissions in (9).
9. **Charts scope.** Documented only `chart-1..5` tokens (iOS palette: `#1d1d1f`, `#34c759`, `#5856d6`, `#ff9500`, `#af52de`). The runtime curve-coloring system in `client/src/lib/chart-utils/color.ts` is intentionally outside the design token surface.

**Rationale:** A passive design doc that didn't match the codebase had zero discoverability and zero leverage. Converting it into a discoverable Cursor skill with an explicit audit/refactor workflow means the next codebase the team builds (or the next contractor brought on) can be brought into alignment in one session instead of a multi-week design review. Anchoring the skill to the existing `client/` (rather than inventing an aspirational new system) preserves the design choices the team already validated through use. The expert UX additions are disciplined -- they codify what the client already implicitly does (focus rings, lucide everywhere, semibold-not-bold weights, no glassmorphism) -- rather than introducing new aesthetics. High-freedom (text-only, no scripts) was chosen over codemods because token-mapping decisions often require semantic judgment that scripts can't make safely.

**Alternatives considered:**
- Keep the Atmospheric Glass content and add a SKILL.md wrapper around it -- rejected, the documented system was unrelated to the actual UI.
- Make the skill framework-agnostic (work on Vue, Svelte, plain CSS) -- rejected, the audit and refactor recipes depend heavily on shadcn primitives and Tailwind v4 mechanics; a generic skill would either be vague or maintain three implementations.
- Ship utility scripts (e.g. `audit-tokens.sh`, codemods for color swaps) -- rejected, token mapping requires semantic intent that grep-and-replace mishandles; a high-freedom text workflow lets the agent ask the user when ambiguous.
- Open a PR or file a GitHub issue automatically after the refactor -- rejected, leaving the working tree dirty respects the user's commit cadence and review workflow.
- Define dark tokens directly in `globals.css` now instead of as Proposed -- rejected, the live client is light-only and adding dark tokens without auditing every `dark:` class usage in the existing UI would risk silent visual regressions.

**Follow-ups:**
- Remove the legacy `.text-caption` (`--font-size-caption: 0.625rem`) and `.text-label` (`--font-size-label: 0.6875rem`) utilities from `client/src/app/globals.css` and migrate the 6 callsites (`PlotGrid.tsx`, `DatabaseOperationModal.tsx`, `SVGPlotCard.tsx`, `UploadContent.tsx`, `color-picker.tsx`, `PlotTooltip.tsx`) to the arbitrary-value form (`text-[10px]`, `text-[11px]`) from the role table. The skill's `DESIGN.md` and `theme.css` already reflect the desired end state; this task aligns the live client with the skill spec.
- Review the Proposed dark palette and decide whether to ship dark mode in the live client. If yes, copy the `:root.dark` block from `theme.css` into `client/src/app/globals.css` and audit all `dark:` Tailwind utility usage across `client/src/`.

**Key files:** `.cursor/skills/design-guidelines/SKILL.md` (new), `.cursor/skills/design-guidelines/README.md` (rewritten), `.cursor/skills/design-guidelines/DESIGN.md` (rewritten), `.cursor/skills/design-guidelines/design_tokens.json` (rewritten), `.cursor/skills/design-guidelines/theme.css` (new), `.cursor/skills/design-guidelines/AUDIT.md` (new), `.cursor/skills/design-guidelines/REFACTOR.md` (new), `.cursor/skills/design-guidelines/tailwind.config.js` (deleted).
---

## DEC-039: Cursor engineering skills use repo-local setup docs (2026-04-29)

**Context:** The repo needed Claude Code-oriented engineering skills adapted for Cursor agents, plus shared issue-tracker and domain-documentation configuration that those skills can read consistently.

**Decision:** Install the core workflow skills under `.cursor/skills/`, keep GitHub Issues as the default tracker via `gh`, use the default triage labels, and create a single-context domain documentation layout rooted at `CONTEXT.md` with setup details under `docs/agents/`.

**Rationale:** Repo-local skills and setup docs make the workflow portable across Cursor sessions without depending on Claude-specific slash-command or hook configuration. GitHub is already the configured remote, and a single root glossary matches the current project shape.

---

## DEC-040: RSP uploads convert through the existing CSV ingestion contract (2026-04-29)

**Context:** The Database upload panel accepted CSV files plus `channel_map.yaml/.yml`. Notebook work proved `.rsp` files can be decoded to the same tagged CSV shape (`#TITLES`, `#UNITS`, `#DATATYPES`, `#DATA`) already handled by the server parser, but the product decision was needed for plot mapping, artifact retention, and API shape.

**Decision:** Support direct `.rsp` uploads by converting them temporarily on the server and then reusing the existing CSV ingestion pipeline. Concretely:

1. `.rsp` uploads still require `channel_map.yaml/.yml`; the map remains the explicit source of plot-axis semantics.
2. Raw `.rsp` files and converted `.csv` files are not persisted under `data/`; conversion uses temporary files/bytes only.
3. The existing `POST /api/v1/upload/folder/start` endpoint and SSE task stream handle either all CSV or all RSP data files. Mixed CSV/RSP batches are rejected, unrelated folder contents are ignored.
4. The upload task phase vocabulary now includes `converting`, allowing the client to show the new step without adding a second task model.

**Rationale:** This keeps the first RSP implementation small and low-risk. The database write path, channel-map storage, validation, LTTB generation, auth, rate limiting, audit logging, and cache invalidation remain in the proven CSV ingestion flow. Auto-generating channel maps from RSP headers was rejected because recovered names do not guarantee correct dashboard plot semantics. Durable raw/converted artifacts were rejected for now because they add storage lifecycle and security surface before there is a concrete audit/reprocessing requirement.

**Alternatives considered:**
- Add a separate `/upload/rsp/start` endpoint -- rejected, it would duplicate the same auth/task/progress/upload plumbing for no behavioral difference.
- Persist `data/rsp_raw/{program}/{version}` and `data/raw/{program}/{version}` artifacts -- rejected for the first slice; temp-only conversion avoids cleanup, quota, ownership, and purge semantics.
- Auto-generate channel maps from converted column order/names -- rejected, convenient but likely to produce subtly wrong plot assignments.

**Key files:** `server/services/etl/rsp_converter.py`, `server/services/ingestion.py`, `server/routers/upload.py`, `server/models/upload.py`, `client/src/app/database/page.tsx`, `client/src/components/upload/UploadDataSection.tsx`, `client/src/hooks/use-upload.ts`, `client/src/lib/api/upload.ts`.

---

## DEC-041: Missing channel maps create retained pending artifacts (2026-04-29)

**Context:** Users need to upload CSV/RSP batches before a `channel_map.yaml` is available, see the program/version in Database and Edit Metadata, define the fixed plot mapping manually, and then process the retained files without re-uploading. This reverses DEC-040's temp-only conversion assumption because manual reprocessing is now a product requirement.

**Decision:** Store uploaded CSV bytes, and converted RSP-to-CSV bytes, under a managed filesystem artifact directory with DB metadata in `ingestion_artifacts`. Missing-map uploads complete as pending artifacts instead of failed tasks. The fixed 8-row channel-map editor saves zero-based `x_col`/`y_col` values, writes them to `dim_channel_map`, and processes retained artifacts automatically. Artifacts are retained indefinitely and included in Parquet ZIP export/import under `managed_artifacts/channel-map`.

**Rationale:** Filesystem-managed artifacts avoid storing large blobs in DuckDB while still preserving enough data to process pending uploads and reprocess existing uploads after a map edit. Keeping DB rows as the index gives ownership checks, warnings, preview metadata, and portable references. Export/import must move the managed files alongside table data so pending uploads do not become broken references after restore.

**Alternatives considered:**
- Require re-upload after saving a map -- rejected, it loses the main workflow benefit and fails for users who already uploaded large batches.
- Store artifacts as DuckDB blobs -- rejected, it simplifies portability but makes the database file grow with retained raw data and complicates large-file IO.
- Keep artifacts only until first successful processing -- rejected, map edits are allowed to reprocess existing retained files.

**Key files:** `server/storage/database.py`, `server/services/ingestion.py`, `server/routers/dashboard.py`, `server/services/upload_query.py`, `server/services/export.py`, `client/src/app/database/edit/page.tsx`, `client/src/components/upload/DatabaseEventTree.tsx`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`.

---

## DEC-042: Program/version deletes are hard scope deletes (2026-04-29)

**Context:** Pending no-channel-map uploads can create visible program/version rows without `dim_event` leaves, so the Database table's old event-ID-only soft delete could not remove them. Users also need a single action that fully removes a bad program or version, including retained artifacts and channel maps.

**Decision:** Add an authenticated hard-delete scope operation for either a whole program or a single program/version. The delete removes live events, raw and LTTB measurements, event custom field values, retained ingestion artifact rows, registered managed artifact files, and `dim_channel_map` rows. Admins may delete any scope. Write-enabled users may delete only when every event/artifact owner in the selected scope is their user ID; mixed ownership returns a 403 requiring admin help.

**Rationale:** Scope delete is intentionally separate from the existing event bulk soft-delete path because pending-only versions do not have event IDs and artifact retention makes "delete all of this version" broader than hiding events. File removal is driven only by paths registered in `ingestion_artifacts` and constrained to the managed artifact root.

**Key files:** `server/storage/database.py`, `server/routers/upload.py`, `server/models/upload.py`, `client/src/components/upload/DatabaseEventTree.tsx`, `client/src/app/database/page.tsx`, `tests/server/services/test_ingestion_service_status.py`.

---

## DEC-043: Dashboard selection requires a channel map (2026-04-29)

**Context:** After allowing pending uploads without `channel_map.yaml`, some program/version rows could still be selected in dashboard load-data state despite being non-plotable. This caused a mismatch between tree affordances and render intent.

**Decision:** Treat channel-map presence as the source of truth for selection eligibility in dashboard event metadata. Events with no map are marked `selectable_for_plotting=false`, version/program checkboxes are disabled when they have zero selectable descendants, and selected IDs are auto-pruned when catalog data marks them non-selectable.

**Rationale:** This keeps one consistent contract: if an item cannot be plotted, it cannot be checked or remain selected. Mixed programs still allow selecting mapped versions because batch actions operate only on selectable descendants.

**Key files:** `server/services/query.py`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`, `tests/server/services/test_ingestion_service_status.py`.

---

## DEC-044: Hide pending pseudo-events from dashboard leaves (2026-04-29)

**Context:** Pending-only versions use pseudo-event IDs (`__pending_channel_map__::program::version`) so they can be represented in the unified event catalog. The dashboard tree was rendering these raw IDs as leaf rows, which looked broken and implied selectable data even when the version was disabled.

**Decision:** Keep pseudo-events in backend catalog payloads for grouping and warning-state continuity, but do not render pseudo-event leaves in the dashboard tree UI. Also, ensure `/dashboard/events` explicitly passes `has_channel_map`, `missing_channel_map`, and `selectable_for_plotting` from query results so client defaults cannot re-enable selection.

**Rationale:** This preserves one data contract for backend grouping while preventing raw implementation IDs from leaking into UI. Passing flags through the router removes a fragile default-path bug that marked unmapped rows selectable.

**Key files:** `server/routers/dashboard.py`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`, `tests/server/services/test_ingestion_service_status.py`.

---

## DEC-045: Main webapp elements template includes frontend shell and backend auth contract (2026-05-04)

**Context:** The project already had reusable template documentation for the database table and design system, but not for the core app frame. The requested template needed to let junior developers and coding agents recreate the current `AppSidebar`/main navigation, login, changelog, generic settings surface, and lightweight user-management page. The users page depends on backend auth and admin-user endpoints, so a client-only template would leave agents without enough references to implement a working system.

**Decision:** Add `docs/templates/main-webapp-elements/` as a full template pack with `DESIGN.md`, `REFACTOR.md`, `AUDIT.md`, `SKILL.md`, and a local `reference/` copy of the canonical source files. The pack treats the main webapp elements as a client/server system: Next.js owns the visible shell and page composition, while FastAPI owns authentication, authorization, user lifecycle, persistence, audit logging, and tests. The settings guidance stays generic except for the explicitly documented `/settings/users` admin page and its `/api/v1/admin/users/*` backend contract.

**Rationale:** Future agents need a durable, evidence-backed reference that maps frontend components directly to backend routes and services. Documenting both sides prevents incomplete ports where the UI exists but admin guards, cookie auth, password hashing, or audit behavior are missing. Keeping settings generic preserves portability across projects while still capturing the current user-management implementation closely enough to recreate it.

**Alternatives considered:**
- Create a single architecture document only -- rejected, because the existing template system is more useful as a pack with design, audit, refactor, and skill entrypoints.
- Document only the client shell -- rejected, because the settings/users page cannot be implemented safely without backend auth and admin-user APIs.
- Turn settings into a broad framework -- rejected, because settings content is expected to vary project to project; only the shell and current users page should be canonical.

**Key files:** `docs/templates/main-webapp-elements/DESIGN.md`, `docs/templates/main-webapp-elements/REFACTOR.md`, `docs/templates/main-webapp-elements/AUDIT.md`, `docs/templates/main-webapp-elements/SKILL.md`, `docs/templates/main-webapp-elements/reference/`, `docs/tasks/P13-02.md`.

---

## DEC-046: Deepen Dashboard workspace and filter semantics modules (2026-05-15)

**Context:** The Dashboard architecture review found two high-leverage shallow clusters: client-side selection/filter/session behavior spread across hooks and server-side filter meaning split across query service, store methods, schema metadata, and utility helpers.

**Decision:** Introduce `client/src/modules/dashboard-workspace/` as the React-facing module for Dashboard selection/catalog/session rules, and `server/modules/filter_semantics/` as the server module for converting user filter input into validated filter plans. Keep SQL execution in query/storage code and keep the broad `UnifiedStore` split out of scope.

**Rationale:** These modules reduce what callers need to know while preserving route contracts and current UI behavior. The server plan improves consistency across event, program, and version filtering; the client workspace module moves selection pruning out of `DashboardContent` and gives the state rules a behavior-tested interface.

**Key files:** `client/src/modules/dashboard-workspace/`, `client/src/components/dashboard/DashboardContent.tsx`, `server/modules/filter_semantics/`, `server/services/query.py`, `server/storage/database.py`, `docs/architecture/dashboard-deepening.md`, `docs/tasks/P11-06.md`.

---

## DEC-047: Validate Parquet ZIP member paths before import extraction (2026-05-15)

**Context:** PR 3 data-safety review found that Parquet ZIP validation and background import extracted archive members by name before checking that the resulting paths stayed inside the managed temporary extraction root.

**Decision:** Add one shared ZIP member target guard in `server/services/export.py` and use it for both validation-time extraction and background import extraction. Reject absolute paths, parent-directory traversal, empty path components, and backslash-separated paths before writing any member to disk.

**Rationale:** Import packages are admin-only, but they still cross a file-system trust boundary. Validating member paths before extraction keeps malformed archives from writing outside managed temp directories and makes failed imports preserve the current database state.

**Alternatives considered:**
- Rely on `shutil.unpack_archive` for validation -- rejected because it hides the per-member path policy and differs from the custom background import extraction path.
- Validate only in the upload route -- rejected because `ExportService.start_import_task()` can be exercised directly in service tests and should own its own file-system safety invariant.

**Key files:** `server/services/export.py`, `tests/server/services/test_export_service.py`, `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`, `docs/tasks/P8-17.md`.

---

## DEC-048: Dashboard selection pruning is owned by workspace dimension whitelist (2026-05-15)

**Context:** Dashboard selection pruning existed in two places: the workspace module path and a local `LoadDataSection` effect. The local effect pruned from the search-filtered `events` list, which could mutate persisted `selected_event_ids` during `event_id_query` usage. This conflicted with the intended contract where Event-ID search is a find tool, not a pruning trigger.

**Decision:** Keep pruning ownership in the dashboard workspace flow only, fed by `useEventCatalog.dimensionFilteredEventIds`. Update the whitelist to include selectable events only (`selectable_for_plotting !== false`) and remove side-panel-local pruning logic from `LoadDataSection`.

**Rationale:** One pruning owner prevents contract drift and avoids accidental selection loss from transient UI search state. Filtering the workspace whitelist to selectable events keeps missing-channel-map/non-selectable IDs from surviving in persisted selection while still allowing those rows to render as disabled in the tree.

**Key files:** `client/src/hooks/use-event-catalog.ts`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`, `client/src/modules/dashboard-workspace/dashboard-workspace.test.ts`, `docs/tasks/P9-12.md`.

---

## DEC-049: DuckDB DDL facts live in the schema registry (2026-05-15)

**Context:** `server/schema.yaml` described dim tables and filter metadata, while `UnifiedStore._init_schema()` also created runtime tables, sequences, additive columns, indexes, and data backfills. `MigrationRunner` used the YAML path while app startup used a larger embedded DDL path, leaving schema ownership split across files.

**Decision:** Keep `server/schema.yaml` as the schema registry path and normalize it into the full declared DuckDB DDL registry. Use `SchemaLoader` plus `SchemaApplier` as the shared DDL application path for both `UnifiedStore` startup and `MigrationRunner`. Keep runtime data backfills in `_init_schema()` for this slice.

**Rationale:** A single declared schema source makes the database easier to explain and avoids future schema changes being added to the wrong place. Keeping `UnifiedStore` as the connection owner preserves the existing DuckDB locking and facade behavior while reducing schema entropy first.

**Alternatives considered:**
- Move the registry to `server/storage/schema_registry.yaml` immediately -- rejected for this slice to avoid unnecessary path churn.
- Split repositories first -- rejected because it would spread schema confusion across more files before fixing ownership.
- Add a schema doctor in the same slice -- deferred to keep the first implementation DDL-only and behavior-focused.

**Key files:** `server/schema.yaml`, `server/storage/schema_loader.py`, `server/storage/schema_applier.py`, `server/storage/database.py`, `server/storage/migrations.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-07.md`.

---

## DEC-050: Add declared-vs-live schema doctor classifications to migration diff (2026-05-15)

**Context:** DEC-049 intentionally deferred schema doctor reporting to keep the DDL-ownership slice narrow. After that refactor landed, `MigrationRunner.generate_migration_diff()` still only returned table-set differences (`missing_tables`/`extra_tables`) and could not classify table-level drift causes such as declared-vs-live type mismatches.

**Decision:** Extend `MigrationRunner.generate_migration_diff()` to produce a schema doctor report that compares declared tables/columns from `server/schema.yaml` against live DuckDB catalog columns and classifies each table as `OK`, `MISSING`, `TYPE_MISMATCH`, or `DRIFT`. Keep the existing compatibility fields (`tables_in_schema`, `tables_in_db`, `missing_tables`, `extra_tables`) for current CLI/script consumers while adding `doctor_report` and `doctor_summary`.

**Rationale:** This keeps the public migration diff entry point stable while making drift diagnosis actionable. Table-level statuses are easy for junior developers to read, and preserving existing fields avoids forcing a CLI contract migration in the same slice.

**Alternatives considered:**
- Add a separate new API and leave `generate_migration_diff()` unchanged -- rejected to avoid duplicating schema introspection logic and diverging reports.
- Report only per-column entries -- rejected for this slice because table-level classifications better match the requested statuses and CLI readability goals.

**Key files:** `server/storage/migrations.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-08.md`.

---

## DEC-051: Sequence post-doctor refactor slices as backfills -> startup ownership -> users/sessions repositories (2026-05-15)

**Context:** After DEC-049 and DEC-050, schema ownership and declared-vs-live reporting are in place, but `_init_schema()` still mixes structural DDL delegation with row-mutating backfills, and `UnifiedStore` still aggregates broad domain behavior in one module.

**Decision:** Continue the refactor in ordered, low-risk slices:
1. Extract row-mutating backfills into a dedicated backfill module invoked after schema apply.
2. Clarify startup schema mutation ownership in one path without changing runtime locking/connection behavior.
3. Start repository extraction with `users` then `sessions`, keeping `database.py` as the sole DuckDB connection owner.

**Rationale:** This sequence preserves a working app while reducing entropy in the highest-confusion zones first. It avoids broad rewrites and keeps each slice behavior-testable.

**Alternatives considered:**
- Split repositories immediately across all domains -- rejected due to higher blast radius while backfill/schema boundaries remain mixed.
- Introduce ORM/migration framework now -- rejected as unnecessary complexity for the current phased cleanup.

**Key files:** `docs/master-build-plan.md`, `docs/brainstorm/04_refactor_codebase/plan_v1.md`, `docs/brainstorm/04_refactor_codebase/database_script_overengineered_fix.md`, `.cursor/plans/schema-ddl-refactor_0f643c19.plan.md`.

---

## DEC-052: Startup data backfills extracted to dedicated module (2026-05-15)

**Context:** After DEC-049/DEC-050, `_init_schema()` still mixed schema-apply delegation with row-mutating startup backfill SQL. The next planned low-risk slice was to separate backfill ownership without changing startup behavior.

**Decision:** Move startup row backfills into `server/storage/data_backfills.py` via `apply_startup_backfills(conn)`, and call it from `UnifiedStore._init_schema()` immediately after `SchemaApplier(...).apply(conn)`.

**Rationale:** This isolates mutable data-fix logic from structural schema apply logic while preserving the existing call order, transaction scope, and idempotent behavior.

**Alternatives considered:**
- Keep backfill SQL inline in `_init_schema()` until startup ownership cleanup -- rejected to keep each refactor slice narrow and explicit.
- Move backfills into migration runner path now -- rejected for this slice because runtime startup behavior must remain unchanged before broader startup-path cleanup.

**Key files:** `server/storage/data_backfills.py`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-09.md`.

---

## DEC-053: Canonical startup storage mutation path in MigrationRunner (2026-05-15)

**Context:** Startup orchestration in `server/main.py` still handled schema mutation and store initialization as separate steps: `MigrationRunner.migrate_up()` followed by `UnifiedStore(...)`, where `UnifiedStore` re-ran schema apply + backfills. This worked, but ownership was split across startup code and store internals.

**Decision:** Add `MigrationRunner.initialize_store_for_startup()` as the canonical startup entry point. It now owns startup mutation order explicitly:
1. run `migrate_up()` for declared schema mutation,
2. construct `UnifiedStore` as the connection owner without schema re-apply,
3. run startup backfills.

`server/main.py` now uses this single entry point. `UnifiedStore` keeps default behavior for existing call sites and tests by retaining schema initialization on normal construction.

**Rationale:** This makes startup ownership easier to follow in one path while preserving existing runtime behavior and the current single-connection locking model.

**Alternatives considered:**
- Keep startup split across `main.py` and `UnifiedStore.__init__` -- rejected because it keeps mutation ownership implicit and duplicated.
- Move all mutation logic into `UnifiedStore` and remove migration runner startup use -- rejected because migration/version ownership already lives in `MigrationRunner`.

**Key files:** `server/main.py`, `server/storage/migrations.py`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-10.md`.

---

## DEC-054: Extract users/sessions repositories behind UnifiedStore facade (2026-05-15)

**Context:** After P11-09 and P11-10, startup mutation ownership was clearer, but `server/storage/database.py` still held many domain SQL blocks directly. The next low-risk slice in DEC-051 targeted `users` then `sessions` without changing ownership of DuckDB connections.

**Decision:** Add `server/storage/repositories/users_repository.py` and `server/storage/repositories/sessions_repository.py`, and delegate existing `UnifiedStore` public methods for those domains to repository instances.

**Rationale:** This creates a deeper, testable seam for low-risk domains while preserving the external `UnifiedStore` contract and keeping one connection/locking owner in `database.py`.

**Alternatives considered:**
- Extract all domains at once -- rejected due to higher blast radius.
- Move connection ownership into repositories -- rejected because the current concurrency model depends on a single owner and shared lock in `UnifiedStore`.

**Key files:** `server/storage/repositories/users_repository.py`, `server/storage/repositories/sessions_repository.py`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-11.md`.

---

## DEC-055: Monotonic data_version stored in _schema_metadata and bumped per committed write (2026-05-15)

**Context:** Phase 8 multi-user roadmap required a monotonic `data_version` counter before adding sync endpoints and frontend polling. The current storage layer had no central write-version indicator.

**Decision:** Store `data_version` in `_schema_metadata` and increment it once per successful `UnifiedStore.write_connection()` commit by default. Add `get_data_version()` for readers and allow explicit `bump_data_version=False` for non-mutating maintenance transactions.

**Rationale:** This gives one centralized, low-touch write version signal without introducing a new table or changing ownership of DuckDB connections. The counter now advances with committed writes and can be consumed by upcoming `/sync/version` work.

**Alternatives considered:**
- Add a dedicated `data_version` table -- rejected to avoid schema churn while `_schema_metadata` already exists for runtime metadata.
- Increment manually in each write method -- rejected because it is error-prone and easy to miss during future changes.

**Key files:** `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P8-03.md`.

---

## DEC-056: Add authenticated sync/version endpoint for data_version polling (2026-05-15)

**Context:** With `data_version` added in P8-03, multi-user synchronization needed a lightweight API surface that clients can poll to detect writes from other users and invalidate stale data.

**Decision:** Add `GET /api/v1/sync/version` under a new sync router. The endpoint requires authentication and returns the current monotonic `data_version` from storage.

**Rationale:** This provides a minimal, explicit contract for client polling without introducing websockets, push infrastructure, or broader protocol changes.

**Alternatives considered:**
- Expose the value through an existing router (e.g. `/info`) -- rejected to keep multi-user sync semantics isolated from general health/info metadata.
- Make endpoint public -- rejected; sync state is app data metadata and should remain within authenticated scope.

**Key files:** `server/routers/sync.py`, `server/main.py`, `tests/server/routers/test_sync_router.py`, `docs/tasks/P8-04.md`.

---

## DEC-057: Frontend sync/version polling invalidates sync-sensitive query groups (2026-05-15)

**Context:** After P8-03 and P8-04, backend write-version tracking existed but clients still relied on static stale windows and did not react to external writes from other users.

**Decision:** Add a frontend `useDataVersionSync()` hook that polls `/api/v1/sync/version` while authenticated and invalidates key dashboard query groups when `data_version` increases.

**Rationale:** Poll+invalidate is the smallest reliable cross-user synchronization mechanism for the current single-instance architecture, avoiding websocket complexity while reducing stale multi-user views.

**Alternatives considered:**
- Invalidate all queries on every poll -- rejected due to unnecessary churn and avoidable network load.
- Poll only on dashboard route mounts -- rejected to keep synchronization consistent across app surfaces that rely on shared query cache.

**Key files:** `client/src/hooks/use-data-version-sync.ts`, `client/src/app/providers.tsx`, `client/src/lib/api/sync.ts`, `client/src/lib/api/sync.test.ts`, `docs/tasks/P8-05.md`.

---

## DEC-058: Cache invalidation ownership split by cache group semantics (2026-05-15)

**Context:** Phase 8 write-path audit found that delete and metadata writes already invalidated event/program/version cache groups, but custom-field writes did not invalidate filter-options cache even though custom fields are projected into filter options.

**Decision:** Keep cache invalidation centralized in `QueryService` and add `invalidate_filter_option_caches()` as the explicit public method for writes that affect filter options. Dashboard custom-field mutation routes now call this method after successful writes.

**Rationale:** This keeps invalidation intent explicit and avoids sprinkling cache-key prefix knowledge across routers/services while preserving existing delete/metadata invalidation behavior.

**Alternatives considered:**
- Invalidate all cache groups on every write -- rejected due to unnecessary churn and increased cache miss load.
- Perform direct cache invalidation in each router with raw prefixes -- rejected to avoid duplicated, drift-prone cache-key coupling.

**Key files:** `server/services/query.py`, `server/routers/dashboard.py`, `tests/server/services/test_query_service_metadata.py`, `docs/tasks/P8-06.md`.

---

## DEC-059: Single-event metadata updates use optimistic concurrency tokens (2026-05-15)

**Context:** Phase 8 required protection against lost updates when multiple users edit the same event metadata. The existing `PUT /api/v1/dashboard/events/{event_id}/metadata` path accepted blind writes and could overwrite a newer edit.

**Decision:** Require `if_unmodified_since` on single-event metadata update requests and enforce the check atomically in storage by updating only when `dim_event.updated_at` still matches the caller-provided value (including `NULL` for never-updated rows). Return HTTP `409 Conflict` when the token is stale.

**Rationale:** This provides a minimal optimistic concurrency contract without adding locks or changing the existing connection model. The atomic SQL predicate prevents race windows between read and write.

**Alternatives considered:**
- Keep blind last-write-wins updates -- rejected because it can silently discard another user's edit.
- Add pessimistic locking -- rejected as unnecessary complexity for the current single-node DuckDB architecture.

**Key files:** `server/models/dashboard.py`, `server/services/query.py`, `server/storage/database.py`, `server/routers/dashboard.py`, `tests/server/services/test_query_service_metadata.py`, `tests/server/routers/test_dashboard_router.py`, `docs/tasks/P8-07.md`.

---

## DEC-060: Env-primary LAN HTTP deployment path (2026-05-15)

**Context:** Production deployment needed to stay lightweight for a trusted local network while removing friction from machine-specific ports, hostnames, CORS origins, secrets, and version/status visibility. Existing Dockerfiles were present, but Compose docs drifted from the repository and the client image default baked `localhost` as the API origin.

**Decision:** Make deployment configuration env-primary: `deployment/.env.production` owns machine-specific values and secrets, while YAML remains readable app defaults/templates. Implement the first production path as LAN HTTP with separate frontend/backend ports, explicit CORS origins, and `ALLOW_INSECURE_COOKIES=true` only for trusted internal networks. Keep the reverse-proxy/single-origin path as future optional hardening.

**Rationale:** This matches the current operational model with the fewest moving parts. Operators can deploy by editing one env file and running one script, while the app still fails fast on missing secrets and exposes app/database schema status for troubleshooting.

**Alternatives considered:**
- YAML-primary deployment config -- rejected because Docker/server operators expect env files for machine-specific values and secrets.
- Env-only runtime config -- rejected as a larger refactor from the existing YAML-backed settings model.
- Reverse proxy first -- deferred because it improves cookie/CORS ergonomics but adds another service and configuration layer.

**Key files:** historical `Dashboard/deployment/docker-compose.yml`, `Dashboard/deployment/.env.production.example`, `Dashboard/deployment/deploy.sh`, `Dashboard/deployment/README.md`, `.env.example`, `server/config.py`, `server/routers/info.py`, `client/Dockerfile`, `client/src/components/layout/VersionLabel.tsx`, `docs/tasks/P9-06.md`. Superseded by DEC-061.

---

## DEC-061: Canonical repo-level release bundle (2026-05-15)

**Context:** The repository had parallel deployment stories: the older `Dashboard/deployment/` build-on-host Compose path and the repo-level `Deployment/` release bundle that packages versioned images, release notes, checksums, and Windows/Linux deploy scripts. Keeping both made release instructions noisy and error-prone.

**Decision:** Make the repo-level `Deployment/` bundle the only supported production deployment path. Keep `AGENT.md` as the canonical agent release runbook, keep `Deployment/README.md` as the operator handoff guide copied into bundles, and remove the legacy `Dashboard/deployment/` assets.

**Rationale:** The release bundle has lower operator entropy: two handoff files, one required secret, one LAN URL, same-origin proxy routing, generated `RELEASE_NOTES.md`, and no per-host rebuild.

**Key files:** `AGENT.md`, `Deployment/release.sh`, `Deployment/build.sh`, `Deployment/docker-compose.yml`, `Deployment/.env.example`, `Deployment/scripts/deploy.sh`, `Deployment/scripts/deploy.ps1`, `Deployment/README.md`.

---

## DEC-062: Database portability transfers load data only (2026-05-19)

**Context:** The hidden Parquet ZIP portability flow exported and imported every DuckDB base table, including target-local users, sessions, saved filters, audit history, and admin custom-field configuration. The intended operator workflow is moving uploaded load data from a source host to a target host while retaining target admin-created accounts and configuration.

**Decision:** Repurpose the existing admin-only `/api/v1/export/database/parquet/*` flow as load-data portability. Exports include only events, measurements, channel maps, ingestion artifacts, event custom-field values, schema/load SQL, schema metadata, and managed channel-map artifacts. Imports replace target load data transactionally while preserving target-local account/configuration tables. DEC-063 supersedes the portable inclusion of ingestion artifacts and managed channel-map files.

**Rationale:** The feature was hidden in the UI, so changing semantics before exposure avoids maintaining two near-duplicate portability systems. The load-data boundary matches the operator requirement, keeps the UI simple, and reduces the risk of replacing production admin accounts during a host transfer.

**Alternatives considered:**
- Keep full-database portability and expose it with warnings -- rejected because it can replace target admin accounts.
- Add a second load-data endpoint family -- rejected to avoid duplicate API/UI paths and higher maintenance cost.
- Merge imported data into target load data -- deferred because conflict handling and artifact cleanup would add significant complexity.

**Key files:** `server/storage/database.py`, `server/services/export.py`, `server/routers/export.py`, `client/src/components/upload/DatabaseSidePanel.tsx`, `client/src/components/upload/DatabaseSection.tsx`, `client/src/components/upload/DatabaseOperationModal.tsx`, `client/src/hooks/use-database-operation.ts`, `Deployment/README.md`.

---

## DEC-063: Portable load-data exports omit retained upload artifacts (2026-05-19)

**Context:** DEC-041 kept missing-channel-map uploads reprocessable by retaining converted CSV bytes under `data/artifacts/channel-map`, and DEC-062 initially moved those files in Parquet ZIP portability. A production-sized export showed that a ~2 GiB ZIP could expand to roughly 24 GiB because retained raw/converted CSV artifacts dominated the archive footprint.

**Decision:** Treat retained upload artifacts as source-local operational state. Portable load-data exports include processed program, event, channel-map, measurement, and event custom-field tables, but exclude `ingestion_artifacts` and the `managed_artifacts/channel-map` filesystem tree. Imports clear target load data, ignore legacy `ingestion_artifacts` load statements, skip `managed_artifacts` members during ZIP extraction, and remove target retained artifact files after a successful replacement.

**Rationale:** Host-to-host portability is for transferring plottable load data, not preserving unfinished channel-map work. Excluding retained files keeps export ZIPs and extraction scratch space proportional to processed data while still preserving target users and configuration. Operators who need pending uploads on another host can complete channel-map setup before exporting or re-upload the raw files on the target.

**Alternatives considered:**
- Continue exporting retained artifacts -- rejected because raw artifact trees can dominate ZIP and extract size.
- Export only metadata rows without files -- rejected because it would create pending versions on the target that cannot be processed without re-upload.
- Add a second “full artifact backup” mode -- deferred because the current requirement is smaller portability, not archival raw-file backup.

**Key files:** `server/storage/database.py`, `server/services/export.py`, `tests/server/services/test_export_service.py`, `Deployment/README.md`, `docs/brainstorm/07_database_import/00_OVERVIEW.md`, `docs/tasks/P2-13.md`.

---

## DEC-064: Damage inspection calculates from DuckDB full-channel raw rows (2026-05-21)

**Context:** Inspect Damage needs per-event damage values for the first 21 RSP data channels. Existing `measurements_raw` stored only channel-map columns, while retained converted CSV artifacts contained the full source channels but are source-local operational state and are excluded from portable load-data exports.

**Decision:** Extend `measurements_raw` with nullable damage-channel metadata (`channel_key`, `channel_index`, `channel_unit`) and store the first 21 data channels as `Ch01`-`Ch21` during ingestion. Compute damage on demand through authenticated `/api/v1/damage/inspect` using the notebook-defined `py_fatigue` rainflow and DNV Curve C Palmgren-Miner method. Provide a one-time artifact backfill script for existing same-host uploads.

**Rationale:** DuckDB-backed calculation gives the feature one runtime source of truth and avoids normal operation depending on retained artifact paths. The backfill script covers existing uploads without adding a permanent hybrid DB-or-artifact query path.

**Alternatives considered:**
- Read retained converted CSV artifacts on every damage request -- rejected because artifacts are same-host staging material and excluded from portable exports.
- Add a persisted `damage_results` table -- deferred; v1 uses explicit compute-on-read to avoid stale result invalidation and background-job machinery.
- Share Dashboard plotted selection state with Inspect Damage -- rejected to avoid surprising cross-route side effects.

**Key files:** `server/services/fatigue_damage.py`, `server/routers/damage.py`, `server/schema.yaml`, `client/src/app/inspect-damage/page.tsx`, `scripts/backfill-fatigue-channels.sh`.

---

## DEC-065: Damage inspection channels are detected from load-channel headers (2026-05-22)

**Context:** Real RSP-converted CSV files can contain more than the original 21 damage columns, including force and moment headers such as `LCABushingF P_UG_X Momt` and `ShockLwBsh P_UG_Z Momt`. The fixed first-21 positional extraction dropped later load channels and the Inspect Damage UI exposed compact `ChNN` keys instead of readable source names.

**Decision:** Detect damage-inspection channels from parsed CSV/RSP titles by selecting source-order numeric columns from the data section whose cleaned title contains `P_UG_` and `Force` or `Momt`. Preserve compact source-order keys (`Ch01`, `Ch02`, ... `ChNN`) for storage/API lookup, but store and display cleaned source labels as `channel_name`. Retained-artifact backfill uses the same detector.

**Rationale:** Header-based detection keeps the implementation deterministic and simple while avoiding the incorrect 21-column cap. Keeping `ChNN` as an internal key preserves the existing row/cell API shape, while readable labels make the UI match the source data.

**Alternatives considered:**
- Keep exactly 21 channels and only improve labels -- rejected because source files contain valid load channels beyond column 21.
- Use semantic slug keys derived from headers -- rejected to avoid key churn and duplicate-name collision handling.
- Add a heavy fuzzy-matching dependency -- rejected because the current source headers have enough structure for deterministic matching.

**Key files:** `server/services/etl/transformer.py`, `server/services/ingestion.py`, `server/services/damage_backfill.py`, `client/src/app/inspect-damage/page.tsx`, `tests/server/services/test_data_transformer.py`.

---

## DEC-066: Inspect Damage derives from plot-channel mappings (2026-05-22)

**Context:** Inspect Damage only needs the 12 load channels used by the dashboard plot channel map: BJ X/Y/Z Force, Shock X/Y/Z Force, Bushing F X/Y/Z Momt, and Bushing R X/Y/Z Momt. The previous full-channel design added damage-only metadata columns to `measurements_raw` and re-read retained artifacts to populate every detected `P_UG_` force/moment channel, including channels not used for plotting.

**Decision:** Use `dim_channel_map` as the source of the 12 Inspect Damage channel definitions and `measurements_raw.channel_name` as the source of processed raw time-series values. Keep `ingestion_artifacts` only as staging/preview state for uploads without a channel map. Remove branch-only damage metadata columns (`channel_key`, `channel_index`, `channel_unit`) and the full-channel backfill path.

**Rationale:** The plot-channel model avoids a second damage-specific storage path, keeps RSP and CSV uploads flowing through the same parsed-header/raw-measurement model, and makes the channel map the single editable mapping source for both plots and Inspect Damage.

**Alternatives considered:**
- Keep full-channel damage storage and artifact backfill -- rejected as unnecessary for the plot-channel-only requirement and higher operational entropy.
- Add a channel-header registry table -- rejected because processed headers already live in `measurements_raw.channel_name`, while pending previews are operational staging.
- Infer damage channels from every distinct raw channel name -- rejected because Inspect Damage should use the fixed 12-channel map, not every stored channel.

**Key files:** `server/services/damage_channels.py`, `server/services/query.py`, `server/services/ingestion.py`, `server/storage/data_backfills.py`, `server/schema.yaml`, `client/src/app/inspect-damage/page.tsx`.

---

## DEC-067: Program-version metadata PUT requires write permission (2026-06-08)

**Context:** Phase 12 (P12-03) intended `require_write_or_admin` on program-version metadata mutations, but `PUT /api/v1/dashboard/program-version/metadata` still depended on `CurrentUserDep`. Read-only users blocked by the `/database/edit` route guard could update metadata via direct API calls. Channel-map save already used `WriteUserDep`.

**Decision:** Switch `update_program_version_metadata` to `WriteUserDep`. Service-layer ownership checks (`uploaded_by_user_id`, admin-only `status`) remain unchanged.

**Rationale:** Aligns the batch metadata endpoint with other write surfaces and closes the bypass without changing request/response contracts.

**Key files:** `server/routers/dashboard.py`, `tests/server/routers/test_dashboard_router.py`.

---

## DEC-068: Runtime database create/connect with health-gated switch (2026-06-09)

**Context:** Operators wanted a safer way to start a fresh database while preserving an existing populated one, plus an in-app method to reconnect to a specific database file for rollback. Existing portability endpoints handled load-data transfer but did not support runtime source switching.

**Decision:** Add two new database-management API actions on the export router:
- `POST /api/v1/export/database/create-new` (admin-only) requiring typed confirmation (`CREATE NEW DATABASE`) that creates `dashboard-<timestamp>.db`, initializes schema via migration startup flow, runs health checks, and switches runtime only after checks pass.
- `POST /api/v1/export/database/connect` (write user or admin) requiring typed confirmation (`CONNECT <database_name>`) for managed `dashboard*.db` files under `data_root`, with the same health-gated switch flow.

Expose matching frontend actions in the Database side panel: a new admin row above export for **Create New Database**, and **Connect Database** for write users/admins.

**Rationale:** This keeps the existing single-active-DB runtime model intact while adding explicit, confirmation-gated operational controls. Health checks before switch prevent runtime from binding to invalid files, and returning previous DB metadata provides immediate rollback guidance without mutating old database files.

**Alternatives considered:**
- Add runtime DB switching through settings/env only and require restarts -- rejected because it is slower and more error-prone for operators.
- Introduce full multi-database/project-manager architecture now -- deferred; current need is immediate safety and rollback, not multi-tenant orchestration.
- Allow unrestricted arbitrary path connection -- rejected for security and operational consistency; only managed `dashboard*.db` files are allowed.

**Key files:** `server/routers/export.py`, `client/src/lib/api/export.ts`, `client/src/components/upload/DatabaseSection.tsx`, `client/src/app/database/page.tsx`, `tests/server/routers/test_export_router.py`, `docs/brainstorm/15_create_new_db/prd.md`.

---

## DEC-069: Replace prompt-based DB switching with modal + searchable picker (2026-06-09)

**Context:** Initial runtime database create/connect shipped with browser prompt dialogs for file selection and typed confirmations. While functional, prompts were fragile for operator workflows and made it easy to mistype or select the wrong target without clear context.

**Decision:** Replace prompt interactions on the Database page with a dedicated shadcn dialog flow:
- one modal component for both create and connect actions,
- searchable managed-database list for connect,
- explicit expected-confirmation text shown in the UI,
- typed confirmation required before enabling submit.

Backend confirmation enforcement remains unchanged (`CREATE NEW DATABASE`, `CONNECT <database_name>`).

**Rationale:** Improves usability and reduces operator error while keeping the same backend safety guarantees and API contracts.

**Alternatives considered:**
- Keep browser prompts -- rejected due poor UX and higher mis-entry risk.
- Use non-searchable select only -- rejected because managed DB lists can grow and require fast filtering.

**Key files:** `client/src/components/upload/DatabaseSwitchDialog.tsx`, `client/src/app/database/page.tsx`, `client/src/components/upload/index.ts`.

---

## DEC-070: Runtime DB switch must bootstrap admin before activation (2026-06-09)

**Context:** Creating/switching to a fresh `dashboard-<timestamp>.db` could leave the runtime pointing at a database without an `admin` user row, causing immediate 401s and failed admin logins after switch.

**Decision:** During runtime DB initialization for create/connect flows, run `UserService.bootstrap_admin()` on the target store before health checks and before making it active.

**Rationale:** Aligns runtime switch behavior with process startup behavior (`main.py` lifespan), guaranteeing there is always an admin login path when `admin_secret` is configured.

**Alternatives considered:**
- Require manual `/auth/register` on each new DB -- rejected as operationally fragile.
- Switch first, then bootstrap -- rejected because failed bootstrap could leave runtime in a locked-out state.

**Key files:** `server/routers/export.py`, `tests/server/routers/test_export_router.py`.

---

## DEC-071: Modal-first Settings with User Management + Database panels (2026-06-09)

**Context:** Admin settings lived on a full-page route (`/settings/users`). Database transfer actions were on `/database`. The Context Engine UI reference uses a centered modal with a left nav rail.

**Decision:**
- Replace route-based settings navigation with a **global modal dialog** mounted in `providers.tsx`.
- Left nav routes: **User Management** (migrate P12 user CRUD) and **Database** (Transfer Data section only).
- Sidebar label renamed from "Admin settings" to **Settings**; opens dialog without URL change.
- Legacy `/settings/users` redirects to `/dashboard` and opens User Management panel (bookmark compatibility).
- Extract shared database create/connect logic into `useDatabaseSwitch` hook used by `/database` and settings Database panel.
- Use `@radix-ui/react-dialog` primitives directly for the shell (not shadcn `<Dialog>`).

**Rationale:** Keeps admins in context on their current page; consolidates admin configuration in one place; matches reference visual scaffold without adding Context Engine–specific panels (General, Knowledge Graph, Providers).

**Alternatives considered:**
- Keep full-page `/settings/users` -- rejected; does not match scaffold or consolidate Database admin actions.
- Include full `/database` page in settings -- rejected; upload/table UX belongs on Database route.
- General + Account nav labels from reference -- rejected; Dashboard uses User Management + Database per product language.

**Key files:** `client/src/components/settings/SettingsDialog.tsx`, `client/src/stores/settings-dialog-store.ts`, `client/src/components/layout/AppSidebar.tsx`, `docs/brainstorm/16_settings_dialogue/`.

---

## DEC-072: Typed confirmation only for database delete, not connect (2026-06-09)

**Context:** Connect Database required typing `CONNECT <filename>` before every switch. Operators found this friction unnecessary for a reversible, non-destructive action. Admins also needed a way to remove stale managed `dashboard*.db` files without manual filesystem access.

**Decision:**
- Remove typed confirmation from `POST /api/v1/export/database/connect`; selection + submit is sufficient.
- Add admin-only `POST /api/v1/export/database/delete` requiring typed confirmation `DELETE <filename>`.
- Block deletion of the currently active database; only non-active managed `dashboard*.db` files under `data_root` may be deleted.
- Expose delete in the Connect Database dialog for admins (trash icon per row, confirmation field shown only in delete mode).

**Rationale:** Reserve typed confirmation for irreversible destructive actions. Connect remains health-gated on the backend; delete gets the stronger guardrail.

**Key files:** `server/routers/export.py`, `client/src/components/upload/DatabaseSwitchDialog.tsx`, `client/src/hooks/use-database-switch.ts`, `tests/server/routers/test_export_router.py`.

---

## DEC-073: Portable artifact URI contract and source artifact ledger (DB14-00/DB14-01) (2026-06-09)

**Context:** DB14 lean source-of-truth work needs immutable retention of exact uploaded CSV/RSP bytes outside DuckDB, with checksums and portable references before canonical CSV derivation and ingestion-run linkage land in DB14-02.

**Decision:**

1. **Portable URI format:** `artifact://sources/<source_key>/<basename>` where `source_key` is `src_<sha256[:16]>` and basename is `original.csv` or `original.rsp`. Runtime resolves to `DATA_ROOT/artifacts/sources/<source_key>/<basename>`. Absolute host paths are not durable database truth.
2. **Ledger table:** `source_artifacts` stores `artifact_type`, full SHA-256 checksum, portable `artifact_uri`, ownership (`owner_user_id`), and `created_at` per program/version upload. Unique key: `(program_id, version, sha256)`.
3. **Checksum policy:** SHA-256 over exact uploaded bytes; full 64-char hex stored. Imports/exports in later DB14 slices must verify checksum before use.
4. **Storage service:** `SourceArtifactStorageService` is the only write path for original upload bytes; upload ingestion calls it instead of hand-building filesystem paths.
5. **Path safety:** Reject `..`, null bytes, backslashes, absolute paths, and unknown `artifact://` namespaces when resolving URIs.

**Examples:**

- CSV: `artifact://sources/src_a1b2c3d4e5f67890/original.csv` → `data/artifacts/sources/src_a1b2c3d4e5f67890/original.csv`
- RSP: `artifact://sources/src_feedface01234567/original.rsp` → `data/artifacts/sources/src_feedface01234567/original.rsp`

**Rationale:** Matches the DB14 PRD and architecture-design URI contract while keeping DB14-01 scoped to original uploads. Existing `ingestion_artifacts` retained converted CSV for pending channel-map work remains separate until DB14-02 links canonical derivation.

**Alternatives considered:**

- Store original bytes in DuckDB blobs — rejected; PRD defers large blob storage in the database.
- Reuse `ingestion_artifacts` only — rejected; mixes operational retained CSV with immutable source-of-truth semantics.

**Key files:** `server/services/source_artifact_storage.py`, `server/services/ingestion.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_source_artifact_storage.py`, `docs/tasks/DB14-01.md`.

---

## DEC-074: Canonical CSV derivation and ingestion-run linkage (DB14-02) (2026-06-09)

**Context:** DB14-01 retains immutable source uploads. DB14-02 needs CSV and RSP to converge on a shared canonical CSV processing path with auditable parser/conversion metadata and event lineage.

**Decision:**

1. **Derived artifact namespace:** Canonical CSV bytes use `artifact://canonical/can_<sha256[:16]>/canonical.csv`, resolved to `DATA_ROOT/artifacts/canonical/...`. Stored in `derived_artifacts` with `artifact_type=canonical_csv` and `source_artifact_id` linking back to the original upload.
2. **Ingestion runs:** `ingestion_runs` records one run per uploaded file, linking `source_artifact_id` and `derived_artifact_id`. Fields include `parser_name`, `conversion_kind` (`identity` for CSV, `rsp_converter` for RSP), row/column/warning counts, and JSON metadata (`app_version`, artifact URIs, parsed filename).
3. **Event lineage:** `event_ingestion_links` maps `event_id` → `ingestion_run_id` at event commit time. Query via `get_ingestion_run_for_event`.
4. **Convergence point:** After source artifact storage and file normalization, ingestion registers canonical CSV and creates the run before channel-map validation and event writes. Both CSV and RSP downstream processing use the same `parse_content` bytes.
5. **Portability:** `derived_artifacts`, `ingestion_runs`, and `event_ingestion_links` are excluded from load-data export like source artifacts until DB14-07 transfer package work.

**Rationale:** Keeps source truth (DB14-01) separate from derived canonical CSV while making lineage queryable without overloading `ingestion_artifacts`, which remains the operational pending-channel-map retention path.

**Key files:** `server/services/derived_artifact_storage.py`, `server/services/ingestion.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_derived_artifact_storage.py`, `tests/server/services/test_ingestion_service_status.py`, `docs/tasks/DB14-02.md`.

---

## DEC-075: Channel-map snapshot normalization and event lineage (DB14-03) (2026-06-09)

**Context:** DB14-02 links events to ingestion runs and canonical CSV. DB14-03 needs YAML and UI channel-map authoring to normalize into one snapshot model with provenance, one active snapshot per program/version, and immutable per-event snapshot references.

**Decision:**

1. **Normalized snapshot shape:** Both authoring paths produce canonical JSON `{ "plots": [...] }` with stable plot ordering (sorted by `plot_key`), column indices, scale factors, and units. SHA-256 identifies content; `authoring_source` records `yaml` or `ui` without changing the runtime shape.
2. **Artifact storage:** Snapshot bytes use `artifact://snapshots/snap_<sha256[:16]>/channel_map_snapshot.json`, resolved under `DATA_ROOT/artifacts/snapshots/`. Rows live in `channel_map_snapshots`; dedupe key is `(program_id, version, snapshot_sha256)`.
3. **Active snapshot:** `active_channel_map_snapshots` holds one `(program_id, version)` → `snapshot_id` pointer replaced on each new map save or ingest with a map.
4. **Event lineage:** `event_ingestion_links.channel_map_snapshot_id` stores the snapshot used when measurement/LTTB rows were derived. Later map edits create new snapshots and update the active pointer without rewriting historical event links.
5. **Portability:** Snapshot tables are excluded from load-data export/import like other DB14 lineage tables until DB14-07 transfer package work.

**Rationale:** Keeps `dim_channel_map` as the editable active view while snapshots provide immutable lineage for derived data and future reprocessing.

**Key files:** `server/services/channel_map_snapshot.py`, `server/services/ingestion.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_channel_map_snapshot.py`, `docs/tasks/DB14-03.md`.

---

## DEC-076: Event preview metadata from canonical CSV (DB14-04) (2026-06-09)

**Context:** DB14-02 canonical CSV and DB14-03 channel-map snapshots give each event queryable lineage. DB14-04 needs lightweight preview metadata for UI/debugging without duplicating full upload bytes in DuckDB.

**Decision:**

1. **Storage:** `event_previews` holds one row per `event_id` with structured `preview_json` (VARCHAR). No filesystem artifact for previews in this release.
2. **Derivation:** `EventPreviewService.derive_from_canonical_csv` parses canonical CSV bytes via `CSVParser`, samples up to 20 data rows from the `#DATA` section, and records headers, units (aligned to column count), row/column counts, parser validation warnings, source/canonical artifact URIs, `source_filename`, and `conversion_kind`.
3. **Ingestion hook:** Preview is stored at event commit in both direct ingest and retained-artifact processing, using ingestion-run metadata for artifact references.
4. **Portability:** `event_previews` is excluded from load-data export/import until DB14-07 transfer package work.

**Rationale:** Keeps previews derived from the same canonical CSV path for CSV and RSP while bounding DuckDB payload size. `ingestion_artifacts.preview_json` remains the operational pending-channel-map editor preview; `event_previews` is the durable per-event contract.

**Key files:** `server/services/event_preview.py`, `server/services/ingestion.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_event_preview.py`, `docs/tasks/DB14-04.md`.

---

## DEC-077: Measurement/LTTB derived-data lineage and stale handling (DB14-05) (2026-06-09)

**Context:** DB14-03 links events to channel-map snapshots and DB14-02 links events to canonical CSV via ingestion runs. DB14-05 needs explicit derived-data lineage for measurements and LTTB rows, plus stale marking when the active snapshot changes for Pending events without silently mixing incompatible mappings.

**Decision:**

1. **Lineage table:** `event_derived_data` stores one row per event with `ingestion_run_id`, `derived_artifact_id` (canonical CSV), `channel_map_snapshot_id`, and status fields for measurements and LTTB (`current`, `stale`, `absent`).
2. **Data kinds:** `measurements_data_kind=full_resolution_canonical` and `lttb_data_kind=plot_only` document that raw measurement rows are canonical full-resolution analytical data, while LTTB rows are plot-only derived data.
3. **Commit hook:** `DerivedDataLineageService.record_commit` runs at event commit after measurements/LTTB inserts in both direct ingest and retained-artifact reprocess paths.
4. **Stale policy:** When the active channel-map snapshot changes, Pending events in the same program/version whose linked snapshot differs are marked `stale`. Approved/Obsolete events keep `current` status and immutable snapshot references.
5. **Regeneration:** `save_channel_map_and_process_artifacts` regenerates LTTB from canonical measurements; re-commit sets LTTB status back to `current` with the new snapshot while preserving raw measurement status.
6. **Portability:** `event_derived_data` is excluded from load-data export/import until DB14-07 transfer package work.

**Rationale:** Keeps lineage queryable at the derived-data layer without denormalizing millions of measurement rows, and limits stale marking to Pending events so historical lineage stays immutable.

**Key files:** `server/services/derived_data_lineage.py`, `server/services/ingestion.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_derived_data_lineage.py`, `docs/tasks/DB14-05.md`.

---

## DEC-078: Version-scoped durability schedule attachment (DB14-06) (2026-06-09)

**Context:** DB14 PRD requires one active durability schedule per program/version with checksum, parse preview metadata, owner/admin attach permissions, event inheritance, and auditable replacement without per-event overrides or full history manager.

**Decision:**

1. **Artifact storage:** Original `.sch` bytes use `artifact://schedules/sch_<sha256[:16]>/schedule.sch`, resolved under `DATA_ROOT/artifacts/schedules/`. Rows live in `durability_schedule_artifacts`; dedupe key is `(program_id, version, schedule_sha256)`.
2. **Active attachment:** `active_durability_schedules` holds one `(program_id, version)` → `schedule_id` pointer replaced on each attach. Prior artifact rows remain for audit; replacement updates the active pointer only.
3. **Parse preview:** Server parses autodam `.sch` (`*id`, `*multiplier`, `*pattern* repeats weight`) into lightweight JSON (`schedule_id`, `multiplier`, `entry_count`, `entries_preview` capped at 5 rows).
4. **Permissions:** Attach/replace uses `WriteUserDep` plus `user_can_edit_program_version` (owner or admin). Schedule artifact owners also grant edit rights for schedule-only versions.
5. **Event inheritance:** `get_durability_schedule_for_event` resolves the active schedule via the event's `program_id` + `version` without per-event duplication.
6. **Audit:** First attach logs `DURABILITY_SCHEDULE_ATTACHED`; replacement logs `DURABILITY_SCHEDULE_REPLACED` with previous and new schedule IDs. Re-attaching identical bytes when the same schedule is already active is a silent no-op (no audit row).
7. **Portability:** Schedule tables excluded from load-data export/import until DB14-07 transfer package work.

**Rationale:** Mirrors the channel-map snapshot pattern (immutable artifact rows + active pointer) while keeping schedule parsing encapsulated in a small service and API boundary.

**Key files:** `server/services/durability_schedule.py`, `server/routers/dashboard.py`, `server/schema.yaml`, `server/storage/database.py`, `tests/server/services/test_durability_schedule.py`, `tests/server/routers/test_durability_schedule_router.py`, `docs/tasks/DB14-06.md`.

---

## DEC-079: Transfer package export/import with artifact validation (DB14-07) (2026-06-09)

**Context:** DB14-01 through DB14-06 introduced source artifacts, canonical CSV, snapshots, previews, derived-data lineage, and durability schedules. Each slice excluded lineage tables from load-data portability until a transfer package could carry artifact bytes and validate integrity on import.

**Decision:**

1. **Package format:** Admin export produces a ZIP with `manifest.json`, Parquet tables for all `LOAD_DATA_TABLES`, and an `artifacts/` tree mirroring portable `artifact://` URIs (`artifacts/sources/...`, `artifacts/canonical/...`, `artifacts/snapshots/...`, `artifacts/schedules/...`).
2. **Manifest contract:** `package_type=analysis_dashboard_transfer_package`, `package_version=1.0`, app/schema version metadata, and per-artifact entries with `artifact_uri`, `package_path`, `sha256`, and `artifact_class` (`source`, `canonical`, `snapshot`, `schedule`).
3. **Validation policy:** Import validation is non-destructive and runs before database replacement. Reject missing manifest entries, checksum mismatches, and ledger references to artifacts absent from the package. Source and schedule checksum mismatches are explicit failure cases.
4. **Legacy coexistence:** Archives without `manifest.json` continue through the existing load-data-only path (`LOAD_DATA_PORTABILITY_TABLES`). `UnifiedStore.export_to_parquet()` / `import_from_parquet()` default to legacy tables; transfer package passes `tables=LOAD_DATA_TABLES`.
5. **Service boundary:** `TransferPackageService` owns manifest build/validate, artifact bundling, and artifact installation. `ExportService` delegates admin export/import to it when a manifest is present.

**Rationale:** Preserves source truth and lineage across hosts while keeping validation deterministic and separate from UI. Legacy load-data archives remain importable during transition.

**Key files:** `server/services/transfer_package.py`, `server/services/export.py`, `server/storage/database.py`, `tests/server/services/test_transfer_package.py`, `tests/server/services/test_export_service.py`, `docs/tasks/DB14-07.md`.

---

## DEC-080: Folder upload completion uses task polling instead of SSE (2026-06-09)

**Context:** P2-11 introduced SSE (`GET /upload/folder/events/{task_id}`) over DuckDB `upload_tasks` rows. Large folder ingests could finish server-side while the browser reported `"Upload stream error"` because the SSE connection dropped (auth redirect, page navigation, or transient network loss). Parquet import (P14-07) already solved the same class of problem with GET task polling and retry/backoff.

**Decision:**

1. **Poll endpoint:** Add `GET /api/v1/upload/folder/task/{task_id}` returning the same `UploadTaskEvent` payload as SSE, creator-scoped.
2. **Client waiter:** Replace `EventSource` in `use-upload.ts` with `waitForUploadTask` polling every 2s, retrying transient gateway/network errors for up to 60 minutes.
3. **SSE retained:** Keep the SSE route for backward compatibility; the client no longer depends on it.
4. **Upload guards:** Track `folderUploadInProgress` in the UI store; defer hard auth redirects and pause `sync/version` polling while a folder upload is active.

**Rationale:** Task rows were always the source of truth (DEC-022); polling exploits that durability without adding Redis or WebSockets. Deferring auth redirect prevents a common failure mode where ancillary 401s tear down the database page mid-ingest.

**Key files:** `server/routers/upload.py`, `client/src/lib/api/upload.ts`, `client/src/hooks/use-upload.ts`, `client/src/stores/ui-store.ts`, `client/src/stores/auth-store.ts`, `client/src/hooks/use-data-version-sync.ts`, `tests/server/routers/test_upload_router.py`, `client/src/lib/api/upload.test.ts`.

---

## DEC-081: Clear runtime query cache on database connect (2026-06-09)

**Context:** `POST /export/database/connect` swapped `app.state.db` but left `app.state.cache` populated. `QueryService` cache keys (`program_ids`, `versions`, etc.) are filter-scoped, not database-scoped, so Edit Metadata and other views could show program/version lists from the previous database until TTL expiry.

**Decision:**

1. **Server:** After a successful active-database swap, call `SimpleCache.clear()` on `app.state.cache`.
2. **Client:** On successful connect, invalidate shared database-data React Query keys before reload; remove the 5-minute `staleTime` override on Edit Metadata program/version queries.
3. **Shared invalidation list:** Centralize keys in `DATABASE_DATA_INVALIDATION_KEYS` for metadata saves, database connect, and `data_version` sync.

**Rationale:** Database identity is a process-level concern; cache entries must not outlive the active store. Client invalidation covers SPA navigation paths that do not hard-reload.

**Key files:** `server/routers/export.py`, `client/src/lib/metadata-save-cache.ts`, `client/src/hooks/use-database-switch.ts`, `client/src/app/database/edit/page.tsx`, `client/src/hooks/use-data-version-sync.ts`, `tests/server/routers/test_export_router.py`.

---

## DEC-082: Reset in-memory session identity on auth boundary (2026-06-10)

**Context:** After client-side login, the dashboard side panel could remain on skeleton placeholders until a full page refresh. Login cleared `localStorage` session keys but left module-level `sharedSessionId` and React Query `['session', …]` cache entries from the pre-auth SPA lifetime. Client navigation preserved that stale state; full reload reset it.

**Decision:**

1. **Extract `session-identity.ts`:** Owns `sharedSessionId`, create dedupe promise, listener pub/sub, and `resetClientSessionIdentity()`.
2. **Auth boundary wipe:** `clearClientSessionStorage()` (login, register, logout, force-unauthenticated) resets in-memory identity and invalidates cached session queries via a provider-registered callback.
3. **Bootstrap guard:** `bootstrap()` no longer overwrites an already-authenticated store if its in-flight `/me` resolves stale after a successful login.
4. **Session recreate:** Auto-create also triggers on 403 session fetch failures, not only 404.

**Rationale:** Session identity must be reset at the same boundary as persisted storage. Query invalidation is explicit on auth transitions only (not bootstrap refresh) to avoid wiping valid sessions on every page load.

**Key files:** `client/src/lib/session/session-identity.ts`, `client/src/hooks/use-session.ts`, `client/src/stores/auth-store.ts`, `client/src/app/providers.tsx`.

**Follow-up (2026-06-10):** First login could still show side-panel skeletons because session creation ran only after dashboard mount (React effect race) and stale bootstrap `/me` 401s dispatched global logout events. Login/register now `await ensureUserSession()` before navigation; session commits in module scope via `commitCreatedSession()`; bootstrap `/me` is abortable and uses `suppressAuthEvent`; query-client registration happens synchronously in `getQueryClient()`.

**Additional key files:** `client/src/lib/session/ensure-user-session.ts`, `client/src/lib/api/client.ts`, `client/src/hooks/use-all-events.ts`, `client/src/app/dashboard/page.tsx`.

---

## DEC-083: Durability schedule edit save contract (DSC-19-04) (2026-06-10)

**Context:** DB14-06 attached immutable `.sch` artifacts with parse preview JSON. Analysts need to correct auto-matched rows without re-uploading schedule files.

**Decision:**

1. **PUT** `/api/v1/dashboard/program-version/schedule` updates `parse_preview_json` on the **active** artifact row only; `.sch` bytes at `artifact://schedules/...` stay immutable.
2. **Saved state** lives in preview fields: `event_rows[]`, `multiplier`, optional `delimiter_token`. Original parsed `entries` from `.sch` are preserved.
3. **Display rule:** GET with non-empty `event_rows` hydrates the UI; otherwise client builds rows from `entries` + events (v2 matcher).
4. **Auth/audit:** Same owner/admin write guard as attach; successful save logs `DURABILITY_SCHEDULE_EDITED`.

**Rationale:** Keeps DEC-078 storage model; edits are metadata corrections traceable separately from attach/replace.

**Key files:** `server/services/durability_schedule.py`, `server/routers/dashboard.py`, `client/src/app/database/edit/page.tsx`, `docs/tasks/DSC-19-04.md`, `docs/tasks/DSC-19-05.md`.

---

## DEC-084: Host-local identity store for runtime database switching (2026-06-10)

**Context:** Runtime database create/connect (DEC-068 through DEC-070) kept the app's single-active-dashboard-DB model, but auth users also lived inside each swappable `dashboard*.db`. Switching to a fresh or unrelated database invalidated JWT subjects, required users to be re-added per database, and forced cumbersome re-login/recreate-account workflows.

**Decision:** Add a host-local `identity.db` as the runtime source of truth for auth users. `AuthService` and `UserService` read/write this identity store; dashboard data services and `SessionManager` remain bound to the active `dashboard*.db`. Startup migrates legacy users from managed dashboard databases into `identity.db`, preferring the active database on username conflicts, and remaps known `user_id` reference columns to the selected global user IDs. Dashboard `users` tables remain as deprecated compatibility data for now.

**Rationale:** This preserves the existing runtime database switching model while removing per-database account duplication. It keeps only credentials/roles/write permissions global; dataset-scoped sessions, saved filters, audit rows, custom fields, and load data stay with the dashboard database. Load-data portability semantics remain unchanged and do not transfer auth users across hosts.

**Alternatives considered:**
- Copy users into every database during create/connect -- rejected because user rows would drift and every switch would remain a synchronization problem.
- Rebind JWTs by username only -- rejected because it avoids some 401s but does not solve duplicate user management.
- Move all operator state into the identity store -- rejected because sessions, saved filters, audit, and custom fields are dataset-scoped in the current product model.

**Key files:** `server/storage/identity.py`, `server/main.py`, `server/dependencies.py`, `server/services/auth.py`, `server/services/user.py`, `server/routers/export.py`, `tests/server/routers/test_export_router.py`, `tests/server/storage/test_identity_store.py`.

## DEC-085: Scope delete uses blocking operation modal (2026-06-10)

**Context:** Program/version hard-deletes can take minutes via synchronous API calls. The Database page gave no feedback until a background refetch spinner appeared.

**Decision:** Reuse the import/export operation-modal pattern for scope deletes: confirm step with scope summary (from cached `program_versions` aggregates), blocking progress step with indeterminate phased labels, and summary step with counts and elapsed time. Delete execution stays synchronous; phase text advances client-side per scope. Post-delete refresh keeps the tree visible and shows a subtle toolbar refresh indicator.

**Key files:** `client/src/features/database-scope-delete/*`, `client/src/hooks/use-scope-delete-operation.ts`, `client/src/app/database/page.tsx`.

---

## DEC-086: Compact status icons for dialogs (2026-06-10)

**Context:** Upload, delete, and database transfer dialogs mixed compact header icons with oversized standalone completion/error icons. The larger failure glyphs competed with dialog title and body text, especially in compact operation summaries.

**Decision:** Standardize modal-level status icons on a 32px circular badge with a 16px Lucide glyph. Success, warning, progress, and destructive states share the same geometry; semantic color is applied to the glyph instead of increasing icon size. Reserve 40px icons for page-level empty or loading states.

**Rationale:** The app's design language favors restrained hierarchy, grayscale surfaces, and minimal decoration. A single compact dialog icon scale keeps operation dialogs visually calm and makes failure states clear without dominating the content.

**Key files:** `DESIGN.md`, `client/src/features/database-upload/UploadOperationModal.tsx`, `client/src/features/database-scope-delete/ScopeDeleteOperationModal.tsx`, `client/src/components/blocks/dialog/scope-delete-summary-panel.tsx`, `client/src/components/upload/DatabaseOperationModal.tsx`.

**Follow-up (2026-06-10):** Dialog summaries no longer repeat the header title. The header owns the state label; the summary body starts with explanatory message text and then metadata.

---

## DEC-087: Edit Metadata panel boundary for inline dialog (2026-06-10)

**Context:** The Database Metadata Edit Dialog (DMD-20) needs the existing Edit Metadata workflow inside a modal without duplicating draft/save logic. The full-page `/database/edit` route must remain unchanged for users who prefer the side-panel workflow.

**Decision:** Extract `EditMetadataPanel` as the shared boundary: it accepts an external `{ programId, version }` scope, owns metadata draft/query/save behavior, and reports selection summary + activity state upward via optional callbacks. The route wrapper retains side-panel selection and other tabs (Assign Channels, Durability Schedule).

Pure draft initialization and save-enablement rules live in `features/edit-metadata/lib/` for focused unit tests.

**Rationale:** One panel serves both the route and the upcoming modal (DMD-20-02). Scope is injected so the panel never depends on route-side selection UI.

**Key files:** `client/src/components/edit-metadata/EditMetadataPanel.tsx`, `client/src/features/edit-metadata/lib/build-program-version-draft.ts`, `client/src/features/edit-metadata/lib/metadata-save-state.ts`, `client/src/app/database/edit/page.tsx`.

---

## DEC-088: Metadata edit dialog dirty-close and pending scope (2026-06-10)

**Context:** DMD-20-03 requires the inline metadata dialog to avoid silently discarding dirty edits, support opening another version row while the dialog stays open, and keep save/permission behavior aligned with the full-page Edit Metadata route. No app-wide unsaved-changes primitive existed.

**Decision:** `EditMetadataPanel` reports dirty state upward via `onDirtyChange` and accepts `canWrite`. `MetadataEditDialog` intercepts Radix close/Escape/overlay requests and shows a nested discard `AlertDialog` when dirty. `metadata-edit-dialog-store` queues `pendingScope` when `openMetadataEditDialog` is called while already open; the dialog auto-applies a clean pending scope or prompts before switching when dirty.

**Rationale:** Keeps draft/save logic in the shared panel (DEC-087) while the modal shell owns navigation safety. Pure helpers in `features/edit-metadata/lib/` keep close/prompt copy unit-testable without DOM interaction.

**Key files:** `client/src/components/edit-metadata/MetadataEditDialog.tsx`, `client/src/stores/metadata-edit-dialog-store.ts`, `client/src/features/edit-metadata/lib/metadata-dialog-close.ts`, `client/src/features/edit-metadata/lib/metadata-discard-prompt.ts`.

---

## DEC-089: Cross-section metadata dialog dirty-close and channel-map save refresh (2026-06-10)

**Context:** DMD-21-03 extends the DMD-20-03 dialog shell with Assign Channels. Channel-map edits must participate in dirty-close and pending scope-change prompts, and successful saves must refresh Database table indicators without a manual reload.

**Decision:** `isMetadataDialogDirty(metadataDirty, channelMapDirty)` combines section dirty flags for close/scope decisions. Discard prompt copy uses generic "unsaved changes" language. Channel-map saves use `saveProgramVersionChannelMap` and `invalidateQueriesAfterChannelMapSave`, which invalidates `channel-map-editor` plus the same database-data query keys used after metadata save (`DATABASE_DATA_INVALIDATION_KEYS`).

**Rationale:** Reuses the established modal safety model from DEC-088 without section-specific prompt branches. Centralizing channel-map invalidation ensures Database table, Dashboard filters, and Edit Metadata workflow stay consistent after dialog saves.

**Key files:** `client/src/lib/channel-map-save-cache.ts`, `client/src/features/edit-metadata/lib/channel-map-save.ts`, `client/src/features/edit-metadata/lib/metadata-dialog-close.ts`, `client/src/components/edit-metadata/AssignChannelsPanel.tsx`.

---

## DEC-090: Scoped channel-map YAML upload shares retained-artifact processing core (2026-06-10)

**Context:** DMD-22-01 adds an Assign Channels **Upload** path for existing `channel_map.yml` / `channel_map.yaml` files on a selected program/version. The product requires the same parsing, normalization, persistence, and retained-artifact processing as manual UI save and Upload Data YAML ingestion — without a second frontend YAML parser or duplicated event-rewrite logic.

**Decision:** Add `POST /api/v1/dashboard/program-version/channel-map/upload` (form: `program_id`, `version`, `channel_map` file) guarded by the same write/ownership rules as manual save. `IngestionService.upload_channel_map_yaml_and_process_artifacts` loads YAML via `ChannelMapLoader`, validates against the fixed eight-plot contract, and calls a shared `_persist_channel_map_and_process_artifacts` helper also used by `save_channel_map_and_process_artifacts`. Client upload uses `uploadProgramVersionChannelMap` and reuses `invalidateQueriesAfterChannelMapSave`. Basename helpers live in `server/utils/channel_map_file.py` and `features/edit-metadata/lib/channel-map-file.ts`.

**Rationale:** One processing core keeps snapshot lineage, dim_channel_map upserts, and artifact reprocessing consistent across UI save and YAML upload. Scoped form upload mirrors the durability schedule attach pattern; server-side YAML parsing preserves normalization authority.

**Key files:** `server/services/ingestion.py`, `server/routers/dashboard.py`, `client/src/features/edit-metadata/lib/channel-map-upload.ts`, `client/src/components/edit-metadata/ChannelMapUploadDialog.tsx`.

---

## DEC-091: Channel-map upload guardrails enforce exact single-file contract (2026-06-10)

**Context:** DMD-22-02 hardens the Assign Channels upload popup into a channel-map-only correction path. The happy-path upload from DEC-090 accepted valid filenames, but guardrails needed explicit behavior for folder selections and multipart bypass attempts with duplicate `channel_map` fields.

**Decision:** Keep basename validation (`channel_map.yml` / `channel_map.yaml`, case-insensitive) and make the same single-file rule authoritative on both client and server. Client selection now validates exactly one file, rejects folder uploads (`webkitRelativePath`), and surfaces inline error text without closing the popup. Backend route now binds `channel_map` as `list[UploadFile]` and rejects any request where `len(channel_map) != 1` before processing.

**Rationale:** Treating multipart cardinality and filename checks as backend authority prevents bypassing UI constraints, while client-side folder and count checks keep feedback immediate and preserve the scoped dialog workflow.

**Key files:** `client/src/features/edit-metadata/lib/channel-map-file.ts`, `client/src/components/edit-metadata/ChannelMapUploadDialog.tsx`, `server/routers/dashboard.py`, `tests/server/routers/test_dashboard_router.py`.

---

## DEC-092: Durability Schedule panel extracted for dialog reuse (2026-06-10)

**Context:** DMD-23-01 completes the same transplant pattern as Edit Metadata (DMD-20) and Assign Channels (DMD-21): the full-page Durability Schedule tab owned schedule query, hydration, upload attach, inline edit, reset, save, and dirty tracking inline in the route.

**Decision:** Introduce `DurabilitySchedulePanel` with `scope`, `canWrite`, optional `showUploadAffordance`, and `onDirtyChange`. Move save/attach helpers to `durability-schedule-save.ts` and `durability-schedule-upload.ts`; dirty detection to `durability-schedule-draft.ts`. Full-page route passes `showUploadAffordance={false}` and keeps side-panel upload; dialog integration (DMD-23-02) will use default inline upload.

**Rationale:** One panel owns the schedule correction loop for both entry points without duplicating hydration or save payload logic. Upload placement differs by shell (side panel vs dialog content) but shares the same attach contract and query invalidation.

**Key files:** `client/src/components/edit-metadata/DurabilitySchedulePanel.tsx`, `client/src/features/edit-metadata/lib/durability-schedule-save.ts`, `client/src/features/edit-metadata/lib/durability-schedule-upload.ts`, `client/src/app/database/edit/page.tsx`.

---

## DEC-093: Three-section metadata dialog dirty-close includes Durability Schedule (2026-06-10)

**Context:** DMD-23-02 wired `DurabilitySchedulePanel` into the metadata popup with `onDirtyChange`, but `isMetadataDialogDirty` still combined only metadata and channel-map flags. Schedule edits could be lost silently on close, Escape, outside click, or pending scope change.

**Decision:** Extend `isMetadataDialogDirty(metadataDirty, channelMapDirty, scheduleDirty)` for all close/scope-change decisions. Confirming discard on scope change clears the schedule dirty flag alongside metadata and channel-map flags. Section switching remains unprompted; mounted panels retain drafts. Schedule save/upload continue to invalidate `program-version-schedule` and hydrate the returned baseline as clean state. Read-only users cannot upload from the no-schedule empty state.

**Rationale:** Matches the DMD-21-03 two-section pattern and completes production readiness for the three-route popup without divergent close behavior from the full-page workflow.

**Key files:** `client/src/features/edit-metadata/lib/metadata-dialog-close.ts`, `client/src/components/edit-metadata/MetadataEditDialog.tsx`, `client/src/components/edit-metadata/DurabilitySchedulePanel.tsx`.

---

## DEC-094: Derived-data tasks extend upload_tasks instead of a new job table (2026-06-11)

**Context:** UP-24-01 requires async channel reprocess progress for Assign Channels save and YAML upload without introducing a heavyweight job framework.

**Decision:** Extend `upload_tasks` with additive columns (`task_kind`, `sub_phase`, `progress_message`, `scope_json`). Public derived kinds are `channel_reprocess` and `damage_calculation` (latter deferred to UP-24-03). Channel-map routes return `{ task_id, task_kind, reused_existing_task }`; polling uses `GET /api/v1/dashboard/derived-data/task/{task_id}` with creator scoping. Only one active derived-data task per program/version; a second start returns the existing task id. Channel reprocess persists the map synchronously, then reprocesses retained artifacts in a background thread using the extracted `_process_retained_artifacts` helper. Progress updates run outside artifact write transactions to avoid nested DuckDB transactions.

**Rationale:** Reuses proven upload-task storage and polling patterns while keeping the schema lean. Client progress modal wiring remains UP-24-02.

**Key files:** `server/services/ingestion.py`, `server/storage/database.py`, `server/routers/dashboard.py`, `server/models/derived_data_task.py`, `tests/server/services/test_channel_reprocess_task.py`.

---

## DEC-095: Channel reprocess client progress uses scoped store + close-only modal (2026-06-11)

**Context:** UP-24-02 replaces toast-only Assign Channels feedback with upload-style progress for the async `channel_reprocess` task from UP-24-01.

**Decision:** Add a scoped `channel-reprocess-store` that tracks one active task per program/version, polls `GET /api/v1/dashboard/derived-data/task/{task_id}` in the background, and drives a reusable `DerivedDataOperationModal`. Closing the modal only sets `modalOpen=false`; polling continues until completion. While running with the modal closed, `MetadataEditDialog` shows a scoped inline banner with Reopen progress. Starting save/upload while a task is already active reopens the existing poll (no duplicate polling). Progress mapping uses coarse phase bands (validating / generating) plus server `progress_message` verbatim. Query invalidation runs on task completion via the existing channel-map save cache helper.

**Rationale:** Mirrors the folder-upload modal pattern without cancel semantics; scoped store lets Assign Channels and the dialog share state without prop drilling.

**Key files:** `client/src/stores/channel-reprocess-store.ts`, `client/src/features/edit-metadata/DerivedDataOperationModal.tsx`, `client/src/components/edit-metadata/MetadataEditDialog.tsx`, `client/src/lib/api/derived-data.ts`.

---

## DEC-096: Schedule-driven damage uses latest-result cache + async task (2026-06-11)

**Context:** UP-24-03 ties load-history damage calculation to durability schedule upload/save while keeping the implementation lean.

**Decision:** Persist only the latest row per event/channel in `event_channel_damage` (status: current, stale, error). Schedule attach hydrates editable `event_rows` server-side before attempting damage. Schedule save/upload responses add either `damage_task_id` or `damage_prerequisite_report`. Prerequisites missing/stale derived data do not create task rows. Successful triggers start a background `damage_calculation` task reusing upload-task storage; validation failures return transient `failure_report` JSON in task result. Scheduled damage = base × repeats × weight × multiplier. Channel reprocess and schedule edits mark prior current rows stale with machine-readable reasons.

**Rationale:** Keeps damage tied to the active schedule without an audit ledger or separate job framework; stale values remain visible until a successful recalculation.

**Key files:** `server/services/damage_calculation_task.py`, `server/services/schedule_damage_validation.py`, `server/schema.yaml` (`event_channel_damage`), `server/routers/dashboard.py`, `tests/server/services/test_damage_calculation_task.py`.

---

## DEC-097: Schedule damage client UX uses scoped store + repair loop (2026-06-11)

**Context:** UP-24-04 wires the durability schedule UI to the schedule-triggered damage contract from UP-24-03.

**Decision:** Add `damage-calculation-store` parallel to channel reprocess. Schedule save/upload call `applyScheduleDamageResponse`, which starts polling when `damage_task_id` is present or stores `damage_prerequisite_report` inline without creating a task. `DerivedDataOperationModal` supports `damage_calculation` phases (validating schedule rows, calculating load history damage) and exposes an **Open schedule editor** action on validation failure. `DurabilitySchedulePanel` renders a compact report summary above the table and highlights affected editable fields; saving corrected rows clears the prior report and automatically retries damage calculation. Read-only users see report context but cannot save to retry.

**Rationale:** Reuses the proven derived-data modal/banner pattern while keeping the schedule repair loop short and field-targeted.

**Key files:** `client/src/stores/damage-calculation-store.ts`, `client/src/features/edit-metadata/lib/apply-schedule-damage-response.ts`, `client/src/components/edit-metadata/DurabilitySchedulePanel.tsx`, `client/src/components/edit-metadata/MetadataEditDialog.tsx`.

---

## DEC-098: Derived-data operation modals mount on Database page shell (2026-06-11)

**Context:** AC-25-01 closes the gap where channel reprocess progress was rendered inside `MetadataEditDialog`, sharing `z-50` with the editor and unmounting when the dialog closed.

**Decision:** Host channel reprocess and damage calculation `DerivedDataOperationModal` instances in `DatabaseDerivedDataOperationModals` on the Database page shell next to upload/scope-delete modals. Keep scoped store wiring and inline banners in Edit Metadata. Apply shared shell operation modal layering (`z-[70]`) via `shell-operation-modal.ts` and `AlertDialog.containerClassName`. Damage calculation failure summary opens the schedule editor through `requestMetadataEditDialogSection`.

**Rationale:** Matches the proven upload operation modal lifecycle; progress stays visible above Edit Metadata and survives editor close while the user remains on the Database page.

**Key files:** `client/src/features/edit-metadata/DatabaseDerivedDataOperationModals.tsx`, `client/src/app/database/page.tsx`, `client/src/lib/shell-operation-modal.ts`, `client/src/components/edit-metadata/MetadataEditDialog.tsx`.

---

## DEC-099: Assign Channels save/upload use modal-only in-flight feedback (2026-06-11)

**Context:** AC-25-02 completes the UP-24 gap where Assign Channels still showed a loading toast that dismissed before background reprocess finished.

**Decision:** Remove `toast.loading` / `toast.dismiss` from save and upload success paths. Extract `assign-channels-reprocess-flow.ts` to start the API call and immediately invoke `trackChannelReprocessTask` so the shell-mounted derived-data modal opens with no transitional toast. Keep `toast.error` for validation and start failures; keep reset/restore success toasts.

**Rationale:** The progress modal is the canonical long-running operation surface; loading toasts implied completion too early and competed with modal feedback.

**Key files:** `client/src/features/edit-metadata/lib/assign-channels-reprocess-flow.ts`, `client/src/components/edit-metadata/AssignChannelsPanel.tsx`.

---

## DEC-100: Database-page channel reprocess background banner (2026-06-11)

**Context:** AC-25-03 closes the visibility gap when users dismiss the progress modal and close Edit Metadata while channel reprocess still runs.

**Decision:** Add `DatabaseChannelReprocessBanners` on the Database page shell, driven by `selectDatabaseChannelReprocessBanners` over existing channel reprocess store state and metadata edit dialog scope. Show banner only when `status === running`, `modalOpen === false`, and Edit Metadata is not open for the same program/version. Reopen calls `reopenChannelReprocessModal`; no new polling or task types.

**Rationale:** Keeps background work visible on the Database page without a global task center; defers to inline Edit Metadata banner when the editor is open for the active scope.

**Key files:** `client/src/features/edit-metadata/DatabaseChannelReprocessBanners.tsx`, `client/src/features/edit-metadata/lib/database-channel-reprocess-banner.ts`, `client/src/app/database/page.tsx`.

---

## DEC-101: Assign Channels preserves canonical raw measurements (2026-06-11)

**Context:** Assign Channels reprocess previously reparsed retained artifacts, hard-deleted each event, and rewrote both `measurements_raw` and `measurements_lttb`. That made full-resolution raw measurements depend on editable plot mappings, even though raw load histories are the analytical source of truth for damage calculation.

**Decision:** Treat `measurements_raw` as canonical full-resolution analytical data written by upload/canonicalization, storing all numeric signal columns except index/time. Assign Channels save and channel-map YAML upload now preserve `measurements_raw`, regenerate only `measurements_lttb` from canonical raw rows, and update channel-map lineage. Channel-map snapshot changes stale LTTB only; raw measurement status remains current unless raw rows are genuinely missing. Existing incomplete legacy data should be repaired by a one-time canonical-artifact backfill rather than by normal Assign Channels reprocess.

**Rationale:** Plot mapping edits should not rewrite or narrow the raw source used by downstream damage calculation. Generating LTTB from `measurements_raw` enforces the source-of-truth boundary and avoids retained-artifact corruption causing false channel-reprocess failures after canonical raw already exists.

**Key files:** `server/services/etl/transformer.py`, `server/services/ingestion.py`, `server/services/derived_data_lineage.py`, `server/storage/database.py`, `client/src/features/edit-metadata/lib/derived-task-progress.ts`, `docs/architecture/derived-data-upload-pipeline.md`.

---

## DEC-102: Post-upload precompute orchestrator (2026-06-11)

**Context:** PPU-27 closes the workflow-order gap where a durability schedule saved before channel reprocess finishes never triggers damage calculation once channel-derived prerequisites become current.

**Decision:** Add `server/services/post_upload_precompute.py` with a deterministic decision function invoked after `channel_reprocess` task completion. Decisions are `no_op`, `blocked`, `start_damage_calculation`, or `reuse_active_task`. Reuse existing `damage_calculation` task orchestration; do not add a new public task kind. After channel completion, only reuse active `damage_calculation` tasks (not in-flight `channel_reprocess` rows) to avoid read-after-write races with the just-completed task row.

**Rationale:** Keeps precompute rules testable in one module and reuses UP-24 task storage/polling. Schedule-first and channel-first workflows converge through the same decision path.

**Key files:** `server/services/post_upload_precompute.py`, `server/services/ingestion.py`, `server/services/damage_calculation_task.py`, `tests/server/services/test_post_upload_precompute.py`.

---

## DEC-103: Schedule-only scheduled damage rescale service (2026-06-11)

**Context:** PPU-27-03 needs a fast path when users edit only schedule scaling inputs (repeats, weight, multiplier) and persisted base damage remains valid.

**Decision:** Add `server/services/schedule_damage_rescale.py` with eligibility checks and synchronous rescale updates. The post-upload precompute orchestrator selects `rescale_scheduled_damage` after schedule-row save when event matching is unchanged, every scheduled event/channel row has reusable base damage, and no row is in error or stale for non-schedule reasons. Rescale updates scheduled damage and row metadata without rerunning py-fatigue; all other cases fall back to `damage_calculation`.

**Rationale:** Separates notebook model layers (single-pass base damage vs schedule scaling) behind a small testable interface while preserving stale-state safety.

**Key files:** `server/services/schedule_damage_rescale.py`, `server/services/post_upload_precompute.py`, `server/routers/dashboard.py`, `tests/server/services/test_schedule_damage_rescale.py`.

---

## DEC-104: Per-event channel resolver deep modules (2026-06-11)

**Context:** IDM-28 fixes Inspect Damage blanks when events in one program/version use different RSP title conventions at the same column indices. Upload-time plot extraction already uses column indices per file; damage and channel reprocess still join on version-wide title strings frozen from the first artifact.

**Decision:** Extract two small server modules with no database access in the pure resolver core:

1. `per_event_channel_resolver` — given `x_col`/`y_col` and an event header row, return resolved channel names/units or structured errors (`missing_headers`, `column_out_of_range`).
2. `event_header_provider` — load header/units for an `event_id` from `event_previews` first, then `ingestion_artifacts.preview_json` `#TITLES`/`#UNITS` fallback via `get_ingestion_artifact_for_event()`.

Keep legacy generic `col_N` pattern matching in `damage_channels.py` as a separate fallback helper; do not make it the primary resolution path.

**Rationale:** One canonical lookup rule for derived-data readers without coupling damage/reprocess to ingestion service internals; fast unit tests without py-fatigue.

**Key files:** `server/services/per_event_channel_resolver.py`, `server/services/event_header_provider.py`, `server/storage/database.py`, `tests/server/services/test_per_event_channel_resolver.py`, `tests/server/services/test_event_header_provider.py`.

---

## DEC-105: Index-based channel map persistence (2026-06-11)

**Context:** IDM-28-02. Assign Channels save and YAML upload called `_channel_map_with_preview_headers()`, freezing the first retained artifact's Moog-style titles into `dim_channel_map` as the version-wide lookup key. Mixed export conventions in one program/version then failed damage and reprocess joins.

**Decision:** Persist `col_{x_col}` / `col_{y_col}` in `dim_channel_map` at save/upload time. Drop preview-header title resolution from save paths; keep first-artifact preview for editor column-count validation and human-readable UI preview only. YAML `validate_loaded_channel_map()` always normalizes lookup fields to `col_N`. Channel reprocess resolves generic map entries to per-event titles at read time via `EventHeaderProvider` + `resolve_plot_channels_from_headers()` so save does not leave LTTB regeneration empty.

**Rationale:** Column index is the version-wide contract; per-event titles are resolved at compute time (DEC-104). Snapshot normalization already stored index-based plot definitions—save paths now match.

**Key files:** `server/services/ingestion.py`, `tests/server/services/test_channel_map_index_persistence.py`.

---

## DEC-106 — Partial damage repair policy for mixed cohorts (IDM-28-05)

**Date:** 2026-06-11

**Decision:** Inspect Damage backfill and channel-reprocess follow-up treat a scope as repairable when any scheduled event lacks complete `current` damage due to errors or a mixed `current`/`error` population. Stale-only scopes remain inspectable without automatic recalculation.

**Rationale:** Production `002/v02` had 18 events with `current` rows and 39 with `error` rows; blocking backfill on `persisted_damage_exists` prevented one-action recovery after resolver fix.

**Key files:** `server/services/scope_damage_repair.py`, `server/services/post_upload_precompute.py`, `server/services/damage_inspect.py`.

---

## DEC-107 — Shared client task workflow adapters (UPF-29-01)

**Date:** 2026-06-11

**Decision:** Keep the existing server task model, but consolidate repeated client workflow interfaces. Upload and derived-data polling use `task-polling.ts`; damage calculation start/prerequisite handling uses `apply-damage-task-response.ts`; channel reprocess and damage calculation state use `derived-task-scope-store.ts`.

**Rationale:** The upload-to-Inspect-Damage flow had accumulated duplicate polling loops, parallel task stores, and repeated damage-task response handling. Consolidating these client adapters improves locality without introducing a global background task center, a new public task kind, or a server-side queue.

**Key files:** `client/src/lib/api/task-polling.ts`, `client/src/features/edit-metadata/lib/apply-damage-task-response.ts`, `client/src/stores/derived-task-scope-store.ts`, `client/src/features/database-upload/upload-completion-result.ts`.

---

## DEC-108 — Shared client modules for Fallow P4 quick dedup (FALLOW-P4-QUICK)

**Date:** 2026-06-12

**Decision:** Extract neutral shared modules for duplicated client code flagged in Fallow P4 triage: `RouteErrorFallback`, `event-metadata-fields`, `binary-decode-core`, shared axis extent scanning in `scales.ts`, and `database-table` helpers (`FilterableColumnHeader` + `lib/database-table/shared.ts`). Defer larger P4 families (event-tree unification, progress panels, operation modals) to later slices.

**Rationale:** Syntactic duplication between database and inspect-damage table pages, route error boundaries, binary decode paths, and overlapping type shapes increased maintenance cost without product benefit. Shared modules preserve behavior (including database default sort `desc` vs inspect-damage `asc`) while eliminating clone groups.

**Key files:** `client/src/components/shared/RouteErrorFallback.tsx`, `client/src/types/event-metadata-fields.ts`, `client/src/lib/utils/binary-decode-core.ts`, `client/src/lib/chart-utils/scales.ts`, `client/src/lib/database-table/shared.ts`, `client/src/components/database-table/FilterableColumnHeader.tsx`.

---

## DEC-109 — Explicit schedule command lifecycle contract (DPR-31-01)

**Date:** 2026-06-12

**Decision:** Durability schedule attach/save responses now return explicit command lifecycle fields: `schedule_command_outcome`, `damage_task_id`, `damage_task_status`, and `damage_prerequisite_report`. Outcome values are `calculation_started`, `reused_active_task`, `validation_blocked`, and `failed_to_start`.

**Rationale:** The prior contract required UI callers to infer lifecycle outcomes from sparse optional fields. Explicit outcomes provide deterministic command semantics for schedule flows and establish the command/query boundary needed for DPR-31.

**Key files:** `server/services/post_upload_precompute.py`, `server/models/dashboard.py`, `server/routers/dashboard.py`, `client/src/types/api.ts`, `client/src/features/edit-metadata/lib/schedule-damage-response.ts`.

---

## DEC-110 — Inspect read path removes repair/prerequisite policy checks (DPR-31-04)

**Date:** 2026-06-12

**Decision:** `POST /api/v1/damage/inspect` remains a strict read model and no longer evaluates scope repair/prerequisite policy (`assess_scope_damage_repair_state`, `check_damage_prerequisites`) while serving inspect reads. Inspect continues to return selected event rows plus read-only running/failed task context from persisted task state (`active_damage_task_id`, `failure_report`).

**Rationale:** Read requests should not own command policy or hidden lifecycle side effects. Removing repair/prerequisite checks from inspect keeps command/query boundaries explicit: schedule save/upload owns lifecycle starts; inspect only reports persisted state.

**Key files:** `server/services/damage_inspect.py`, `tests/server/routers/test_damage_router.py`, `docs/tasks/DPR-31-04.md`.

---

## DEC-111 — Inspect Damage comparison uses one scope per side (PU-35)

**Date:** 2026-06-15

**Decision:** The PRD-35 Inspect Damage comparison workflow compares exactly one Reference program/version scope against exactly one Target program/version scope. Users may select multiple events inside each chosen scope, but mixed program/version selections within one side are out of scope. The plotting UI will not expose a version slice control; program/version labels are derived from the selected Reference and Target scopes.

**Rationale:** One-scope-per-side keeps comparison labels, plot aggregation semantics, and 3D focus behavior clear while keeping the implementation lightweight for a small 5-10 user team. It avoids ambiguous multi-version plots and removes the need for a separate version selector in the plot surface.

**Key files:** `docs/brainstorm/35_plotting_upgrades/PRD.md`, `docs/brainstorm/35_plotting_upgrades/IMPLEMENTATION_MAP.md`, `docs/brainstorm/35_plotting_upgrades/issues/PU-35-01.md`.

---

## DEC-112 — Sidepanel owns Plot Inputs state (PU-35-02)

**Date:** 2026-06-15

**Decision:** Move Inspect Damage channel selection (`selected_channel_keys`) and value mode (`value_mode`) controls into a sidepanel `Plot Inputs` section rendered below `Target Load Data`. Keep these controls out of the 3D overlay rail. Enforce a one-channel-minimum invariant at sidepanel update time.

**Rationale:** PRD-35 defines sidepanel ownership for persistent comparison inputs while keeping the plot surface focused on plot-local display controls. This prevents split ownership between sidepanel and overlay, keeps session semantics deterministic, and avoids accidental coupling to table column visibility.

**Key files:** `client/src/components/dashboard/side-panel/ComparisonLoadDataSections.tsx`, `client/src/components/dashboard/side-panel/ComparisonPlotInputsSection.tsx`, `client/src/features/inspect-damage-3d/components/DamagePlotView.tsx`, `client/src/features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx`, `docs/tasks/PU-35-02.md`.

---

## DEC-113 — Shared damage-scale transform and in-plot toggle (PU-35-04)

**Date:** 2026-06-15

**Decision:** Extract a shared client utility `applyDamageScale(value, mode)` for Inspect Damage plot transforms. Support `linear` and `log` modes, where log mode is `log10(1 + value)`, and clamp negative/non-finite inputs to `0` before applying scale. Keep damage-scale mode as local plot-surface state in `DamagePlotView`, render a subtle `Normal`/`Log` control inside the main focused 3D plot area, and remove damage-scale controls from the left overlay rail.

**Rationale:** PRD-35 requires a subtle in-plot damage-scale toggle and a shared transform that 3D and upcoming 2D specs can reuse. Centralizing transform math prevents drift across plot types while keeping sidepanel ownership boundaries unchanged (`Plot Inputs` still own channels + value mode only).

**Key files:** `client/src/features/inspect-damage-3d/lib/damage-scale.ts`, `client/src/features/inspect-damage-3d/components/DamagePlotView.tsx`, `client/src/features/inspect-damage-3d/components/DamagePlotOverlayControls.tsx`, `client/src/features/inspect-damage-3d/__tests__/damage-scale.test.ts`, `docs/tasks/PU-35-04.md`.
