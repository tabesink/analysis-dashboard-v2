# PRD: Create and Connect Databases from Database Route

**Feature area:** Database administration, runtime data source switching  
**Iteration:** Immediate implementation  
**Last updated:** 2026-06-09 (P14-12)

---

## Problem Statement

Operators with an already-populated database need a safer workflow to start fresh work without risking the current dataset. Today they can import/export load data, but they cannot create a brand new database and switch runtime to it from the UI.

The system also needs an explicit way to reconnect to a specific existing database file for rollback or parallel dataset workflows, without manually editing server configuration.

## Solution

Add two runtime database actions on the Database route:

1. **Create New Database** (admin-only):
   - Requires typed confirmation.
   - Creates `dashboard-<timestamp>.db`.
   - Initializes schema/migrations.
   - Runs health checks.
   - Switches runtime only after checks pass.
   - Returns previous database path for rollback.

2. **Connect Database** (write user or admin):
   - Lists available managed `dashboard*.db` files.
   - Lets the user select a database.
   - Requires typed confirmation that includes selected file.
   - Initializes/migrates and health-checks selected DB.
   - Switches runtime only after checks pass.
   - Returns previous database path for rollback.

UI requirement:
- Add a new row above export in the Database side panel for admins: **Create New Database**.
- Add **Connect Database** action so write users/admins can choose which DB to load.
- Use a modal UX (not browser prompts) with typed confirmation and searchable DB picker.

## User Stories

1. As an admin, I want to create a new empty database with typed confirmation so accidental resets are prevented.
2. As an admin, I want new databases named with timestamps so I can identify creation order and purpose.
3. As an admin, I want schema initialization and health checks before switch so runtime never points to a broken DB.
4. As an operator, I want the previous DB path returned after a switch so rollback is straightforward.
5. As a write user, I want to connect to an existing managed database from UI so I can load the dataset I need without server restarts.
6. As a team, we want confirmation-gated switching so loading the wrong database is less likely.

## Implementation Decisions

- Keep managed databases under configured data root and only allow managed `dashboard*.db` filenames for connect.
- Enforce typed confirmation on backend (not only frontend) for both create and connect actions.
- Perform switch by building a new DB store, running health checks, then swapping active runtime references atomically.
- Rebuild session manager against the newly active store after switch.
- Preserve rollback path by returning previous database metadata in response and keeping prior DB file untouched.
- Keep portability export/import flow unchanged; this feature adds runtime source selection, not transfer semantics changes.

## Testing Decisions

- Router tests must cover:
  - unauthenticated rejection for create/connect,
  - admin create success,
  - write-user connect success to managed DB.
- Verify active DB path changes after successful switch.
- Verify database catalog includes both previous and newly created DB files.
- Continue existing export/import route contract tests to ensure no regressions in portability workflow.

## Out of Scope

- Multi-database project manager UI with labels/metadata.
- Per-user isolated active database selection.
- Automatic pruning/retention policies for old DB files.
- Converting transfer package format or import/export semantics.

## Further Notes

This is a safety-first runtime switch feature. It intentionally keeps the model simple:
- one active runtime DB at a time,
- explicit typed confirmations,
- explicit rollback reference via previous DB path.
