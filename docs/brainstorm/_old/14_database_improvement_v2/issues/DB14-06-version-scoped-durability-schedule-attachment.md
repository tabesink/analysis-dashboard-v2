# DB14-06: Version-scoped durability schedule attachment

**Type:** AFK  
**Phase:** 3  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Implement one active durability schedule artifact per program/version:

- Add schedule artifact storage with checksum and parse/preview metadata.
- Enforce write-access or admin permissions for attach/replace operations.
- Expose schedule context inheritance for events from their program/version.
- Keep replacement explicit and auditable.

## Acceptance criteria

- [ ] Program/version supports one active schedule attachment
- [ ] Schedule artifact metadata includes checksum and parse/preview info
- [ ] Attach/replace permission checks enforce owner-or-admin rules
- [ ] Event-level consumers can resolve inherited schedule context
- [ ] Replacement behavior is explicit and auditable

## Blocked by

- DB14-01

## Agent notes

- First release excludes per-event schedule overrides and full history manager.
