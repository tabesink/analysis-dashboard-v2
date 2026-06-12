# Acceptance Criteria

## Functional acceptance

- [ ] Uploading/saving a valid durability schedule automatically starts the damage calculation pipeline.
- [ ] Uploading/saving an invalid durability schedule returns a clear validation/prerequisite report and does not start calculation.
- [ ] A new accepted schedule replaces or invalidates previous damage values for the same scope.
- [ ] Damage calculation persists per-event, per-channel results.
- [ ] Damage calculation persists explicit error/unavailable states where channel data cannot be calculated.
- [ ] Inspect Damage reads persisted values only.
- [ ] Inspect Damage does not call a backfill endpoint.
- [ ] Inspect Damage does not start a damage calculation on page load.
- [ ] Inspect Damage can render selected event rows before damage values are available.
- [ ] Inspect Damage displays running/failed calculation status using explicit banners or status UI.

## Architecture acceptance

- [ ] Damage lifecycle policy is owned by a backend service boundary, not by the Inspect Damage page.
- [ ] The frontend Inspect Damage route no longer owns auto-backfill planning.
- [ ] Backfill terminology is removed from the normal user flow.
- [ ] Stale/repair/rescale logic is removed, disabled, or isolated from the normal simplified path.
- [ ] Commands and queries are separated: schedule upload/calculation mutates; inspect reads.
- [ ] Tests assert behavior through public boundaries.

## UX acceptance

- [ ] The user understands that calculation starts after schedule upload/save.
- [ ] The user is not asked to visit Inspect Damage to trigger calculation.
- [ ] Loading copy is changed from ambiguous “Loading damage” to precise states such as “Loading saved damage results,” “Calculation running,” or “Calculation failed.”
- [ ] Failed prerequisites are visible and actionable.

## Non-goals confirmed

- [ ] No migration path is implemented for preserving old partially calculated damage data.
- [ ] No schedule-rescale optimization is required for this iteration.
- [ ] No distributed queue is introduced unless required by current deployment constraints.
