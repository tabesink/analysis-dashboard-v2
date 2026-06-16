---
name: Upload Refactor Validation
overview: Revise the upload architecture recommendations so they fit the current lean modular monolith, preserve existing lane behavior, and make only the agreed hardening changes explicit.
todos:
  - id: revise-docs
    content: Revise the upload recommendation docs to replace full clean-architecture scaffolding with the aligned lean vertical extraction plan.
    status: completed
  - id: frontload-tests
    content: Specify first-wave TDD tracer bullets for upload validation, permissions, client metadata mapping, task polling, and Inspect Damage backfill.
    status: completed
  - id: capture-decisions
    content: Add or update decision notes for upload lanes, explicit backfill, write/admin upload permission, deferred staging, and separate ownership policies.
    status: completed
  - id: prepare-implementation
    content: Prepare a red-green-refactor implementation sequence that starts with pure helpers and small hardening changes before file moves or runner work.
    status: completed
isProject: false
---

# Revised Upload Refactor Plan

## What I Would Change In The Existing Recommendation

The lane model in [docs/brainstorm/37_analysis_dashboard_upload_recommendations_md](docs/brainstorm/37_analysis_dashboard_upload_recommendations_md) is sound, but the implementation should be leaner than the proposed full clean-architecture package. Keep the product boundaries: folder upload, channel map reprocess, schedule/damage, DB import/export. Do not introduce broad ports/adapters/repository scaffolding before it removes real complexity.

Revise the plan to use vertical extractions around the current code:

- [server/routers/upload.py](server/routers/upload.py): extract pure upload classification/validation helpers and switch folder upload to `WriteUserDep`.
- [server/services/ingestion.py](server/services/ingestion.py): keep `IngestionService` as the production ingestion engine; wrap or split only where tests prove a smaller unit is useful.
- [server/routers/dashboard.py](server/routers/dashboard.py): preserve channel-map and schedule lanes; name their ownership policy separately from delete policy.
- [server/routers/damage.py](server/routers/damage.py): document that inspect read is read-only, while explicit `backfill` remains a write-user repair action.
- [client/src/app/database/page.tsx](client/src/app/database/page.tsx) and [client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx): consolidate duplicated upload classification/required-field logic before moving files.

## Revised Phases

1. Characterize behavior with TDD tracer bullets. Add one failing behavior test at a time, then make the smallest implementation change to pass before moving to the next behavior. Start with upload file classification, required metadata mapping, read-only user upload rejection, task polling/progress, and explicit Inspect Damage backfill semantics.

2. Extract pure upload policy helpers. Move CSV/RSP exclusivity, channel-map filename detection, supported extension rules, required metadata checks, and task-kind constants into small modules. Avoid creating broad `ports.py` abstractions now.

3. Apply agreed hardening. Change folder upload from authenticated-only to write/admin-only. Clear runtime query cache after successful DB import if tests confirm stale cache behavior. Preserve current endpoint URLs and response shapes.

4. Split client upload concerns before moving folders. Introduce a small shared upload classification helper used by both `UploadDataSection` and `handleUpload`. Then move the active `/database` upload pieces into a feature folder while leaving legacy wrappers untouched until imports are gone.

5. Keep task infrastructure incremental. Add shared task-kind constants and startup reconciliation for persisted `upload_tasks` where needed. Do not introduce a single generic runner for DB import/export, folder upload, and derived tasks in the first wave.

6. Defer upload staging. Keep the current byte-based ingestion path during the structural refactor. Treat streaming-to-scratch as a later reliability feature with cleanup, lifecycle, and failure tests.

7. Update the recommendation docs. Rewrite the existing plan files to reflect the lean implementation sequence, the explicit permission decision, the explicit Inspect Damage backfill boundary, and the deferred staging/task-runner decisions.

## TDD Guardrails

Use vertical red-green-refactor slices. Do not write the whole test suite up front. Each slice should name an observable behavior through a public interface, add the minimum code to pass, then refactor only while green.

Recommended first tracer bullets:

- Backend route behavior: a read-only authenticated user cannot start a folder upload.
- Backend upload behavior: CSV-only and RSP-only batches are accepted, mixed CSV/RSP batches are rejected.
- Frontend behavior: the same selected-file set produces the same validation result in the side panel and upload submit path.
- Frontend behavior: upload metadata preserves the existing label-to-payload mapping, including `Program ID` to `job_number`.
- Derived-data behavior: Inspect Damage read remains read-only, and explicit write-user backfill starts or reuses a `damage_calculation` task only when prerequisites allow it.
- Portability behavior: after a successful DB import, stale query results are not served from runtime cache.

## Decisions Captured

- First wave uses lean vertical extraction, not full clean architecture.
- Folder upload should require write/admin permission.
- Folder upload, channel map, schedule, DB import, and DB export remain separate lanes.
- Inspect Damage read remains read-only; explicit write-user backfill stays as a repair path.
- File staging is deferred.
- Task infrastructure starts with constants/reconciliation, not a generic job platform.
- Edit/delete ownership semantics stay separate and should be named clearly.

## Verification

Run focused backend and client tests around upload validation, permissions, task polling, derived-data repair, and DB import cache behavior. Before any symbol edits, run GitNexus impact analysis on the target symbols and report blast radius.