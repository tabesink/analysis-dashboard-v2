# Upload conversion progress in import dialog

## Constraint

**Lean, lightweight, low entropy.** Reuse existing columns and patterns; avoid new modules, callback abstractions, or parallel progress systems. Smallest diff that fixes the stuck UI.

## Problem

During RSP conversion and pre-write validation, the backend sets `phase=converting|validating` once with no counter updates. The client hard-codes those phases to **10%** in [`applyUploadTaskProgress`](client/src/hooks/use-upload.ts). A 57-file batch looks frozen on **Validating and converting** while the server logs per-file work.

## Solution (minimal surface area)

Use fields **already on `upload_tasks`**: `progress_message`, `completed_events`, `total_events`, `current_event`. No schema change. No `sub_phase`. No new Python/TS modules.

### Backend (~3 touch points)

1. **[`server/models/upload.py`](server/models/upload.py)** — add optional `progress_message` to `UploadTaskEvent`.

2. **[`server/routers/upload.py`](server/routers/upload.py)** — pass `progress_message` through `_build_upload_task_event` (one line).

3. **[`server/services/ingestion.py`](server/services/ingestion.py)** — per-file DB writes in existing loops only:
   - In `_normalize_files`: before each `rsp_converter.convert`, call existing `update_upload_task` via the task thread callback with inline message: `f"Converting RSP {i}/{total}: {filename}"`, `phase="converting"`, counters.
   - In both validation loops (~557 and ~711): before each parse/validate, same pattern with `f"Validating {i}/{total}: {filename}"`, `phase="validating"`.
   - Keep `on_event_committed` as-is for writing; optionally set `progress_message` to the same `Processed n/total: …` string the client already builds.

**Callback wiring (no new types):** Replace `on_phase_changed=lambda phase: …` in `start_upload_task` with `on_task_update=lambda **fields: self.db.update_upload_task(task_id, **fields)` and thread that through `ingest` / `_normalize_files`. Phase-only calls become `on_task_update(phase="validating")`. Same mechanism as derived tasks, one lambda — no separate `on_phase_changed` + `on_progress` split.

**No new `upload_progress.py`.** Two f-string templates inline at call sites.

### Frontend (~2 touch points)

1. **[`client/src/types/upload.ts`](client/src/types/upload.ts)** — add `progress_message?: string | null`.

2. **[`client/src/hooks/use-upload.ts`](client/src/hooks/use-upload.ts)** — expand `applyUploadTaskProgress` in place (no new file):
   - Prefer `data.progress_message` when set.
   - Derive stepper phase from server `data.phase` (`converting|validating` → validating step; `writing` → processing; else uploading).
   - Progress bands (two formulas only):
     - `converting` / `validating`: `10 + (completed / total) * 20` → 10–30%
     - `writing`: `30 + (completed / total) * 69` → 30–99%
   - XHR upload band unchanged (0–10%).

[`UploadProgressPanel`](client/src/components/blocks/dialog/upload-progress-panel.tsx) — **no changes**.

### Tests (minimal)

- Extend existing [`test_ingestion_service_status.py`](tests/server/services/test_ingestion_service_status.py): stub multi-file RSP convert; assert task-update callback receives per-file messages (mock list or capture kwargs).
- Extend [`test_upload_router.py`](tests/server/routers/test_upload_router.py): poll payload includes `progress_message`.
- **Skip** a new client test file unless band math proves fragile; hook logic is ~20 lines.

### Docs

- One-line [`CHANGELOG.md`](CHANGELOG.md) entry under `[Unreleased]`.
- **Skip** decisions log — incremental progress exposure, not an architectural fork.

## Out of scope

- Intra-file rpc-reader decode %
- New progress modules, mappers, or stepper components
- SSE changes, `sub_phase`, or derived-task modal unification
- Splitting converting vs validating into separate UI steps

## Target behavior

| Server phase | Dialog step | Example message |
|--------------|-------------|-----------------|
| `converting` | Validating and converting | `Converting RSP 3/57: file.rsp` |
| `validating` | Validating and converting | `Validating 3/57: file.rsp` |
| `writing` | Processing events | `Processed 12/57: event_id` |

Progress bar moves within 10–30% during convert/validate, 30–99% during writes.

## Implementation todos

- [ ] Server: thread `on_task_update` + per-file writes in convert/validate loops; expose `progress_message` on API
- [ ] Client: expand `applyUploadTaskProgress` + type field
- [ ] Tests: extend existing server tests only
- [ ] CHANGELOG one-liner
