"""Behavior tests for loading per-event header metadata."""

import json

from server.services.event_header_provider import EventHeaderProvider
from server.services.event_preview import EventPreviewService


def _abbreviated_artifact_preview_lines() -> list[str]:
    return [
        "#HEADER",
        "#TITLES",
        "Index,Time,1 1 LR LBJ - Fx,2 2 LR LBJ - Fy,3 3 LR LBJ - Fz",
        "#UNITS",
        ",s,N,N,N",
        "#DATA",
        "1,0.0,100.0,200.0,300.0",
    ]


def test_event_header_provider_reads_stored_event_preview(
    test_database,
    test_settings,
    sample_csv_content,
) -> None:
    preview_service = EventPreviewService(db=test_database)
    preview = preview_service.derive_from_canonical_csv(
        canonical_csv=sample_csv_content,
        source_filename="preview_headers.csv",
        conversion_kind="identity",
    )
    preview_service.store_for_event(event_id="event_with_preview", preview=preview)

    provider = EventHeaderProvider(db=test_database)
    metadata = provider.load_for_event("event_with_preview")

    assert metadata is not None
    assert metadata.source == "event_preview"
    assert metadata.headers == ["", "", "Time", "Force_X", "Force_Y"]
    assert metadata.units == ["", "", "s", "N", "N"]


def test_event_header_provider_falls_back_to_ingestion_artifact_preview(
    test_database,
) -> None:
    test_database.insert_event(
        event_id="event_artifact_fallback",
        program_id="P-HEADERS",
        version="V1",
        source_file="abbrev_event.csv",
    )
    test_database.upsert_ingestion_artifact(
        program_id="P-HEADERS",
        version="V1",
        source_file="abbrev_event.csv",
        artifact_path="artifacts/channel-map/abbrev_event.csv",
        artifact_kind="csv",
        file_hash="hash-artifact-fallback",
        row_count=1,
        column_count=5,
        preview_json=json.dumps({"lines": _abbreviated_artifact_preview_lines()}),
        metadata_json="{}",
        custom_fields_json="{}",
        status="processed",
        owner_user_id=None,
        event_id="event_artifact_fallback",
    )

    provider = EventHeaderProvider(db=test_database)
    metadata = provider.load_for_event("event_artifact_fallback")

    assert metadata is not None
    assert metadata.source == "ingestion_artifact"
    assert metadata.headers == [
        "Index",
        "Time",
        "1 1 LR LBJ - Fx",
        "2 2 LR LBJ - Fy",
        "3 3 LR LBJ - Fz",
    ]
    assert metadata.units == ["", "s", "N", "N", "N"]


def test_event_header_provider_prefers_event_preview_over_artifact(
    test_database,
    sample_csv_content,
) -> None:
    preview_service = EventPreviewService(db=test_database)
    preview = preview_service.derive_from_canonical_csv(
        canonical_csv=sample_csv_content,
        source_filename="preferred_preview.csv",
        conversion_kind="identity",
    )
    preview_service.store_for_event(event_id="event_preview_priority", preview=preview)
    test_database.insert_event(
        event_id="event_preview_priority",
        program_id="P-HEADERS",
        version="V1",
        source_file="preferred_preview.csv",
    )
    test_database.upsert_ingestion_artifact(
        program_id="P-HEADERS",
        version="V1",
        source_file="preferred_preview.csv",
        artifact_path="artifacts/channel-map/preferred_preview.csv",
        artifact_kind="csv",
        file_hash="hash-preview-priority",
        row_count=1,
        column_count=5,
        preview_json=json.dumps({"lines": _abbreviated_artifact_preview_lines()}),
        metadata_json="{}",
        custom_fields_json="{}",
        status="processed",
        owner_user_id=None,
        event_id="event_preview_priority",
    )

    provider = EventHeaderProvider(db=test_database)
    metadata = provider.load_for_event("event_preview_priority")

    assert metadata is not None
    assert metadata.source == "event_preview"
    assert metadata.headers == ["", "", "Time", "Force_X", "Force_Y"]
