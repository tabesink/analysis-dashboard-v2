# Handoff — Assign Channels Channel-Map Upload (DMD-22)

Use this document when picking up any issue in `issues/DMD-22-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Add a narrow **Upload** action to Assign Channels so users can apply an existing `channel_map.yml` or `channel_map.yaml` to the currently selected program/version. This is a correction path for existing retained artifacts, not a second data-upload workflow.

The implementation should reuse the current channel-map parsing, normalization, save, retained-artifact processing, and cache invalidation behavior wherever possible.

## What already exists

| Area | Status | Notes |
|------|--------|-------|
| Assign Channels panel | Existing | `AssignChannelsPanel` renders the plot x/y table, CSV preview, missing-map warning, Reset, and Save for a scoped program/version. |
| Manual channel-map save | Existing | The panel saves fixed plot entries through `saveProgramVersionChannelMap`, which calls the dashboard channel-map API and invalidates dependent queries. |
| Channel-map editor API | Existing | `getChannelMapEditor` returns saved rows, retained CSV preview lines, column count, and pending/failed artifact counts. |
| Retained-artifact processing | Existing | `save_channel_map_and_process_artifacts` validates fixed plot entries, persists the active map/snapshot, and reprocesses retained artifacts. |
| Original Upload Data channel map | Existing | Upload Data accepts `channel_map.yml` / `channel_map.yaml` alongside CSV/RSP files and uses YAML normalization during ingestion. |
| YAML/UI equivalence coverage | Existing | Regression tests already prove equivalent YAML and UI-authored maps produce equivalent plot-column snapshots. |

## Issue Order

1. `DMD-22-01` — Add the valid channel-map upload happy path from Assign Channels.
2. `DMD-22-02` — Enforce channel-map-only upload guardrails and permissions.
3. `DMD-22-03` — Prove upload parity, refresh, cache behavior, and manual action preservation.

## Key Behavior

- The Upload button sits in the Assign Channels footer row with Reset and Save.
- Upload is scoped to the current program/version; users must not choose or override scope in the popup.
- The popup accepts exactly one file.
- The only accepted basenames are `channel_map.yml` and `channel_map.yaml`.
- CSV, RSP, folders, arbitrary YAML files, and differently named channel-map files are rejected.
- Backend validation is authoritative; frontend validation only improves feedback.
- Write permission and owner/admin authorization match manual channel-map save.
- Successful upload applies the map, processes retained pending artifacts, refetches Assign Channels data, and refreshes Database/Dashboard indicators.
- Reset and Save behavior remain unchanged.

## Boundaries

- Do not upload CSV or RSP files from this popup.
- Do not support directory selection from this popup.
- Do not support arbitrary channel-map filenames.
- Do not change fixed plot keys, metadata fields, durability schedule behavior, or database import/export behavior.
- Do not fork a second channel-map processing system in the frontend.
- Do not weaken ownership checks or cache invalidation around write paths.

## Verification Focus

- Valid `channel_map.yml` upload applies to the selected program/version and processes retained artifacts.
- Valid `channel_map.yaml` behaves the same as `.yml`.
- Invalid filenames and multiple files are rejected on both client and server.
- Read-only users cannot upload from Assign Channels.
- Missing-channel-map UI clears after a successful upload when processing succeeds.
- Database table indicators and Dashboard-dependent data refresh without a manual browser reload.
- Existing manual Assign Channels Reset and Save tests still pass.
- Existing Upload Data flow still accepts CSV/RSP uploads with optional channel-map files.

## Suggested Implementation Notes

- Prefer extracting shared helpers for channel-map file basename validation and upload result messaging if duplication appears in both Upload Data and Assign Channels.
- Prefer keeping YAML parsing and normalization server-side. The component should not parse channel-map YAML.
- If adding a new backend route, keep it scoped to program/version and mirror the manual save route's authorization check before mutating anything.
- If adding a new service method, make it converge with the existing retained-artifact processing method instead of duplicating event rewrite logic.

## Documentation Updates When Shipping

- Add an `[Unreleased]` `CHANGELOG.md` entry for channel-map upload from Assign Channels.
- Update `docs/master-build-plan.md` with DMD-22 task rows if this brainstorm becomes tracked build work.
- Create `docs/tasks/DMD-22-*.md` implementation notes for non-trivial completed slices.
- Append `docs/decisions/log.md` only if implementation makes a durable design decision beyond the PRD, such as introducing a new shared channel-map upload service boundary.
