# 07 — Client Refactor Plan

## Goal

Make the frontend reflect the product mental model:

```text
Folder upload = raw data in
Channel map + schedule = derived pipelines out
DB import/export = whole DB suitcase
```

## `/database` route ownership

The `/database` page should be the primary upload UI.

Components:

```text
DatabaseSidePanel
UploadDataSection
UploadOperationModal
DatabaseSection
DatabaseOperationModal
DatabaseSwitchDialog
DatabaseEventTree
CsvPreviewTable
FileDropZone
```

## Deprecated components

Mark these as legacy wrappers during migration:

```text
UploadSidePanel
UploadContent
```

Do not extend them with new behavior.

## Upload feature module

First extract shared helpers:

```text
client/src/features/database/upload/lib/upload-file-policy.ts
client/src/features/database/upload/lib/upload-metadata.ts
```

These helpers should be covered with behavior tests before moving components. They should make `UploadDataSection` and `/database` submit handling agree on:

- CSV/RSP exclusivity
- channel-map companion file detection
- ignored unrelated files
- required field validation
- existing label-to-payload mapping, including `Program ID` to `job_number`

Then create or move:

```text
client/src/features/database/upload/
  lib/upload-file-policy.ts
  lib/upload-metadata.ts
  hooks/useFolderUploadOperation.ts
  components/FileDropZone.tsx
  components/UploadDataSection.tsx
  components/UploadOperationModal.tsx
  components/UploadProgressPanel.tsx
```

## DB portability feature module

Move DB portability after folder-upload behavior is covered:

```text
client/src/features/database/portability/
  lib/databaseOperationTypes.ts
  api/databasePortabilityApi.ts
  hooks/useDatabaseOperation.ts
  components/DatabaseSection.tsx
  components/DatabaseOperationModal.tsx
  components/DatabaseSwitchDialog.tsx
```

## Edit Metadata modules

Move channel-map, schedule, and derived-data client code separately from folder upload:

```text
client/src/features/edit-metadata/channel-map/
client/src/features/edit-metadata/schedule/
client/src/features/edit-metadata/derived-data/
```

Channel-map UI should not present itself as folder upload. Schedule upload should not present itself as folder upload. Both should show derived task progress.

## Hook ownership

| Hook | Owns |
|---|---|
| `useUpload` | start folder upload and poll upload task |
| `useUploadOperation` | modal state around folder upload |
| `useUploadedDatasets` | dataset tree/pagination |
| `useDatabaseOperation` | export/import wizard state |
| `useDerivedDataTask` | derived task polling |
| `useChannelMapOperation` | channel map save/upload and channel reprocess progress |
| `useScheduleOperation` | schedule save/upload and damage calculation progress |

## API module ownership

| API module | Owns |
|---|---|
| `uploadApi` | FormData build, start folder upload, poll upload task |
| `datasetApi` | list datasets, delete events, purge scopes |
| `derivedDataApi` | poll derived task |
| `databasePortabilityApi` | export/import ZIP workflow |
| `channelMapApi` | channel map save/upload |
| `scheduleApi` | schedule upload/save |

## UI rule

Progress components should render task state only. They should not infer or mutate backend workflow rules.

## TDD sequence

Use one red-green-refactor slice at a time:

1. Add a helper test for selected-file classification. Make the side panel and submit path consume the helper.
2. Add a metadata mapping test. Extract metadata payload building without changing labels or payload keys.
3. Add a hook/API polling test for transient retry and terminal summary behavior. Refactor only after the behavior is green.
4. Move files into the feature folder and leave compatibility exports in place.
5. Remove `UploadSidePanel` and `UploadContent` only after a search confirms no active imports.

Do not move folder upload, DB portability, channel-map, and schedule UI in one large PR.
