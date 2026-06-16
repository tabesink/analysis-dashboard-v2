# DB14-05: Measurement/LTTB lineage and stale regeneration behavior

**Type:** AFK  
**Phase:** 2  
**Effort:** Medium

## Parent

[prd.md](../prd.md)

## What to build

Make derived-data lineage explicit and safe when active channel-map changes:

- Ensure measurement rows are linked to canonical CSV artifact + channel-map snapshot.
- Ensure LTTB rows are linked as plot-only derived data.
- Add stale marking or regeneration trigger strategy for pending/reprocessed events when active snapshot changes.

## Acceptance criteria

- [ ] Measurement rows have explicit lineage to canonical CSV and snapshot
- [ ] LTTB rows are explicitly marked/treated as derived plot data
- [ ] Active snapshot changes do not silently mix incompatible mappings
- [ ] Pending/reprocessed events are marked stale or regenerated through defined flow
- [ ] Historical event lineage stays immutable

## Blocked by

- DB14-03
- DB14-04

## Agent notes

- Keep runtime behavior backward compatible unless stale handling explicitly changes UI/API contracts.
