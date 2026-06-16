# DB14-00: ADR - artifact URI and lineage table contract

**Type:** HITL  
**Phase:** 0  
**Effort:** Low

## Parent

[prd.md](../prd.md)

## What to build

Resolve and document naming/contract decisions before implementation work starts:

1. Final artifact URI format (portable, data-root relative).
2. Initial lineage table names and minimum required columns for:
   - source artifacts
   - ingestion runs
   - event lineage references
3. Checksum algorithm and enforcement policy for imports.

Record the decision in `docs/decisions/log.md` and use it as the contract for DB14-01 onward.

## Acceptance criteria

- [ ] ADR decision captured in `docs/decisions/log.md`
- [ ] URI format includes examples for CSV and RSP source artifacts
- [ ] Minimum lineage schema contract is explicit enough for DB14-01 implementation
- [ ] DB14-01 is unblocked

## Blocked by

- None - can start immediately

## Agent notes

- This is a human-in-the-loop decision issue. Do not start DB14-01 until this contract is approved.
