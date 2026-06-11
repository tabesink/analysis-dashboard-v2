# Handoff — Assign Channels progress dialog (AC-25)

Use this document when picking up any issue in `issues/AC-25-*.md`. Full product spec: [prd.md](./prd.md).

## Mission

Make Assign Channels save and channel-map upload show a canonical import-style progress dialog that stays visible, survives closing Edit Metadata, and never misleads users with a fleeting toast while long-running `channel_reprocess` work continues server-side.

Keep the implementation lean: reuse UP-24 derived-data modal/store/polling; do not add a second progress system.

## What Already Exists

| Area | Status | Notes |
|------|--------|-------|
| `channel_reprocess` async task | Done (UP-24-01) | Save/upload returns task id quickly; server extracts load histories and generates LTTB. |
| Derived-data task polling API | Done | Lean status payload with phase, progress message, counters. |
| `DerivedDataOperationModal` | Done | Close-only progress + completion summary; shared with damage calculation. |
| `DerivedDataProgressPanel` | Done | Validating / extracting / generating stepper. |
| Channel reprocess store | Done | Scoped polling, modal/banner state, active-task reuse. |
| Metadata inline banner | Done (UP-24-02) | `ChannelReprocessBanner` inside Edit Metadata. |
| Upload operation modal pattern | Done | `UploadOperationModal` mounted on Database page shell. |
| Save/upload loading toast | Still present | Brief toast dismisses when start API returns; users perceive toast-only feedback. |
| Modal mount location | Gap | Modal currently rendered inside `MetadataEditDialog`; unmounts when editor closes. |
| Modal stacking | Gap | Operation modal and metadata editor both use the same z-index layer. |
| Database-page banner | Missing | No reopen affordance when Edit Metadata is closed. |

## Issue Order

1. `AC-25-01` — Shell-mount channel reprocess modal and fix stacking.
2. `AC-25-02` — Remove save/upload progress toast; modal-only feedback.
3. `AC-25-03` — Database-page background banner when metadata editor is closed.

`AC-25-01` and `AC-25-02` can ship together in one vertical slice. `AC-25-03` depends on shell mount from `AC-25-01`.

## Key Behavior

- Manual Assign Channels save and channel-map YAML upload open the derived-data progress modal after receiving a `channel_reprocess` task id.
- No loading toast on successful save/upload start paths.
- Modal mounts at Database page shell alongside upload import modal.
- Modal stacks above Edit Metadata.
- Close and continue in background does not cancel server work.
- Edit Metadata inline banner still reopens progress when editor is open.
- Database-page banner shows program/version and Reopen progress when editor is closed and task is running.
- Active-task reuse reopens existing task without duplicate polling.
- Completion invalidates channel-map-related queries and shows summary.
- Locked live messages from UP-24 remain authoritative.

## Locked Live Messages

```text
Validating artifact 3/10: event_042.csv
Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)
```

## Boundaries

- Do not add new backend tasks or schema.
- Do not create a duplicate modal component.
- Do not add a global task center.
- Do not unify upload and derived modals into one abstraction in this slice.
- Do not persist banners across routes outside the Database page.

## Verification Focus

- Save/upload opens visible progress dialog, not toast-only feedback.
- Dialog remains available after closing Edit Metadata on Database page.
- Dialog appears above metadata editor.
- Background dismiss + banner reopen works in editor and on database page.
- Active-task reuse still works.
- Completion summary and query invalidation unchanged.

## Documentation Updates When Shipping

- `[Unreleased]` entry in `CHANGELOG.md` for Assign Channels progress dialog UX.
- `docs/master-build-plan.md` rows for AC-25 issues.
- `docs/tasks/AC-25-*.md` for non-trivial slices.
- Append `docs/decisions/log.md` only if z-index or shell-mount pattern becomes a durable convention.
