# Per-Event Channel Resolution for Inspect Damage (IDM-28)

## Problem Statement

Inspect Damage shows blank damage cells for many events in a program/version even though those events uploaded successfully, matched the durability schedule, and have full raw load histories in the database. Schedule matching and damage orchestration are working; the failure happens when the system tries to read signal data for fatigue calculation.

Today, Assign Channels persists **one set of channel title strings** for the whole program/version, usually resolved from the **first retained artifact’s preview**. Damage calculation and channel reprocess then look up raw measurements by **exact channel name string**. When different events in the same version use different RSP export naming conventions for the same physical columns—as confirmed for program `002` / `v02`, where Dec 2022 files use titles like `1 1 LR LBJ - Fx` while Jul 2024 files use `1 1 LR LCA OtrBJ P_UG_X Force`—lookup fails with persisted errors such as `No measurements found for mapped channel '…'`. The UI hides `error` rows, so users see empty cells and assume schedule upload or damage automation failed.

Upload-time cross-plot generation already works across both naming conventions because it uses **column indices** on each event’s parsed dataframe. Damage and parts of channel reprocess do not use the same rule, which creates a confusing split: plots may look fine while Inspect Damage stays empty for the same events.

Filename-based routing (for example treating `_5dec22_` differently from `_26jul24_`) would patch one cohort but add fragile, high-debt special cases. The durable fix is to treat **column index as the version-wide contract** and resolve **each event’s own headers** at compute time.

## Solution

Introduce a single, shared **per-event channel resolution** rule used wherever derived data reads canonical raw load histories by plot mapping:

1. The channel map defines **which columns** participate in each plot (`x_col`, `y_col`) for a program/version.
2. For each event, resolve the lookup channel names from **that event’s stored header metadata** (canonical preview headers), not from the first file in the batch and not from filename patterns.
3. Persist **`col_N` generic names** (or column indices only) in the version-wide channel map; do not freeze one event’s title strings as the lookup key for all events.
4. Keep the existing legacy pattern matcher only as a **fallback** when header metadata is unavailable and the map still uses generic `col_N` names.

After this change, damage calculation, channel reprocess, and any other raw-measurement readers that share plot mappings should behave like upload-time plot extraction: same columns, different title strings per file, one consistent outcome.

Recovery for affected program/versions: re-save or normalize the channel map to index-based storage, rerun channel reprocess, then rerun damage calculation. No re-upload of raw files is required when `measurements_raw` is already populated.

## User Stories

