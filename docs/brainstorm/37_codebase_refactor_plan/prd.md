# Phase 37 PRD — Upload, Derived Data, and Database Refactor

## Problem Statement

The current upload and derived-data area has grown into a high-risk coordination surface. Folder upload, channel-map upload, schedule upload, damage calculation, dataset lifecycle actions, database export/import, permissions, polling, and progress reporting are too close together in code and product language.

Coding agents need a phase-by-phase implementation package that makes the refactor safe to execute without rewriting the app. The refactor must preserve shipped behavior where it matters, fix the known write-permission gap, remove redundant database import capability, and make the workflow easier to test through public behavior.

## Solution

Refactor the area as a lean modular monolith with explicit lanes:

1. Folder upload creates canonical raw load-history data.
2. Channel-map upload/edit maps raw channels and triggers channel reprocess only.
3. Schedule upload/edit persists schedule rows and triggers damage calculation only when prerequisites are ready.
4. Inspect Damage reads persisted damage results and does not mutate data.
5. Database export and database create/connect/delete remain admin database operations.

The first implementation wave uses TDD tracer bullets. Each slice starts with one behavior test, makes the smallest change needed, then refactors while green. Existing endpoint URLs and user-facing payload shapes should remain stable unless a specific issue says otherwise.

## User Stories

1. As a contributor, I want to upload a dataset folder when I have write permission, so that I can ingest load histories I am responsible for.
2. As a read-only user, I want folder upload to be unavailable to me, so that shared database state cannot be changed by viewers.
3. As a contributor, I want CSV-only batches to upload successfully, so that standard load histories can be ingested.
4. As a contributor, I want RSP-only batches to upload successfully, so that RSP load histories can be converted and ingested.
5. As a contributor, I want mixed CSV and RSP batches rejected clearly, so that one upload batch has one canonical source format.
6. As a contributor, I want an optional channel-map file accepted as a folder-upload companion, so that initial channel mapping can travel with raw data.
7. As a contributor, I want unrelated files rejected or ignored consistently, so that UI and server validation agree.
8. As a contributor, I want upload metadata labels to keep their current meaning, so that existing workflow habits do not break.
9. As a contributor, I want `Program ID` to continue mapping to the existing job-number payload field, so that database records remain compatible.
10. As a contributor, I want upload progress to advance in a stable sequence, so that I can trust the operation modal.
11. As a contributor, I want upload failures and backend unavailability to be reported clearly, so that I know whether to retry.
12. As a contributor, I want cancellation to stop an active upload or polling operation when supported, so that I can recover from a mistaken submission.
13. As a user, I want lightweight validation, permission, success, and failure feedback reported through consistent toast notifications, so that routine information is visible without opening extra UI.
14. As a user running a long upload or database operation, I want the existing operation dialog to remain the place for detailed status, progress, cancellation, and terminal summaries, so that I can monitor the workflow without losing context.
15. As a contributor who uploaded a dataset, I want freedom to edit its channel-map data, so that I can fix channel assignments for data I own.
16. As a contributor who uploaded a dataset, I want freedom to edit its schedule data, so that I can correct durability metadata for data I own.
17. As a contributor, I must not edit channel-map or schedule data for datasets I did not upload, so that ownership boundaries are preserved.
18. As an admin, I want CRUD authority over any uploaded data, so that I can operate and repair the shared database.
19. As an admin, I want database create, connect, and delete actions restricted to admins, so that whole-database operations stay controlled.
20. As an admin, I want database export to stay available, so that I can create a portable snapshot.
21. As an admin, I do not want database import exposed in this workflow, so that redundant and risky restore behavior is removed.
22. As a contributor, I want channel-map upload/edit to trigger channel reprocess only, so that plot-ready data is regenerated without silently calculating damage.
23. As a contributor, I want schedule upload/edit to trigger damage calculation only when channel prerequisites are current, so that derived damage is calculated from valid inputs.
24. As a user inspecting damage, I want Inspect Damage to read existing persisted results only, so that viewing data does not mutate the database.
25. As a write user, I want explicit damage backfill to remain a visible repair command, so that repairs are intentional and auditable.
26. As an operator, I want stale or interrupted tasks reconciled at startup, so that long-running task status does not remain misleading after restart.
27. As an operator, I want one active derived-data task per program/version, so that concurrent channel or damage work does not corrupt derived outputs.
28. As a coding agent, I want named task kinds and lane policies, so that I can modify one workflow without confusing it with another.
29. As a coding agent, I want small compatibility-preserving moves, so that large client and server modules can be reorganized safely.
30. As a reviewer, I want each issue to include behavior tests and completion notes, so that phase progress can be verified without reading every implementation detail.

