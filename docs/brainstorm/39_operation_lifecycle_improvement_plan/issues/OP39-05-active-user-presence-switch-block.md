# OP39-05 — Block Database Switch When Users Are Active

## Type

AFK

## Context Packet

- `docs/brainstorm/39_operation_lifecycle_improvement_plan/prd.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/IMPLEMENTATION_MAP.md`
- `docs/brainstorm/39_operation_lifecycle_improvement_plan/HANDOFF.md`
- Existing auth/session, database connection, settings/database UI, and toast tests

## Previous Slice Provides

Operation admission guards block database switch/delete when mutating operations or exclusive admin operations are active.

## What To Build

Add lightweight active-user presence and include it in database-switch blocking.

When an admin attempts to switch databases while other users are active, the server should reject the switch with structured active-user data. The client should toast a message naming active users.

## This Slice Changes

- Presence heartbeat endpoint/API helper.
- Host-local or active-runtime presence storage that is not confused with long-lived saved sessions.
- Database switch guard that checks active users on the current database.
- Client heartbeat behavior for authenticated users.
- Client toast behavior for blocked database switch with active usernames.

## This Slice Must Not Rework

- Authentication/session semantics beyond heartbeat identity.
- Database create/export/delete behavior unless needed for shared response types.
- Operation admission guards from `OP39-04` except to include active-user blocking for switch.
- Force-switch behavior. Force switch is out of scope.

## Acceptance Criteria

- [x] Authenticated clients send a lightweight heartbeat while using the app.
- [x] Presence records identify user id, username, active database, and last-seen time.
- [x] Presence expires by time threshold rather than saved session lifetime.
- [x] Database switch returns a blocked response when active users are present on the current database.
- [x] The blocked response includes active usernames.
- [x] The client shows a toast naming active users when database switch is blocked.
- [x] The current admin is not counted as a blocker for their own switch attempt unless another active session for the same user should intentionally block.
- [x] Expired presence does not block switching.
- [x] Tests cover multi-user blocking and expiry behavior.
- [x] `docs/tasks/OP39-05.md` records behavior changed, interfaces changed, tests added, and residual risks.
- [x] GitNexus impact analysis is run before editing presence, auth/session, or database-switch symbols.
- [x] Focused tests pass.

## Blocked By

- `OP39-04`

## Next Slice Can Assume

Database switch is blocked by active operations and active users, with structured server responses and user-facing toast feedback.
