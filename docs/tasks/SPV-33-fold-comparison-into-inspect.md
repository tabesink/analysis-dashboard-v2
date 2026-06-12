# SPV-33 Fold Comparison Into Inspect Damage

## Behavior Changed

- Removed the separate `Comparison` central tab from the Inspect Damage route.
- Made the Inspect Damage side panel use the Reference and Target load-data sections route-wide.
- Table View now reads the same Reference/Target union inspect response as the 3D plot.
- Moved comparison plot controls into the existing 3D overlay: plot type, value mode, channels, version slice, and damage scale.

## Interfaces Changed

- `InspectDamageCentralTab` is now limited to `inspect` and `table`.
- `DamagePlotView` now consumes `DamageComparisonState`, `DamageComparisonViewModel`, and `onUpdateComparison`.
- Added a pure comparison-aggregate adapter for the 3D plot cell model.

## Tests Added

- Updated the tab switcher test to assert the `Comparison` tab is gone.
- Added adapter tests for cumulative channel cells, version/channel filtering, and signed target-lower deltas.

## Follow-On Assumptions

- The route keeps one comparison selection model instead of reintroducing a single-pool Inspect Damage selector.
- Notebook rainflow, schedule QA, and bin-level diagnostic plots remain out of scope for this fold-in.
- Low-reference and signed-delta semantics remain owned by the existing SPV-33 aggregate pipeline.
