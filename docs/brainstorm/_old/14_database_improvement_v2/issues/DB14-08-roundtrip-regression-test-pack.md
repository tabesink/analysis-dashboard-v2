# DB14-08: Round-trip regression test pack for source-truth model

**Type:** AFK  
**Phase:** 5  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Add behavior-focused integration/regression coverage for the full lean model:

- CSV round-trip: source artifact, preview, measurements, LTTB, transfer validation.
- RSP round-trip: original RSP retained + canonical CSV retained + downstream parity.
- Channel maps: YAML and UI paths produce equivalent normalized snapshots.
- Durability schedule: one-active-per-version behavior and permission checks.
- Transfer import: rejects corrupted/missing artifacts.

## Acceptance criteria

- [x] CSV round-trip test covers lineage and artifact retention
- [x] RSP round-trip test verifies dual-artifact retention (original + canonical)
- [x] Channel-map equivalence tests pass for YAML vs UI authored maps
- [x] Durability schedule tests enforce one-active-per-version and write permissions
- [x] Transfer import tests fail on checksum mismatch and missing artifact references

## Blocked by

- DB14-07

## Agent notes

- Prefer durable behavior assertions over private helper assertions.
