# Phase 37 Documentation Index

## Final Implementation Package

- `prd.md` — product intent, user stories, implementation decisions, testing decisions, scope.
- `IMPLEMENTATION_MAP.md` — shared technical contract for all coding agents.
- `HANDOFF.md` — issue order, resolved decisions, recovery notes, and completion protocol.
- `issues/` — sequential implementation batons.

## Issue Sequence

1. `issues/REF37-01-folder-upload-write-permission.md`
2. `issues/REF37-02-server-upload-policy-contract.md`
3. `issues/REF37-03-client-upload-policy-and-metadata.md`
4. `issues/REF37-04-folder-upload-progress-and-cancellation.md`
5. `issues/REF37-05-derived-lane-command-query-boundaries.md`
6. `issues/REF37-06-contributor-edit-policy.md`
7. `issues/REF37-07-remove-database-import.md`
8. `issues/REF37-08-database-export-and-connection-lane.md`
9. `issues/REF37-09-task-kind-reconciliation.md`
10. `issues/REF37-10-server-orchestration-cleanup.md`
11. `issues/REF37-11-client-module-migration.md`
12. `issues/REF37-12-golden-path-and-observability.md`

## Reference Package

The `references/` folder contains the analysis material that informed this package. It is not the implementation source of truth when it conflicts with the final PRD, implementation map, handoff, or issues.

Important resolved differences:

- Database import is removed from the active product surface.
- Contributors can edit channel-map and schedule data only for datasets they uploaded.
- Admins have uploaded-data CRUD and database create/connect/delete/export permissions.
- Folder upload is write/admin-only.
