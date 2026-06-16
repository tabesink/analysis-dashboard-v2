# 09 — Testing, Observability, Reliability, and Security

## Testing recommendations

### TDD rule

Use vertical red-green-refactor slices. Do not write the full test matrix first. Each test should verify behavior through a public route, hook, API helper, or pure policy function, then the implementation should do the minimum needed to pass.

### First tracer bullets

Recommended order:

1. `POST /api/v1/upload/folder/start` rejects read-only authenticated users.
2. Folder upload policy accepts CSV-only batches.
3. Folder upload policy accepts RSP-only batches.
4. Folder upload policy rejects mixed CSV/RSP batches.
5. Client selected-file classification returns the same result for side-panel display and submit handling.
6. Client metadata payload preserves the existing label mapping, including `Program ID` to `job_number`.
7. `POST /damage/inspect` remains read-only while `POST /damage/backfill` explicitly starts/reuses `damage_calculation` only when allowed.
8. Successful DB import does not serve stale cached query results.

### Pure policy tests

Test pure lane policies:

- CSV/RSP exclusivity
- upload lane classification
- task kind classification
- schedule damage multiplier formula
- prerequisite checks for damage calculation

### Route and workflow tests

Prefer public route/workflow tests over fake-port use-case tests in the first wave:

- folder upload creates a task for write/admin users
- folder upload rejects read-only users
- failed staging marks task failed
- channel map upload starts only channel reprocess
- schedule upload starts damage only when prerequisites are ready
- DB import requires admin intent/confirmation

### Integration tests

Test with a temporary DuckDB file:

- upload creates events and artifacts
- channel reprocess writes LTTB rows
- schedule writes schedule rows
- damage calculation writes `event_channel_damage`
- Inspect Damage reads only persisted rows
- DB export creates ZIP
- DB import validates and restores
- DB import clears runtime query cache after restore

### Golden-path test

Build toward this path incrementally:

```text
folder upload → channel map → schedule upload → damage calculation → inspect damage
```

Keep DB export/import coverage separate from this path.

## Observability recommendations

Add structured task events:

```json
{
  "task_id": "...",
  "task_kind": "folder_upload",
  "program_id": "...",
  "version": "...",
  "phase": "validating",
  "progress": 42,
  "message": "Validated 12 of 30 files"
}
```

Every task should record:

- creator
- task kind
- scope
- start time
- update time
- terminal state
- error code
- error message
- result summary

## Reliability recommendations

- one active derived task per `(program_id, version)`
- idempotent writes for derived outputs
- startup reconciliation for stale tasks
- bounded task runner as a later reliability slice
- scratch file cleanup when upload staging is introduced
- failure status visible to user
- retry path for failed derived tasks

## Security recommendations

- DB import/export must be admin-only.
- Event delete/purge must require write/admin role.
- Folder upload must require write/admin role.
- Folder upload should validate allowed extensions server-side.
- Staged files, when introduced, should be stored outside public static directories.
- ZIP import must protect against zip-slip paths.
- Upload limits should be enforced during the current byte-read path and again during future staging.
- LAN insecure-cookie mode should be explicit and documented.

## Operational recommendations

Add an admin diagnostics panel showing:

- active upload tasks
- active derived tasks
- failed/stale tasks
- DB file path
- DB size
- scratch directory size
- last export artifact
- import/export status