1. As a durability engineer, I want Inspect Damage to show scheduled damage for every schedule-matched event that has raw load histories, so that blank cells reflect real missing data rather than channel naming mismatches.
2. As a durability engineer, I want events with different RSP export title conventions in the same program/version to calculate damage correctly, so that mixed historical and recent test files can coexist in one version.
3. As a database user, I want Assign Channels to define plot mappings by column position, so that the mapping remains stable even when channel titles differ between files.
4. As a database user, I want damage calculation to use each event’s own channel titles when reading raw load histories, so that I do not need separate program versions for each export format.
5. As a database user, I want channel reprocess to rebuild cross-plot data using the same per-event resolution rule as damage, so that plots and damage stay aligned.
6. As a database user, I want upload-time plot/LTTB behavior to remain unchanged, so that existing working paths do not regress.
7. As a write user, I want saving a channel map to stop storing first-file title strings as the version-wide lookup key, so that later events are not forced to match one reference file’s naming.
8. As a database user, I want the Assign Channels editor to continue showing human-readable channel titles in preview, so that I can verify mappings without reading column indices only.
9. As a durability engineer, I want persisted damage errors to distinguish true missing signals from resolver failures, so that repair guidance is accurate.
10. As a database user, I want automatic post-upload damage precompute to populate all schedule-matched events once prerequisites are current, so that I do not manually diagnose cohort splits by filename date.
11. As a read-only user, I want Inspect Damage to continue reading persisted rows only, so that opening the table stays fast and predictable.
12. As a write user, I want rerunning Calculate Damage after the fix to refresh all previously failed events, so that repaired resolver behavior backfills missing values.
13. As a write user, I want channel reprocess after the fix to regenerate cross-plot data consistently for all events, so that analytical views match damage inputs.
14. As a durability engineer, I want base damage and scheduled damage semantics to remain unchanged, so that this fix affects signal lookup only.
15. As a durability engineer, I want schedule matching, repeats, weight, and multiplier behavior to remain unchanged, so that this fix does not alter schedule logic.
16. As a database user, I want orphan schedule placeholder rows to remain without damage, so that unmatched schedule patterns still behave as today.
17. As a developer, I want one shared resolver module for “plot mapping + event headers → channel names”, so that ingestion, reprocess, and damage do not duplicate header parsing rules.
18. As a developer, I want the resolver to read headers from stored event preview metadata first, so that compute paths do not reopen canonical artifacts unless necessary.
19. As a developer, I want a fallback to ingestion artifact preview `#TITLES` when event preview headers are missing, so that older rows remain repairable.
20. As a developer, I want a final fallback to legacy generic `col_N` pattern matching against distinct raw channel names, so that older channel maps remain supported during migration.
21. As a developer, I want channel map snapshots to continue storing normalized plot definitions with column indices, so that lineage and audit remain stable.
22. As a developer, I want dim channel map persistence to store index-based channel names for lookup purposes, so that version-wide maps do not encode one event’s titles.
23. As a developer, I want damage channel spec derivation to consume resolved per-event names at lookup time, so that the fixed 12 Inspect Damage channels stay derived from the 8 plot definitions.
24. As a developer, I want explicit error messages when an event’s header row is missing or a column index is out of range, so that failures are actionable in task results.
25. As a developer, I want server tests using two fixture naming conventions for the same column layout, so that regressions back to first-file string matching are caught.
26. As a developer, I want server tests proving damage calculation succeeds for both fixtures under one channel map, so that the IDM-28 defect is locked down.
27. As a developer, I want server tests proving channel reprocess builds LTTB from both fixtures under one channel map, so that reprocess and damage stay consistent.
28. As a developer, I want a migration/recovery note for program/versions already saved with frozen title strings, so that operators know to re-save channels and rerun derived tasks.
29. As a product owner, I want this slice to avoid filename heuristics and expanded string pattern lists, so that future export formats are handled by headers rather than regex maintenance.
30. As a product owner, I want no new public task kinds or progress UX, so that the fix stays inside existing derived-data boundaries.
31. As an admin, I want ownership and active-task rules for derived-data writes to remain unchanged, so that multi-user safety is preserved.
32. As a database user, I want partial historical damage failures to be replaceable by a full recalculation after the fix, so that I am not stuck with “persisted_damage_exists” blocking backfill when only some events ever succeeded.
33. As a write user, I want Calculate Damage to rerun for all schedule-matched events when any persisted damage rows exist but are incomplete or error-only, so that mixed cohort failures can be repaired in one action.
34. As a developer, I want inspect/backfill precompute rules documented if they still block partial repair, so that follow-up work is explicit rather than accidental UX debt.
35. As a durability engineer, I want cross-plot plots that rely on raw measurement joins to use the same resolver when they read by channel name, so that the app does not keep multiple lookup semantics alive.
36. As a database user, I want the channel-map YAML upload path to behave the same as UI save, so that both assignment paths produce index-based persisted maps.
37. As a developer, I want resolver behavior covered by unit tests without running py-fatigue, so that feedback stays fast.
38. As a developer, I want integration tests to cover schedule-driven damage for mixed fixture batches, so that end-to-end Inspect Damage readiness is verified.
39. As a database user, I want stale damage rows to be marked appropriately when channel resolution logic changes, so that I can trust refreshed values after redeploy.
40. As a developer, I want architecture docs for the derived-data pipeline updated to state “column index + per-event headers” as the canonical lookup rule, so that future features do not reintroduce first-file title coupling.

## Implementation Decisions

- **Canonical lookup contract:** plot mappings are defined by zero-based `x_col` and `y_col` for a program/version. Resolved lookup names are computed per event at read/compute time.
- **Header source priority for an event:**
  1. Stored event preview metadata headers list (canonical ingest preview).
  2. Retained ingestion artifact preview `#TITLES` row for that event’s source file.
  3. Legacy fallback: if the map still uses generic `col_N` and headers are unavailable, use existing component/axis pattern matching against distinct raw channel names.
- **Deep module — per-event channel resolver:** extract the existing “apply column indices to a header row” behavior into a small shared service with a narrow interface, roughly:
  - input: one plot mapping (`x_col`, `y_col`, optional units) + event header list (+ optional units list)
  - output: resolved `x_channel_name`, `y_channel_name`, or structured error (`missing_headers`, `column_out_of_range`, etc.)
  - responsibility: no database access inside the core pure function; adapters load headers for an event id.
