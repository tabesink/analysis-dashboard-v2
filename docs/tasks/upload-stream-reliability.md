# Upload stream reliability

**Status:** DONE (2026-06-09)

## Summary

Replaced SSE-only folder upload completion with DuckDB-backed task polling and deferred auth redirects during active uploads.

## Changes

- `server/routers/upload.py` — `GET /upload/folder/task/{task_id}`, shared `_build_upload_task_event`.
- `client/src/lib/api/upload.ts` — `getUploadTaskStatus`, `waitForUploadTask`.
- `client/src/hooks/use-upload.ts` — poll-only completion waiter.
- `client/src/stores/ui-store.ts` — `folderUploadInProgress` flag.
- `client/src/stores/auth-store.ts`, `use-data-version-sync.ts`, `database/page.tsx` — defer redirect/sync during upload.

## Tests

- `tests/server/routers/test_upload_router.py` — creator-scoped task GET.
- `client/src/lib/api/upload.test.ts` — poll completion and gateway retry.

## Decision

- DEC-080
