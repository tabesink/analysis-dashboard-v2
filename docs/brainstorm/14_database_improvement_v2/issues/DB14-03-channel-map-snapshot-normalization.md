# DB14-03: Channel-map snapshot normalization across YAML and UI

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Implement unified channel-map normalization:

- Add a small normalization service that accepts YAML-uploaded and UI-authored maps.
- Persist a common channel-map snapshot model with authoring provenance (`yaml` vs `ui`).
- Enforce one active snapshot per program/version for new ingestion.
- Link each event to the snapshot used during ingestion.

## Acceptance criteria

- [ ] YAML and UI channel-map authoring paths normalize into one snapshot shape
- [ ] Program/version has one active snapshot for new ingestion
- [ ] Event stores snapshot reference used for measurement/LTTB derivation
- [ ] Later map edits do not mutate historical event lineage
- [ ] Ownership/permission checks remain enforced on write paths

## Blocked by

- DB14-02

## Agent notes

- Verify cache invalidation for channel-map write/update paths.
