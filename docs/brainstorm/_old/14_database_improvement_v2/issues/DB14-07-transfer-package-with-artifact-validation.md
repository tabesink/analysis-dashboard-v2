# DB14-07: Transfer package export/import with artifact validation

**Type:** AFK  
**Phase:** 4  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Extend transfer/export-import behavior to preserve source truth and validate package integrity:

- Export includes original artifacts, canonical CSV artifacts, channel-map snapshots, previews, schedules, measurements, LTTB rows, and manifest metadata.
- Import verifies artifact checksums and rejects corrupted or incomplete packages.
- Import validates that referenced artifact records exist and are resolvable.

## Acceptance criteria

- [ ] Export package contains all required artifact classes and derived usability data
- [ ] Import rejects checksum mismatch for source/schedule artifacts
- [ ] Import rejects references to missing artifacts
- [ ] Import validation errors are clear and non-destructive
- [ ] Legacy export/import path remains operational during transition (if still enabled)

## Blocked by

- DB14-05
- DB14-06

## Agent notes

- Keep portable URIs as database truth; do not persist absolute host-local paths.
