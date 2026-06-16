# 03 — Target Folder Structure

## Backend first-wave structure

```text
server/
  upload/
    policies.py          # pure CSV/RSP/channel-map classification and lane rules
    task_kinds.py        # shared task kind constants
    permissions.py       # named scope permission policy wrappers, if extraction helps

  routers/
    upload.py            # existing routes remain until covered by tests
    dashboard.py         # channel-map/schedule lanes remain here initially
    damage.py            # inspect read and explicit backfill stay separate
    export.py            # DB portability remains separate
```

The first wave should avoid `ports.py`, repository packages, generic adapters, and a shared task runner. Add those only after a TDD slice shows the current concrete service boundary is blocking testability or readability.

## Backend later candidates

These are optional later moves, not first-wave requirements:

```text
server/routers/upload/folder_router.py
server/routers/upload/dataset_router.py
server/routers/dashboard/channel_map_router.py
server/routers/dashboard/schedule_router.py
server/routers/dashboard/derived_task_router.py
server/routers/export/database_portability_router.py
server/upload/staging.py
server/upload/in_process_task_runner.py
```

Router splitting should happen after behavior tests are green and route compatibility is locked down.

## Frontend target structure

```text
client/src/features/database/
  upload/
    lib/upload-file-policy.ts
    lib/upload-metadata.ts
    hooks/useFolderUploadOperation.ts
    components/FileDropZone.tsx
    components/UploadDataSection.tsx
    components/UploadOperationModal.tsx
    components/UploadProgressPanel.tsx

  datasets/
    api/datasetApi.ts
    hooks/useUploadedDatasets.ts
    components/DatabaseEventTree.tsx
    components/CsvPreviewTable.tsx

  portability/
    lib/database-operation-types.ts
    api/databasePortabilityApi.ts
    hooks/useDatabaseOperation.ts
    components/DatabaseSection.tsx
    components/DatabaseOperationModal.tsx
    components/DatabaseSwitchDialog.tsx

client/src/features/edit-metadata/
  channel-map/
    api/channelMapApi.ts
    hooks/useChannelMapOperation.ts
    components/ChannelMapUploadDialog.tsx
    components/AssignChannelsPanel.tsx

  schedule/
    api/scheduleApi.ts
    hooks/useScheduleOperation.ts
    components/ScheduleUploadDialog.tsx
    components/UploadScheduleSection.tsx
    components/DurabilitySchedulePanel.tsx

  derived-data/
    api/derivedDataApi.ts
    hooks/useDerivedDataTask.ts
    components/DerivedDataOperationModal.tsx
    components/DerivedDataProgressPanel.tsx
```

Move client files in small steps. First extract shared classification/metadata helpers used by both `UploadDataSection` and `/database` submit handling. Then move active `/database` upload components. Do not move channel-map, schedule, and DB portability UI in the same PR unless tests already cover their polling and invalidation behavior.

## Legacy components to deprecate

```text
UploadSidePanel
UploadContent
```

These should remain as compatibility wrappers during migration, then be removed once `/database` owns the primary upload surface.
