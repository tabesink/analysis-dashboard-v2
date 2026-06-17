# Phase 40 Handoff

## Mission

Implement a shared cancellation and recovery contract for all long-running operations stored in `upload_tasks`: `folder_upload`, `channel_reprocess`, and `damage_calculation`. Keep the system lightweight and in-process. Do not introduce a queue service.

## Required Reading

1. `docs/brainstorm/40_cancel_upload_plan/prd.md`
2. `docs/brainstorm/40_cancel_upload_plan/IMPLEMENTATION_MAP.md`
3. The current issue file under `docs/brainstorm/40_cancel_upload_plan/issues/`
4. Phase 39 lifecycle context:
   - `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
   - `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
5. Repo agent rules in `AGENTS.md`

## Issue Order

1. `CU40-01-upload-task-lifecycle-state-and-heartbeat.md`
2. `CU40-02-cancel-request-policy-and-endpoints.md`
3. `CU40-03-cooperative-folder-upload-cancellation.md`
4. `CU40-04-cooperative-derived-task-cancellation.md`
5. `CU40-05-reconnect-active-task-discovery-and-ui-recovery.md`
6. `CU40-06-auth-database-responsiveness-and-final-regression.md`

## Current Baton

- `CU40-01` is implemented (lifecycle state/timestamps/heartbeat baseline).
- `CU40-02` is implemented (cancel policy, canonical/alias endpoints, idempotent cancel-intent persistence, and API helper typing/tests).
- `CU40-03` is implemented (cooperative folder-upload cancellation checkpoints, cancelled partial-upload cleanup/retry parity, and server-driven cancel polling UI semantics).
- `CU40-04` is implemented (derived task cancellation now cooperatively transitions through `cancelling` to `cancelled` with modal/state parity).
- `CU40-05` is implemented (active/recent task discovery endpoint plus reconnect recovery wiring for folder upload and derived-task progress surfaces).
- `CU40-06` is implemented (auth login responsiveness under dashboard DB contention plus final operation-admission regressions for `cancelling` and stale-heartbeat reconciliation).
- Phase 40 is complete for cancellation/recovery core contracts; follow-on work should focus on performance/operability hardening, not lifecycle semantics changes.
- The implementation map defines the canonical contract:
  - active states: `queued`, `running`, `cancelling`
  - terminal states: `completed`, `failed`, `cancelled`
  - server-side cancel is idempotent
  - workers stop cooperatively at safe checkpoints
  - stale worker heartbeats fail closed
  - browser reconnect uses server task discovery, not ephemeral client state
- Completed in `CU40-01`:
  - `upload_tasks` schema now carries `started_at`, `cancel_requested_at`, `finished_at`, `last_heartbeat_at`, `runner_id`
  - `ACTIVE_TASK_STATUSES` now includes `cancelling`
  - startup stale-task reconciliation now includes `cancelling` and stamps `finished_at`
  - request-time stale heartbeat reconciliation is wired into operation admission and upload task polling routes
  - blocker payloads and upload task status payloads now expose heartbeat/cancel timing fields
- Completed in `CU40-02`:
  - shared cancel authorization policy now gates folder vs derived task cancellation semantics
  - canonical cancel endpoint is live at `POST /api/v1/upload/tasks/{task_id}/cancel`
  - compatibility aliases are live for folder and derived routes
  - cancel request persistence is idempotent for active/cancelling/terminal states
  - typed cancel acknowledgement helpers are exposed in client API modules
- Completed in `CU40-05`:
  - authenticated reconnect discovery route is live at `GET /api/v1/upload/tasks/active`
  - discovery reconciles stale upload-task heartbeats before response shaping
  - folder upload visibility is creator-scoped; derived visibility is admin-or-scope-owner scoped
  - discovery returns active tasks and recent failed/cancelled folder uploads for reconnect guidance
  - client database startup now requests discovery and restores upload/derived progress surfaces from server state
  - route/auth redirect and sync polling no longer depend on `folderUploadInProgress` as a durable recovery gate
- Completed in `CU40-06`:
  - login route now uses bounded best-effort dashboard audit writes so auth remains available during dashboard DB lock contention
  - login no longer fails when dashboard audit persistence is unavailable/contended
  - database switch/delete admission regressions now explicitly cover active `cancelling` upload tasks and stale `cancelling` heartbeat reconciliation

## Resolved Product Decisions

- Do not introduce Celery, Redis, RQ, or an external queue for Phase 40.
- Cancel means a server-acknowledged request to stop at a safe checkpoint; it does not promise instant interruption of an in-flight DuckDB statement.
- Browser close means the client detached. It must not imply cancellation.
- Folder upload partial-data cleanup semantics from Phase 39 should be reused for cancelled partial uploads.
- `folder_upload` visibility remains creator-scoped.
- Derived task visibility and cancellation are admin-or-scope-owner scoped.

## TDD Operating Notes

Use one red-green-refactor behavior at a time. Favor public route tests, hook/API helper tests, rendered UI behavior, and pure lifecycle policy tests.

Required cycle for every issue:

1. Pick one observable behavior from the acceptance criteria.
2. Add one failing test through the public interface that owns that behavior.
3. Implement the smallest change needed to pass.
4. Refactor only after the focused test is green.
5. Repeat for the next behavior.

Before editing code symbols, run GitNexus impact analysis for the target symbol and report the blast radius. Before committing, run GitNexus `detect_changes()` and focused tests.

## Recovery Notes

If cancellation cannot safely interrupt a database write, keep the worker cooperative and improve progress copy. Do not attempt unsafe thread interruption.

If adding explicit timestamp columns creates migration risk, stop and update the implementation map with the chosen schema path before implementing downstream slices.

If a task kind cannot support cancellation in one slice, hide or disable Cancel for that task kind until the server contract exists.

## Completion Protocol

For each completed issue:

- update the issue file with a short completion note or link to `docs/tasks/{task-id}.md`
- create or update `docs/tasks/{task-id}.md`
- update this file with any new assumption for the next issue
- update `IMPLEMENTATION_MAP.md` if contracts changed
- update `CHANGELOG.md` for user-facing behavior changes
- run focused tests and lints
- run GitNexus `detect_changes()` before committing