## Implementation Decisions

- Keep the app as a FastAPI, DuckDB, Next.js modular monolith. Do not introduce microservices, external queues, generic ports/adapters, or repository scaffolding in the first wave.
- Keep current production services as the implementation anchors until a test proves a narrower interface is needed: folder ingestion service, damage calculation task service, post-upload precompute decisions, database export service, and the DuckDB store.
- Preserve current public endpoint URLs and response shapes unless a slice explicitly removes a deprecated capability.
- Treat folder upload as a write path. It must require write/admin permission.
- Define a pure upload policy module for CSV/RSP exclusivity, supported extension classification, optional channel-map companion detection, lane names, task kinds, and phase names. Pure policy code must not import FastAPI, React, DuckDB, pandas, browser `File`, or filesystem adapters.
- Keep channel-map and schedule contributor edit policies distinct from delete policies. Contributors with write permission can edit channel-map and schedule data for datasets they uploaded. They cannot edit or delete event channel-map or schedule data uploaded by someone else. Admins have CRUD permission for uploaded data.
- Keep program/version scope deletion stricter than edit. Scope deletion remains exclusive-owner-or-admin or admin according to the existing shipped behavior.
- Restrict database create, connect, and delete to admins.
- Remove database import from the active product surface. Database export remains an admin portability operation, and admins can connect to exported or created databases through the supported database-connection workflow.
- Keep DB export separate from folder upload. It is whole-database portability, not event-level ingestion.
- Keep channel-map upload/edit responsible for channel assignments and channel reprocess only.
- Keep schedule upload/edit responsible for schedule rows and damage calculation eligibility only.
- Keep Inspect Damage read-only. Explicit backfill remains the write-user repair path.
- Add task-kind constants and stale/running task reconciliation before considering a shared bounded task runner.
- Make progress reporting task-kind aware and phase ordered. UI progress components should render task state and should not infer backend workflow rules.
- Use the existing toast system as the canonical lightweight user-notification channel for validation errors, permission failures, ignored-file notices, completed actions, and non-blocking success/error feedback.
- Keep operation dialogs/modals for upload status and other long-running operation content. Toasts may announce start, completion, cancellation, or failure, but they must not replace detailed progress, task phase, retry/cancel affordances, or terminal summaries in dialogs.
- Move frontend code gradually. First extract shared upload-file and upload-metadata helpers, then move folder upload, database export/connection UI, and edit-metadata lanes in separate slices.
- Treat legacy upload components as compatibility wrappers during migration. Do not extend them with new behavior.

## Testing Decisions

- Use TDD tracer bullets: one failing behavior test, minimal implementation, refactor while green, then repeat.
- Prefer tests through public interfaces: server routes, service contracts already used by routes, client hooks/API helpers, and pure policy functions.
- Do not write a full imagined test matrix before implementation.
- Server route tests should cover folder-upload authorization, channel-map/schedule authorization, derived-task boundaries, and removed database import routes.
- Pure policy tests should cover CSV-only, RSP-only, mixed CSV/RSP rejection, channel-map companion detection, unsupported file handling, task kind names, and ordered phase mapping.
- Client tests should cover shared selected-file classification, metadata payload mapping, toast notification behavior, progress normalization, transient polling failure reporting, terminal summaries, and cancellation behavior where the public hook exposes it.
- Integration coverage should build toward the golden path: folder upload, optional channel map, channel reprocess, schedule upload, damage calculation, Inspect Damage read.
- Database export and database connection coverage should remain separate from the event-level upload golden path.
- Each implementation issue must update or create a completion note under `docs/tasks/` describing behavior changed, interfaces changed, tests added, and follow-on assumptions.

## Out of Scope

- Replacing DuckDB.
- Introducing Celery, RQ, Redis, or another external queue.
- Rewriting upload, edit metadata, damage, and database management in one pass.
- Splitting all routers before behavior coverage exists.
- Streaming uploaded files to scratch/staging storage in the first wave.
- Adding an admin diagnostics panel unless a later reliability issue explicitly needs it.
- Preserving database import as a product capability.
- Letting Inspect Damage compute, repair, or backfill as a side effect of read access.

## Further Notes

The source reference package for this PRD lives in `docs/brainstorm/37_codebase_refactor_plan/references/`. Those files are background rationale. The implementation source of truth for agents is this PRD, `IMPLEMENTATION_MAP.md`, `HANDOFF.md`, and the issue files under `issues/`.

When code symbols are edited, agents must run GitNexus impact analysis before editing and `detect_changes()` before committing, per repository rules.
