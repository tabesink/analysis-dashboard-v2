# 04 — Lean Architecture Breakdown

## Dependency rule

Prefer simple dependency direction without forcing a full clean-architecture package. Pure policy helpers should not import FastAPI, React, DuckDB, pandas, or file upload classes. Existing production services may keep their concrete dependencies until a TDD slice justifies extraction.

```text
HTTP / UI adapters
        ↓
small orchestration functions or existing services
        ↓
pure lane policies and task constants
        ↓
DuckDB / filesystem / existing production services
```

## Pure policy layer

Owns product language and invariant rules.

Examples:

- `UploadLane`
- `UploadTaskKind`
- `DerivedTaskKind`
- CSV/RSP exclusivity policy
- channel-map filename classification
- `pending_channel_map` summary semantics
- named edit/delete permission policies

This layer must not know FastAPI `UploadFile`, browser `File`, FormData, DuckDB, or React.

## Orchestration layer

Owns workflow orchestration, but should remain thin and concrete.

First-wave candidates:

- folder upload start orchestration around `_parse_upload_payload` and `IngestionService.start_upload_task`
- client upload operation orchestration around `useUpload`
- DB import cache invalidation after `ExportService` completes import
- derived task response shaping around channel-map, schedule, and explicit backfill commands

Do not introduce a `ports.py` file by default. Prefer concrete functions with public-interface tests. Add protocols only when a concrete dependency makes an important behavior hard to test.

## Existing service layer

The current services remain the main implementation surface:

- `IngestionService` owns folder ingestion and channel reprocess.
- `DamageCalculationTaskService` owns damage task execution.
- `post_upload_precompute` owns deterministic post-upload repair/precompute decisions.
- `ExportService` owns DB import/export.
- `UnifiedStore` owns DuckDB persistence.

Refactor inside these services only after adding a behavior test that protects the public route/service contract.

## API adapter layer

Owns HTTP translation only.

FastAPI routers should:

1. authenticate and authorize
2. parse HTTP/form input
3. call use case
4. map result/error to response

They should not duplicate lane rules or ownership policies. Keep route compatibility stable while extracting helpers.

## UI adapter layer

Owns user interaction only.

React components should:

1. collect files and metadata
2. call a hook
3. render task progress
4. show result/error summary

They should not duplicate backend task logic or derived-data rules.

Client upload validation should use one shared helper in both the side-panel disabled state and the submit path so the UI cannot display one rule and submit another.
