# DB14-04: Event preview metadata generated from canonical CSV

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Add an event preview service that derives and stores lightweight preview metadata from canonical CSV:

- headers and units (when available)
- first rows sample
- row/column counts
- parser warnings
- source/canonical artifact references

Preview metadata must remain lightweight and must not duplicate full file contents in DuckDB.

## Acceptance criteria

- [ ] Each ingested event has preview metadata
- [ ] Preview is derived from canonical CSV for both CSV and RSP uploads
- [ ] Preview includes headers, first rows, row/column counts, and warnings
- [ ] Preview storage remains lightweight (no full file duplication in DB)
- [ ] Existing event retrieval flows remain functional

## Blocked by

- DB14-02

## Agent notes

- Keep preview generation encapsulated in one service callable from ingestion.
