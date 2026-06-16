## Problem Statement

Users can manually assign plot channels in the Database/Edit metadata dialog, but when they already have a valid `channel_map.yml` or `channel_map.yaml`, the dialog still forces them to type each plot's x/y column indexes by hand. The original Upload Data route already accepts a channel-map file and automatically applies it to uploaded CSV/RSP data, but that path is tied to uploading data files and does not help when a program/version is already present and only the channel map needs to be supplied or replaced.

This creates unnecessary rework for users fixing rows that are blocked by missing channel maps. It also risks inconsistent behavior if the metadata dialog grows its own channel-map handling instead of reusing the existing upload and processing rules.

## Solution

Add an **Upload** action to the Assign Channels button row alongside **Reset** and **Save**. When clicked, it opens a small upload popup that accepts only one channel-map file whose basename is exactly `channel_map.yml` or `channel_map.yaml`. No CSV, RSP, folder upload, arbitrary YAML, or differently named file should be accepted from this popup.

After validation succeeds, the application should use the same channel-map parsing, normalization, persistence, and retained-artifact processing behavior used by the original Upload Data route. The result should auto-populate/save the fixed plot channel map for the current program/version and process any pending artifacts so the row becomes plottable without requiring manual x/y entry.

## User Stories

1. As a write user editing a selected program/version, I want an Upload button in Assign Channels, so that I can provide an existing channel-map file without manually entering every plot column index.
2. As a user with a missing-channel-map row, I want uploading `channel_map.yml` or `channel_map.yaml` from the popup to process pending artifacts, so that the dataset becomes available for plotting.
3. As a user, I want the popup to reject any file that is not named exactly `channel_map.yml` or `channel_map.yaml`, so that I do not accidentally upload unrelated YAML or data files through this narrow correction path.
4. As a read-only user, I want the upload action disabled or unavailable, so that permissions are consistent with the existing channel-map save behavior.
5. As a user, I want clear success and failure feedback, so that I know whether the map was applied and whether any retained files failed to process.

## Implementation Decisions

- The Upload button belongs in the existing Assign Channels footer row with Reset and Save. It should use the same design-system `Button` style and be disabled when the user cannot write, the editor is loading, or a channel-map operation is already in progress.
- Clicking Upload opens a modal/popup scoped to the current program/version. The popup should reuse the existing file-drop visual language, but its copy must make the narrower purpose clear: upload only `channel_map.yml` or `channel_map.yaml`.
- The popup must validate selected files before calling the backend:
  - exactly one file is selected;
  - the file basename, after stripping any directory path, lowercases to `channel_map.yml` or `channel_map.yaml`;
  - no CSV/RSP files, directories, or unrelated YAML filenames are accepted.
- The backend must also enforce the same validation. Client-side validation is only user feedback, not the authority.
- Add a scoped channel-map upload contract for an existing program/version. It should accept the current `program_id`, `version`, and one `channel_map` file, guarded by the same write/ownership rules as manual channel-map save.
- The upload contract should reuse the existing channel-map normalization path from Upload Data rather than parsing YAML in the component. The durable behavior should remain: YAML channel maps and manual UI maps normalize to equivalent plot mappings when they describe the same columns.
- The processing path should converge on the same retained-artifact workflow as manual save: validate against retained preview column count, upsert `dim_channel_map`, persist/activate a channel-map snapshot, process pending or failed artifacts, invalidate cache, and return processed/failed counts.
- After a successful upload, the Assign Channels panel should refetch channel-map editor data so the table shows the applied x/y values and the missing-channel-map warning clears when processing succeeds.
- The popup should close on successful completion and remain open on validation or processing failure so the user can choose a corrected file.
- Existing manual Reset and Save behavior should remain unchanged.

## Testing Decisions

- Add Assign Channels UI coverage for rendering the Upload button in the footer row, opening the popup, selecting a valid file, rejecting invalid filenames, rejecting multiple files, and disabling the action for read-only users.
- Add API-client coverage for the new scoped channel-map upload request, including form fields and filename handling.
- Add backend route coverage for auth/write permission enforcement, exact basename validation, rejection of arbitrary `.yaml` files, and successful processing of `channel_map.yml` and `channel_map.yaml`.
- Add service-level regression coverage showing that the dialog upload path and original Upload Data YAML path produce equivalent channel-map mappings/snapshots for the same map definition.
- Add cache/query invalidation coverage so successful upload refreshes channel-map editor data, Database row indicators, and dashboard/event dependencies already refreshed by manual channel-map save.
- Reuse existing tests around `AssignChannelsPanel`, `saveProgramVersionChannelMap`, upload form data, `save_channel_map_and_process_artifacts`, and the YAML/UI equivalence regression as examples.

## Out of Scope

- Uploading CSV or RSP files from the Assign Channels popup.
- Uploading folders from the Assign Channels popup.
- Supporting arbitrary channel-map filenames.
- Changing fixed plot keys or adding a new channel-map editor shape.
- Redesigning the full Upload Data route.
- Changing metadata fields, durability schedule behavior, or database import/export behavior.

## Further Notes

- This is a narrow correction path for existing program/version scopes. It should not become a second general data-upload workflow.
- A likely implementation shape is to extract the common channel-map persistence/process core so both manual UI save and YAML upload can share retained-artifact processing while preserving their respective authoring sources.
- Non-blocking product question for implementation: after a successful upload, should the toast distinguish between "map saved, no pending files to process" and "map saved, N files processed"? The current manual save already reports processed and failed counts, so matching that pattern is the recommended default.
