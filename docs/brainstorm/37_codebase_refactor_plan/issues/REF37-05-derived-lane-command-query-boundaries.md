# REF37-05 — Preserve Derived Data Command/Query Boundaries

## Type

AFK

## Context Packet

- `docs/brainstorm/37_codebase_refactor_plan/prd.md`
- `docs/brainstorm/37_codebase_refactor_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/37_codebase_refactor_plan/HANDOFF.md`
- Reference: `references/05_upload_lane_design.md`
- Reference: `references/06_server_refactor_plan.md`
- Existing derived-data task, schedule, channel-map, Inspect Damage, and backfill tests

## Previous Slice Provides

Folder-upload progress is separated from downstream task progress.

## What To Build

Lock down the derived-data lane boundaries with behavior tests and any small naming or orchestration cleanup needed to make the boundaries explicit. Channel-map upload/edit should trigger channel reprocess only. Schedule upload/edit should persist schedule rows and start damage calculation only when prerequisites are current. Inspect Damage should read persisted rows only. Explicit backfill remains the visible write-user repair command.

## This Slice Changes

- Behavior tests around channel-map, schedule, Inspect Damage, and backfill boundaries.
- Small route/service naming or response-shaping cleanup if tests show the current behavior is ambiguous.
- Documentation updates for the derived-data command/query contract.

## This Slice Must Not Rework

- Folder-upload ingestion.
- Contributor ownership policy extraction.
- Database export/import.
- Generic task runner design.
- Client module moves beyond naming needed to display the correct task kind.

## Acceptance Criteria

- [ ] A behavior test proves channel-map upload/edit starts or reports channel reprocess only.
- [ ] A behavior test proves schedule upload/edit starts damage calculation only when prerequisites are ready.
- [ ] A behavior test proves Inspect Damage does not create, repair, or backfill damage rows as a side effect.
- [ ] A behavior test proves explicit backfill is the visible write-user repair command.
- [ ] Existing one-active-derived-task behavior remains green.
- [ ] User-visible names distinguish folder upload, channel reprocess, damage calculation, and backfill.
- [ ] `IMPLEMENTATION_MAP.md` is updated if any task-kind or response-shaping contract changes.
- [ ] `docs/tasks/REF37-05.md` records behavior changed, interfaces changed, and tests added.
- [ ] GitNexus impact analysis is run before editing derived-data symbols.
- [ ] Focused tests pass.

## Blocked By

- `REF37-04`

## Next Slice Can Assume

Derived-data workflows are explicitly separated from folder upload and Inspect Damage is protected as a read model.
