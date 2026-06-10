"""Event preview metadata derived from canonical CSV."""

from __future__ import annotations

import csv
import json
from typing import Any

from server.services.etl import CSVParser
from server.storage.database import UnifiedStore

MAX_SAMPLE_ROWS = 20


class EventPreviewService:
    """Derive and persist lightweight preview metadata from canonical CSV bytes."""

    def __init__(
        self,
        parser: CSVParser | None = None,
        db: UnifiedStore | None = None,
    ) -> None:
        self.parser = parser or CSVParser()
        self.db = db

    def derive_from_canonical_csv(
        self,
        *,
        canonical_csv: bytes,
        source_filename: str,
        conversion_kind: str,
        warnings: list[dict[str, Any]] | None = None,
        source_artifact_uri: str | None = None,
        canonical_artifact_uri: str | None = None,
    ) -> dict[str, Any]:
        """Build lightweight preview metadata without storing the full canonical CSV."""
        parsed = self.parser.parse(canonical_csv, source_filename)
        if not parsed.is_valid:
            raise ValueError(parsed.error or f"Failed to parse canonical CSV for {source_filename}")

        column_count = len(parsed.dataframe.columns)
        headers = list(parsed.headers)[:column_count]
        units = list(parsed.units)
        if len(units) < column_count:
            units.extend([""] * (column_count - len(units)))
        else:
            units = units[:column_count]

        return {
            "headers": headers,
            "units": units,
            "first_rows": self._sample_data_rows(canonical_csv),
            "row_count": int(parsed.row_count),
            "column_count": column_count,
            "warnings": list(warnings or []),
            "source_artifact_uri": source_artifact_uri,
            "canonical_artifact_uri": canonical_artifact_uri,
            "source_filename": source_filename,
            "conversion_kind": conversion_kind,
        }

    def store_for_event(
        self,
        *,
        event_id: str,
        preview: dict[str, Any],
        conn: Any | None = None,
    ) -> None:
        """Persist preview metadata for an ingested event."""
        if self.db is None:
            raise RuntimeError("EventPreviewService requires a database to store previews")
        self.db.upsert_event_preview(
            event_id=event_id,
            preview_json=json.dumps(preview, sort_keys=True),
            conn=conn,
        )

    def get_for_event(self, event_id: str) -> dict[str, Any] | None:
        """Return stored preview metadata for an event."""
        if self.db is None:
            raise RuntimeError("EventPreviewService requires a database to read previews")
        row = self.db.get_event_preview(event_id)
        if row is None:
            return None
        raw_preview = row.get("preview_json")
        if not raw_preview:
            return None
        return json.loads(raw_preview) if isinstance(raw_preview, str) else raw_preview

    def _sample_data_rows(self, canonical_csv: bytes) -> list[list[str]]:
        text = canonical_csv.decode("utf-8", errors="replace")
        lines = text.splitlines()
        data_start = 0
        for index, line in enumerate(lines):
            if line.strip() == "#DATA":
                data_start = index + 1
                break
        if data_start == 0:
            for index, line in enumerate(lines):
                stripped = line.strip()
                if stripped and not stripped.startswith("#"):
                    data_start = index
                    break

        sample: list[list[str]] = []
        for line in lines[data_start : data_start + MAX_SAMPLE_ROWS]:
            stripped = line.strip()
            if not stripped:
                continue
            sample.append(next(csv.reader([stripped])))
        return sample
