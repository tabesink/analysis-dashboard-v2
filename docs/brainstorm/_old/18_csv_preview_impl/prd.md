# PRD — CSV Preview Readonly Table (Channel Map Editor)

## Problem Statement

On the Database Edit page, the channel-map editor shows retained CSV artifacts as a raw monospace `<pre>` dump of the first 20 file lines. Engineers configuring plot column mappings must mentally parse tagged RSP-style CSV sections (`#TITLES`, `#DATA`, etc.) to understand which column index maps to which channel. That preview is hard to scan, does not align with the Workbench table patterns used elsewhere in the product, and hides the actual tabular relationship between column titles and sample data rows.

## Solution

Replace the raw text preview with a **readonly flex table** styled per the `18_table_ui` Workbench visual spec. Column headers come from the CSV line immediately after `#TITLES`; body rows come from lines after `#DATA`. The surrounding card shell, footer metadata (column count, pending/failed artifact counts), and the adjacent plot column-mapping panel remain unchanged.

## User Stories

1. As a data engineer editing a program version channel map, I want CSV preview data shown as a table with `#TITLES` headers, so that I can visually match column indexes to channel names when filling in `x_col` / `y_col`.
2. As a data engineer, I want preview rows limited to the same first-20-line artifact snapshot already stored server-side, so that preview load stays fast and consistent with ingestion retention.
3. As a data engineer, I want empty title cells to remain blank in the header while still showing their data values in rows, so that index columns (row number, time) are visible without inventing labels.
4. As a data engineer, I want long channel names truncated with a hover tooltip, so that dense RSP title strings remain readable without breaking layout.
5. As a data engineer, I want horizontal scroll when many columns exceed the panel width, so that wide measurement files remain navigable.
6. As a data engineer, I want a sticky opaque header while scrolling preview rows, so that column identity stays visible.
7. As a data engineer, I want column resize handles on preview headers, so that I can widen narrow columns to read full channel names.
8. As a data engineer, I want the preview table to be readonly, so that I cannot accidentally mutate artifact content from the metadata editor.
9. As a data engineer, I want a clear empty state when no retained CSV artifact exists, so that I know upload/retention is required before mapping plots.
10. As a data engineer, I want a distinct empty state when titles exist but no `#DATA` rows are present, so that I can distinguish parsing gaps from missing uploads.
11. As a data engineer, I want scientific-notation and comma-containing numeric values rendered correctly, so that preview matches parsed ingestion values.
12. As a data engineer, I want the preview panel footer to continue showing detected column count and artifact processing status, so that operational context is unchanged.
13. As a QA reviewer, I want preview parsing covered by unit tests using tagged CSV fixtures, so that regressions in `#TITLES` / `#DATA` extraction are caught in CI.
14. As a maintainer, I want preview parsing isolated from presentation, so that CSV marker logic can be tested without rendering React components.
15. As a maintainer, I want the table component to reuse existing `ColumnResizeHandle` and Workbench flex-row tokens, so that visual parity with Database and Inspect Damage tables is preserved without a new design dialect.
16. As a data engineer on a smaller screen, I want the preview table to scroll inside the existing two-column channel-map layout, so that the mapping form and preview remain usable on xl breakpoints.
17. As a data engineer reviewing an RSP-converted artifact, I want the preview to ignore `#HEADER`, `#UNITS`, and `#DATATYPES` marker lines in the body, so that only actual data rows appear beneath headers.
18. As a data engineer, I want row values aligned under the correct title column even when row width differs from header width, so that short or padded CSV rows do not shift columns visually.
19. As an admin, I want no new API fields required for this UI change, so that backend deployment is not blocked by preview rendering work.
20. As a maintainer, I want no Handsontable dependency for preview, so that the lightweight readonly surface stays separate from spreadsheet edit flows documented in `18_table_ui`.

## Implementation Decisions