- **Deep module — event header provider:** loads header/units lists for an event from preview storage with artifact fallback. Keeps SQL/preview parsing out of damage and ingestion loops.
- **Channel map persistence change:** when saving Assign Channels or YAML upload, persist index-based names (`col_N`) in the version-wide channel map table. UI preview may still display resolved titles from a selected preview artifact, but persisted lookup keys must not freeze the first artifact’s strings across the version.
- **Stop using first artifact only for version-wide title resolution** at save time. First artifact preview remains acceptable for editor display and column-count validation, not for durable cross-event lookup strings.
- **Damage calculation path:** before querying `measurements_raw`, resolve each damage channel’s underlying plot axis through the shared resolver for that event. Replace direct use of persisted title strings from the version-wide map.
- **Channel reprocess path:** when extracting plot series from raw measurements for LTTB regeneration, resolve `x_channel`/`y_channel` per artifact/event via the same resolver instead of reusing one version-wide title pair.
- **Upload path:** keep existing dataframe column-index extraction for initial LTTB during ingest. Align reprocess/damage with that behavior rather than introducing a third semantics.
- **Legacy pattern matcher:** retain as fallback only; do not expand it with filename rules or large ad hoc synonym tables for this PRD.
- **Damage persistence semantics:** unchanged (`current` / `stale` / `error`, scheduled damage formula, schedule-only rescale path from PPU-27).
- **Derived task kinds and progress UX:** unchanged (`channel_reprocess`, `damage_calculation`, existing modal/polling).
- **Recovery behavior for existing bad maps:** document operator steps—normalize map to index-based storage, run channel reprocess, run damage calculation. Optional one-time normalization helper may map existing explicit titles back to `col_N` when indices are present; not required if UI re-save is sufficient.
- **Partial damage repair (follow-up decision inside slice):** evaluate whether Inspect Damage backfill / Calculate Damage should rerun when persisted rows exist but scheduled events still have zero displayable damage. The confirmed `002/v02` case needs full recalculation after resolver fix even though some events already have `current` rows. Prefer allowing explicit Calculate Damage to rerun all schedule-matched events when any eligible event lacks displayable current damage, without starting duplicate active tasks.
- **Schema:** no new tables required if event preview and existing channel map columns suffice. No change to `measurements_raw` shape.
- **API contracts:** no new public endpoints required. Existing save/reprocess/damage endpoints should benefit automatically once server lookup changes.
- **Documentation:** update derived-data pipeline architecture notes to list per-event header resolution as the canonical rule and explicitly call out first-file title persistence as deprecated behavior.

## Testing Decisions

- **What makes a good test:** assert externally visible outcomes—resolved channel names per event, raw row counts found, LTTB rows written, damage cells persisted as `current`—not internal helper call order.
- **Primary fixtures:** two canonical CSV/RSP header conventions with identical column layout and different title strings (abbreviated Dec 2022-style vs full Moog-style), under one program/version and one index-based channel map.
- **Modules to test:**
  - per-event channel resolver (pure unit tests)
  - event header provider (database adapter tests with preview rows)
  - damage channel series lookup (service tests → non-empty series for both fixtures)
  - channel reprocess LTTB regeneration (service tests → plots generated for both fixtures)
  - optional integration test: schedule-matched mixed batch → damage task persists 12 current rows per event
- **Prior art:** existing damage query service tests with synthetic 24-channel CSV; channel reprocess/post-upload precompute tests; durability schedule damage task tests; assign-channel server tests around channel map save and snapshot normalization.
- **Regression tests to add:** prove version-wide map stored as `col_N` after save; prove damage no longer depends on first artifact preview titles; prove legacy fallback still works when only generic names + raw distinct names exist.

## Out of Scope

- Filename pattern routing or cohort detection by source path tokens.
- Expanding legacy substring pattern lists to cover every historical export synonym.
- New derived-data task kinds, queue systems, or global task centers.
- Changes to schedule matching, repeats/weight/multiplier editing, or rescale-only damage logic except where recalculation is triggered after repaired lookups.
- Client Inspect Damage table layout changes beyond reflecting newly persisted values after recalculation.
- Re-uploading or re-canonicalizing raw artifacts when `measurements_raw` is already correct.
- Cross-version channel map sharing or automatic map inference across program versions.
- Plot UI redesign or new channel-map editor interactions beyond keeping readable preview titles.

## Further Notes

- **Confirmed defect example:** program `002`, version `v02`, 57 events. 18 Jul 2024-style files had 12 `current` damage rows each; 39 Dec 2022-style files had 12 `error` rows each with `No measurements found for mapped channel '1 1 LR LCA OtrBJ P_UG_X Force'`. Raw data existed under titles like `1 1 LR LBJ - Fx` at the same column indices.
- **Root cause category:** version-wide explicit title persistence + exact string lookup, not schedule attach and not missing uploads.
- **Issue tracker:** publish this PRD to GitHub Issues with label `ready-for-agent` when `gh` is available in the environment. Local slice issues live under `issues/IDM-28-*.md`.
- **Suggested slice order:** resolver + header provider → persistence normalization → damage lookup → reprocess lookup → recovery/docs/tests hardening.
