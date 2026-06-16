# DB14-02: Canonical CSV derivation and ingestion-run linkage

**Type:** AFK  
**Phase:** 0  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Create a shared ingestion entrypoint so CSV and RSP follow the same downstream path:

- For CSV uploads: register canonical CSV linkage (may represent same logical content).
- For RSP uploads: generate canonical CSV artifact and record relation to original RSP artifact.
- Add ingestion-run records that capture parser/conversion metadata and link events to the run.

## Acceptance criteria

- [ ] RSP uploads generate canonical CSV artifact and preserve original RSP artifact
- [ ] CSV and RSP ingestion paths converge at canonical CSV processing stage
- [ ] Event lineage references ingestion run identifier
- [ ] Conversion/parser metadata is queryable for audit/debug
- [ ] Existing event creation remains functional

## Blocked by

- DB14-01

## Agent notes

- Keep canonical CSV explicitly marked as derived data, never source-of-truth.