- **Presentation paradigm:** Use Paradigm A (flex Workbench table) from `18_table_ui`, not Handsontable. No row selection, sorting, filtering, or pagination in v1.
- **Data source:** Continue consuming `ChannelMapEditorResponse.preview_lines` from `GET /channel-map/{program_id}/{version}`. No backend schema or API shape changes in v1.
- **Parsing module:** Introduce a client-side `parseCsvPreviewLines(lines)` deep module that:
  - Locates the line after `#TITLES` and parses it as a CSV row for headers.
  - Locates rows after `#DATA` (fallback: first non-marker line) and parses each as a CSV row.
  - Skips blank lines and lines starting with `#`.
  - Pads or truncates row cells to header length for stable column alignment.
  - Returns `null` when `#TITLES` is missing; returns headers with empty rows when `#DATA` is absent.
- **CSV row parsing:** Implement a minimal quote-aware comma splitter on the client (no new dependency). Matches server `_metadata_row_from_preview` / `EventPreviewService._sample_data_rows` behavior for standard RSP tagged files.
- **Table component:** Introduce `CsvPreviewTable` that accepts `previewLines: string[]` and renders:
  - Sticky `bg-card` header row with `text-xs font-semibold text-foreground/70`.
  - Flex rows with `hover:bg-muted/30`, `truncate`, and `title` tooltips.
  - `flexFor(basis)` column sizing, `widthForValues` heuristic, and `ColumnResizeHandle` per header.
  - `minWidth: totalRowWidth` scroll container inside the existing card body.
  - Empty states using the Workbench icon + copy pattern from `VISUAL_SPEC.md`.
- **Header labeling:** Display exact `#TITLES` cell values, including blank cells for index/time columns.
- **Integration point:** Replace the `<pre>` block in the Database Edit page channel-map tab with `CsvPreviewTable`, preserving the existing card header and footer status line.
- **Exports:** Re-export `CsvPreviewTable` from the upload components barrel for reuse in future upload/review surfaces.
- **Out of scope for v1 backend work:** Structured preview payload (`headers`, `first_rows`) on the API — can be a follow-up to avoid duplicating parse logic across tiers.

## Testing Decisions

- **What makes a good test:** Assert externally observable parse output (headers array, rows array) from representative tagged preview line fixtures. Do not test React flex layout or resize handle drag mechanics in unit tests.
- **Modules to test:**
  - `parseCsvPreviewLines` — primary unit-test target.
  - Optional smoke/integration test later if preview rendering is wired through a page-level harness; not required for v1.
- **Prior art:**
  - `client/src/lib/inspect-damage-format.test.ts` for small pure-function Vitest style.
  - `tests/server/services/test_event_preview.py` and `tests/conftest.py` RSP CSV fixtures for tagged marker semantics (mirror a reduced fixture on the client).
- **Manual QA:**
  - Open Database Edit → Custom Fields tab with a retained CSV artifact.
  - Confirm headers match `#TITLES` and rows match `#DATA`.
  - Confirm horizontal scroll and sticky header with 20+ columns.
  - Confirm empty states before upload and after clearing artifacts.

## Out of Scope

- Editing preview cells or saving changes back to artifacts.
- Sorting, filtering, column visibility toggles, or batch selection in the preview table.
- Virtualized scrolling for very large previews.
- Parsing full canonical CSV files client-side beyond the stored 20-line preview snapshot.
- Handsontable or native `<table>` rendering.
- Backend changes to `preview_json` structure or channel-map API response fields.
- Showing `#UNITS` or `#DATATYPES` as additional header rows in v1 (titles + data only).
- Persisting user column-width preferences for the preview table across sessions.

## Further Notes

- Visual reference: `docs/brainstorm/18_table_ui/VISUAL_SPEC.md` and `CertificateFlatTable` flex-row patterns under `docs/brainstorm/18_table_ui/reference/`.
- Domain markers align with `CSVParser` in `server/services/etl/csv_parser.py` and ingestion preview retention (`preview_json.lines` = first 20 text lines).
- Issue tracker publish: GitHub CLI (`gh`) is unavailable in the current environment; this PRD is filed locally at `docs/brainstorm/18_csv_preview_impl/prd.md`. When `gh` is available, open an issue on `tabesink/Dashboard` with this body and label `ready-for-agent`.
