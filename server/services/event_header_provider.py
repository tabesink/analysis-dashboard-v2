"""Load per-event channel header metadata for derived-data readers."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from typing import Any, Literal

from server.services.event_preview import EventPreviewService
from server.storage.database import UnifiedStore

HeaderSource = Literal["event_preview", "ingestion_artifact"]


@dataclass(frozen=True)
class EventHeaderMetadata:
    """Header and unit lists resolved for one event."""

    headers: list[str]
    units: list[str] | None = None
    source: HeaderSource | None = None


class EventHeaderProvider:
    """Resolve event headers from preview storage with artifact fallback."""

    def __init__(
        self,
        db: UnifiedStore,
        preview_service: EventPreviewService | None = None,
    ) -> None:
        self.db = db
        self.preview_service = preview_service or EventPreviewService(db=db)

    def load_for_event(self, event_id: str) -> EventHeaderMetadata | None:
        """Load headers for an event, preferring stored event preview metadata."""
        preview = self.preview_service.get_for_event(event_id)
        if preview and preview.get("headers"):
            return EventHeaderMetadata(
                headers=[str(header) for header in preview["headers"]],
                units=_normalize_units(preview.get("units")),
                source="event_preview",
            )

        artifact = self.db.get_ingestion_artifact_for_event(event_id)
        if artifact is None:
            return None

        headers = metadata_row_from_preview_json(artifact.get("preview_json"), "#TITLES")
        if not headers:
            return None

        return EventHeaderMetadata(
            headers=headers,
            units=metadata_row_from_preview_json(artifact.get("preview_json"), "#UNITS") or None,
            source="ingestion_artifact",
        )


def metadata_row_from_preview_json(preview_json: Any, marker: str) -> list[str]:
    """Extract one metadata row from retained ingestion artifact preview JSON."""
    try:
        preview = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(preview, dict):
        return []
    lines = preview.get("lines", [])
    return metadata_row_from_preview_lines(lines, marker)


def metadata_row_from_preview_lines(lines: Any, marker: str) -> list[str]:
    """Extract one metadata row from canonical CSV preview lines."""
    if not isinstance(lines, list):
        return []
    for index, line in enumerate(lines[:-1]):
        if str(line).strip() == marker:
            return next(csv.reader([str(lines[index + 1])]))
    return []


def _normalize_units(units: Any) -> list[str] | None:
    if not isinstance(units, list):
        return None
    return [str(unit) for unit in units]
