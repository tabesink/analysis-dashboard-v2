# DB14-01: Source artifact storage service and ledger records

**Type:** AFK  
**Phase:** 0  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Implement the source artifact storage vertical slice:

- Add a small storage service that writes uploaded CSV and RSP bytes as immutable managed artifacts.
- Create lineage metadata records in DuckDB for each source artifact with:
  - artifact type
  - checksum
  - portable artifact URI
  - ownership/created metadata
- Ensure upload code paths use this service rather than constructing file paths inline.

## Acceptance criteria

- [ ] CSV upload stores immutable original artifact bytes outside DuckDB
- [ ] RSP upload stores immutable original artifact bytes outside DuckDB
- [ ] Artifact metadata record includes checksum and portable URI
- [ ] Unsafe artifact path input is rejected
- [ ] Existing upload behavior remains functional

## Blocked by

- DB14-00

## Agent notes

- Consult `docs/database-schema.txt` before schema changes and update it if schema changes are made.
