"""Behavior tests for event preview metadata derived from canonical CSV."""

import asyncio
import json

from server.models.dashboard import EventsRequest
from server.routers.dashboard import get_events as dashboard_get_events
from server.services.etl import RSPConversionResult
from server.services.event_preview import EventPreviewService, MAX_SAMPLE_ROWS
from server.services.ingestion import IngestionService
from server.services.query import QueryService


def _make_preview_service() -> EventPreviewService:
    return EventPreviewService()


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def test_derive_preview_extracts_headers_units_sample_and_counts(sample_csv_content) -> None:
    service = _make_preview_service()

    preview = service.derive_from_canonical_csv(
        canonical_csv=sample_csv_content,
        source_filename="event.csv",
        conversion_kind="identity",
        warnings=[{"severity": "warning", "code": "TEST_WARN", "message": "sample warning"}],
        source_artifact_uri="artifact://sources/src_abc/original.csv",
        canonical_artifact_uri="artifact://canonical/can_def/canonical.csv",
    )

    assert preview["headers"] == ["", "", "Time", "Force_X", "Force_Y"]
    assert preview["units"] == ["", "", "s", "N", "N"]
    assert preview["row_count"] == 10
    assert preview["column_count"] == 5
    assert len(preview["first_rows"]) == 10
    assert preview["first_rows"][0] == ["1", "0.000", "100.0", "200.0", "300.0"]
    assert preview["warnings"] == [
        {"severity": "warning", "code": "TEST_WARN", "message": "sample warning"}
    ]
    assert preview["source_artifact_uri"] == "artifact://sources/src_abc/original.csv"
    assert preview["canonical_artifact_uri"] == "artifact://canonical/can_def/canonical.csv"
    assert preview["source_filename"] == "event.csv"
    assert preview["conversion_kind"] == "identity"


def test_store_and_retrieve_event_preview(
    test_database, test_settings, sample_csv_content
) -> None:
    service = EventPreviewService(db=test_database)
    preview = service.derive_from_canonical_csv(
        canonical_csv=sample_csv_content,
        source_filename="stored_event.csv",
        conversion_kind="identity",
    )

    service.store_for_event(event_id="event_preview_store", preview=preview)
    stored = service.get_for_event("event_preview_store")

    assert stored is not None
    assert stored["headers"] == preview["headers"]
    assert stored["row_count"] == preview["row_count"]
    assert stored["first_rows"] == preview["first_rows"]


def test_ingest_csv_stores_event_preview_from_canonical_csv(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    preview_service = EventPreviewService(db=test_database)
    uploader = test_database.create_user("event_preview_csv_owner")

    result = service.ingest(
        files=[("event_preview.csv", sample_csv_content)],
        program_id="P-PREVIEW",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PREV", "work_order": "WO-PREV"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    preview = preview_service.get_for_event(event_id)
    assert preview is not None
    assert preview["source_filename"] == "event_preview.csv"
    assert preview["conversion_kind"] == "identity"
    assert preview["row_count"] == 10
    assert preview["canonical_artifact_uri"].startswith("artifact://canonical/")
    assert preview["source_artifact_uri"].startswith("artifact://sources/")


def test_ingest_rsp_stores_event_preview_from_derived_canonical_csv(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    preview_service = EventPreviewService(db=test_database)
    uploader = test_database.create_user("event_preview_rsp_owner")

    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            return RSPConversionResult(
                filename="event_preview_rsp.csv",
                content=sample_csv_content,
                row_count=10,
                channel_count=5,
            )

    service.rsp_converter = StubRSPConverter()

    result = service.ingest(
        files=[("event_preview_rsp.rsp", b"raw-rsp")],
        program_id="P-PREVIEW-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PREV-RSP", "work_order": "WO-PREV-RSP"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    preview = preview_service.get_for_event(event_id)
    assert preview is not None
    assert preview["source_filename"] == "event_preview_rsp.rsp"
    assert preview["conversion_kind"] == "rsp_converter"
    assert preview["headers"] == ["", "", "Time", "Force_X", "Force_Y"]


def _large_canonical_csv(row_count: int = 250) -> bytes:
    lines = [
        "#HEADER",
        "#TITLES",
        ",,Time,Force_X,Force_Y",
        "#UNITS",
        ",,s,N,N",
        "#DATATYPES",
        "Huge,Double,Float,Float,Float",
        "#DATA",
    ]
    lines.extend(f"{index},0.{index:03d},{index}.0,{index + 1}.0,{index + 2}.0" for index in range(1, row_count + 1))
    return ("\n".join(lines) + "\n").encode("utf-8")


def test_event_preview_stays_lightweight(
    test_database, test_cache, test_settings, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    preview_service = EventPreviewService(db=test_database)
    uploader = test_database.create_user("event_preview_light_owner")
    large_csv = _large_canonical_csv()

    result = service.ingest(
        files=[("event_light.csv", large_csv)],
        program_id="P-PREVIEW-LIGHT",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-LIGHT", "work_order": "WO-LIGHT"},
    )

    assert result.success is True
    event_id = result.event_ids[0]
    preview = preview_service.get_for_event(event_id)
    assert preview is not None
    assert preview["row_count"] == 250
    assert len(preview["first_rows"]) == MAX_SAMPLE_ROWS
    assert len(json.dumps(preview)) < len(large_csv) / 2


def test_existing_event_retrieval_remains_functional(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("event_preview_retrieval_owner")

    result = service.ingest(
        files=[("event_retrieval.csv", sample_csv_content)],
        program_id="P-PREVIEW-RETRIEVAL",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-RET", "work_order": "WO-RET"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    query_service = QueryService(test_database, test_cache, test_settings)
    response = asyncio.run(
        dashboard_get_events(
            request=EventsRequest(
                program_ids=["P-PREVIEW-RETRIEVAL"],
                versions=["V1"],
                global_filters={},
            ),
            query_service=query_service,
            limit=100,
            offset=0,
        )
    )

    assert response.total_count == 1
    assert response.events[0].event_id == event_id
    assert response.events[0].source_file == "event_retrieval.csv"
