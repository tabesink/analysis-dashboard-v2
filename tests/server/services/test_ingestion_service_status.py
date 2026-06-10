import asyncio
import hashlib
import json
from pathlib import Path

from server.models.dashboard import EventsRequest
from server.routers.dashboard import get_events as dashboard_get_events
from server.services.etl import RSPConversionResult
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from server.services.query import QueryService


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _artifact_abs_path(test_settings, artifact: dict) -> Path:
    return test_settings.data_root / artifact["artifact_path"]


def _csv_with_detected_damage_channels() -> bytes:
    return b"""#HEADER
#TITLES
,,001_1 LF LCA OtrBJ P_UG_X Force,002_2 LF LCA OtrBJ P_UG_Y Force,003_3 LF ShockLwBsh P_UG_X Momt
#UNITS
,,N,N,Nmm
#DATATYPES
Huge,Double,Float,Float,Float
#DATA
1,0.000,100.0,200.0,300.0
2,0.001,101.0,201.0,301.0
3,0.002,102.0,202.0,302.0
"""


def test_ingest_forces_pending_for_non_admin(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("non_admin_uploader")

    result = service.ingest(
        files=[("event_non_admin.csv", sample_csv_content)],
        program_id="P-STATUS",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-1", "work_order": "WO-1"},
    )

    assert result.success is True
    assert len(result.event_ids) == 1
    stored_event = test_database.get_event(result.event_ids[0])
    assert stored_event is not None
    assert stored_event.get("status") == "Pending"


def test_ingest_allows_admin_to_set_status(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("admin_uploader")

    result = service.ingest(
        files=[("event_admin.csv", sample_csv_content)],
        program_id="P-STATUS",
        version="V2",
        channel_map_content=sample_channel_map_content,
        status_value="Obsolete",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-2", "work_order": "WO-2"},
    )

    assert result.success is True
    assert len(result.event_ids) == 1
    stored_event = test_database.get_event(result.event_ids[0])
    assert stored_event is not None
    assert stored_event.get("status") == "Obsolete"


def test_ingest_csv_creates_source_artifact_record(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("source_csv_ingest_owner")

    result = service.ingest(
        files=[("event_source_ledger.csv", sample_csv_content)],
        program_id="P-SOURCE-LEDGER",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SRC", "work_order": "WO-SRC"},
    )

    assert result.success is True
    records = test_database.list_source_artifacts("P-SOURCE-LEDGER", "V1")
    assert len(records) == 1
    assert records[0]["artifact_type"] == "source_csv"
    assert records[0]["sha256"] == hashlib.sha256(sample_csv_content).hexdigest()
    assert records[0]["artifact_uri"].startswith("artifact://sources/")
    resolved = service.source_artifact_storage.resolve_uri(records[0]["artifact_uri"])
    assert resolved.read_bytes() == sample_csv_content


def test_ingest_rsp_creates_source_artifact_with_original_bytes(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("source_rsp_ingest_owner")
    raw_rsp = b"raw-rsp-payload"

    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            return RSPConversionResult(
                filename="event_rsp.csv",
                content=sample_csv_content,
                row_count=10,
                channel_count=4,
            )

    service.rsp_converter = StubRSPConverter()

    result = service.ingest(
        files=[("event_rsp.rsp", raw_rsp)],
        program_id="P-SOURCE-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-RSP-SRC", "work_order": "WO-RSP-SRC"},
    )

    assert result.success is True
    records = test_database.list_source_artifacts("P-SOURCE-RSP", "V1")
    assert len(records) == 1
    assert records[0]["artifact_type"] == "source_rsp"
    assert records[0]["sha256"] == hashlib.sha256(raw_rsp).hexdigest()
    resolved = service.source_artifact_storage.resolve_uri(records[0]["artifact_uri"])
    assert resolved.read_bytes() == raw_rsp


def test_ingest_rsp_creates_canonical_csv_derived_from_converted_bytes(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("canonical_rsp_owner")
    raw_rsp = b"raw-rsp-payload"

    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            return RSPConversionResult(
                filename="event_rsp.csv",
                content=sample_csv_content,
                row_count=10,
                channel_count=4,
            )

    service.rsp_converter = StubRSPConverter()

    result = service.ingest(
        files=[("event_rsp.rsp", raw_rsp)],
        program_id="P-CANON-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-CANON", "work_order": "WO-CANON"},
    )

    assert result.success is True
    source_records = test_database.list_source_artifacts("P-CANON-RSP", "V1")
    derived_records = test_database.list_derived_artifacts("P-CANON-RSP", "V1")
    assert len(source_records) == 1
    assert len(derived_records) == 1
    assert derived_records[0]["artifact_type"] == "canonical_csv"
    assert derived_records[0]["source_artifact_id"] == source_records[0]["artifact_id"]

    canonical_path = service.derived_artifact_storage.resolve_uri(
        derived_records[0]["artifact_uri"]
    )
    assert canonical_path.read_bytes() == sample_csv_content

    runs = test_database.list_ingestion_runs("P-CANON-RSP", "V1")
    assert len(runs) == 1
    assert runs[0]["conversion_kind"] == "rsp_converter"
    assert runs[0]["source_artifact_id"] == source_records[0]["artifact_id"]
    assert runs[0]["derived_artifact_id"] == derived_records[0]["artifact_id"]


def test_ingest_csv_creates_canonical_csv_and_links_event_to_ingestion_run(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("canonical_csv_run_owner")

    result = service.ingest(
        files=[("event_canonical_run.csv", sample_csv_content)],
        program_id="P-CANON-RUN",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-RUN", "work_order": "WO-RUN"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    derived_records = test_database.list_derived_artifacts("P-CANON-RUN", "V1")
    assert len(derived_records) == 1
    canonical_path = service.derived_artifact_storage.resolve_uri(
        derived_records[0]["artifact_uri"]
    )
    assert canonical_path.read_bytes() == sample_csv_content

    run = test_database.get_ingestion_run_for_event(event_id)
    assert run is not None
    assert run["conversion_kind"] == "identity"
    assert run["parser_name"] == "CSVParser"
    assert run["status"] == "completed"
    assert run["derived_artifact_id"] == derived_records[0]["artifact_id"]

    metadata = json.loads(run["metadata_json"])
    assert metadata["derived_artifact_uri"] == derived_records[0]["artifact_uri"]
    assert metadata["app_version"]


def test_ingest_converts_rsp_before_csv_pipeline(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("rsp_uploader")
    phases: list[str] = []

    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            assert filename == "event_rsp.rsp"
            assert content == b"raw-rsp"
            return RSPConversionResult(
                filename="event_rsp.csv",
                content=sample_csv_content,
                row_count=10,
                channel_count=4,
            )

    service.rsp_converter = StubRSPConverter()

    result = service.ingest(
        files=[("event_rsp.rsp", b"raw-rsp")],
        program_id="P-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-RSP", "work_order": "WO-RSP"},
        on_phase_changed=phases.append,
    )

    assert result.success is True
    assert result.event_ids == ["event_rsp"]
    assert phases == ["converting", "validating"]

    stored_event = test_database.get_event("event_rsp")
    assert stored_event is not None
    assert stored_event.get("source_file") == "event_rsp.rsp"


def test_ingest_rejects_mixed_csv_and_rsp(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("mixed_uploader")

    result = service.ingest(
        files=[("event_csv.csv", sample_csv_content), ("event_rsp.rsp", b"raw-rsp")],
        program_id="P-MIXED",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    )

    assert result.success is False
    assert "only one data format" in (result.error or "")


def test_ingest_without_channel_map_retains_pending_artifact(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("pending_channel_map_uploader")

    result = service.ingest(
        files=[("event_pending.csv", sample_csv_content)],
        program_id="P-PENDING-MAP",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PENDING", "work_order": "WO-PENDING"},
    )

    assert result.success is True
    assert result.pending_channel_map is True
    assert result.event_ids == ["event_pending"]

    events = test_database.get_events(program_id="P-PENDING-MAP", version="V1")
    assert len(events) == 1
    assert events[0]["event_id"] == "event_pending"
    assert events[0]["source_file"] == "event_pending.csv"

    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-PENDING-MAP",
        version="V1",
    )
    assert len(artifacts) == 1
    assert artifacts[0]["status"] == "pending"
    assert artifacts[0]["source_file"] == "event_pending.csv"
    assert artifacts[0]["event_id"] == "event_pending"


def test_saving_channel_map_processes_pending_artifact(
    test_database, test_cache, test_settings
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_map_processor")
    service.ingest(
        files=[("event_pending_process.csv", _csv_with_detected_damage_channels())],
        program_id="P-PENDING-PROCESS",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PROCESS", "work_order": "WO-PROCESS"},
    )

    entries = [
        {"plot_key": plot_key, "x_col": 2, "y_col": 3 if i % 2 == 0 else 4}
        for i, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    ]
    result = service.save_channel_map_and_process_artifacts(
        program_id="P-PENDING-PROCESS",
        version="V1",
        entries=entries,
        user_id=uploader["id"],
    )

    assert result["processed_count"] == 1
    assert result["failed_count"] == 0
    events = test_database.get_events(program_id="P-PENDING-PROCESS", version="V1")
    assert len(events) == 1
    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-PENDING-PROCESS",
        version="V1",
    )
    assert artifacts[0]["status"] == "processed"
    assert artifacts[0]["event_id"] == events[0]["event_id"]

    series = QueryService(test_database, test_cache, test_settings).get_damage_channel_series(
        [events[0]["event_id"]]
    )
    assert [item["channel_key"] for item in series[:3]] == [
        "bj_x_force",
        "bj_y_force",
        "bj_z_force",
    ]
    assert series[0]["channel_name"] == "BJ X Force"
    assert series[-1]["channel_name"] == "Bushing R Z Momt"
    assert series[-1]["unit"] == "Nmm"


def test_scope_delete_removes_pending_only_artifact_file(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_pending_owner")
    service.ingest(
        files=[("event_pending_delete.csv", sample_csv_content)],
        program_id="P-SCOPE-PENDING",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    artifact = test_database.list_ingestion_artifacts("P-SCOPE-PENDING", "V1")[0]
    artifact_path = _artifact_abs_path(test_settings, artifact)
    derived = test_database.list_derived_artifacts("P-SCOPE-PENDING", "V1")[0]
    derived_path = service.derived_artifact_storage.resolve_uri(derived["artifact_uri"])
    assert artifact_path.exists()
    assert derived_path.exists()

    result = test_database.hard_delete_program_version_scope("P-SCOPE-PENDING", "V1")

    assert result["event_count"] == 1
    assert result["artifact_count"] == 1
    assert result["source_artifact_count"] == 1
    assert result["derived_artifact_count"] == 1
    assert result["ingestion_run_count"] == 1
    assert result["deleted_files"] == 3
    assert test_database.list_ingestion_artifacts("P-SCOPE-PENDING", "V1") == []
    assert test_database.list_source_artifacts("P-SCOPE-PENDING", "V1") == []
    assert test_database.list_derived_artifacts("P-SCOPE-PENDING", "V1") == []
    assert test_database.list_ingestion_runs("P-SCOPE-PENDING", "V1") == []
    assert test_database.get_events(program_id="P-SCOPE-PENDING", version="V1") == []
    assert not artifact_path.exists()
    assert not derived_path.exists()


def test_scope_delete_removes_processed_events_measurements_channel_map_and_artifact(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_processed_owner")
    result = service.ingest(
        files=[("event_processed_delete.csv", sample_csv_content)],
        program_id="P-SCOPE-PROCESSED",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    event_id = result.event_ids[0]
    artifact = test_database.list_ingestion_artifacts("P-SCOPE-PROCESSED", "V1")[0]
    artifact_path = _artifact_abs_path(test_settings, artifact)
    assert artifact_path.exists()
    assert test_database.get_event(event_id) is not None

    delete_result = test_database.hard_delete_program_version_scope("P-SCOPE-PROCESSED", "V1")

    assert delete_result["event_count"] == 1
    assert delete_result["raw_rows"] > 0
    assert delete_result["lttb_rows"] > 0
    assert delete_result["channel_map_rows"] > 0
    assert test_database.get_event(event_id) is None
    assert test_database.list_ingestion_artifacts("P-SCOPE-PROCESSED", "V1") == []
    assert not artifact_path.exists()
    assert (
        test_database.read_connection.execute(
            "SELECT COUNT(*) FROM dim_channel_map WHERE program_id = ? AND version = ?",
            ["P-SCOPE-PROCESSED", "V1"],
        ).fetchone()[0]
        == 0
    )


def test_program_scope_delete_removes_all_versions(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_program_owner")
    for version in ("V1", "V2"):
        service.ingest(
            files=[(f"event_{version}.csv", sample_csv_content)],
            program_id="P-SCOPE-PROGRAM",
            version=version,
            channel_map_content=None,
            status_value="Pending",
            is_admin=False,
            uploaded_by_user_id=uploader["id"],
            metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
        )

    result = test_database.hard_delete_program_version_scope("P-SCOPE-PROGRAM")

    assert result["artifact_count"] == 2
    assert test_database.list_ingestion_artifacts("P-SCOPE-PROGRAM") == []
    assert test_database.get_versions("P-SCOPE-PROGRAM") == []


def test_writer_delete_scope_requires_owning_everything(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("scope_delete_owner")
    other_owner = test_database.create_user("scope_delete_other_owner")
    service.ingest(
        files=[("owner.csv", sample_csv_content)],
        program_id="P-SCOPE-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    service.ingest(
        files=[("other_owner.csv", sample_csv_content + b"\n")],
        program_id="P-SCOPE-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=other_owner["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )

    assert (
        test_database.user_can_delete_program_version_scope(
            "P-SCOPE-MIXED",
            "V1",
            owner["id"],
            is_admin=False,
        )
        is False
    )
    assert (
        test_database.user_can_delete_program_version_scope(
            "P-SCOPE-MIXED",
            "V1",
            owner["id"],
            is_admin=True,
        )
        is True
    )


def test_get_all_events_marks_channel_map_missing_events_non_selectable(
    test_database, test_cache, test_settings
) -> None:
    query_service = QueryService(test_database, test_cache, test_settings)
    owner = test_database.create_user("channel_map_selectability_owner")
    test_database.insert_event(
        event_id="event-no-channel-map",
        program_id="P-SELECT",
        version="V-NO-MAP",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.insert_event(
        event_id="event-with-channel-map",
        program_id="P-SELECT",
        version="V-WITH-MAP",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.upsert_channel_map(
        "P-SELECT",
        "V-WITH-MAP",
        "plot_a",
        "time",
        "value",
        x_col=0,
        y_col=1,
    )

    payload = query_service.get_all_events(global_filters={}, limit=100, offset=0)
    by_id = {event["event_id"]: event for event in payload["events"]}

    assert by_id["event-no-channel-map"]["has_channel_map"] is False
    assert by_id["event-no-channel-map"]["selectable_for_plotting"] is False
    assert by_id["event-with-channel-map"]["has_channel_map"] is True
    assert by_id["event-with-channel-map"]["selectable_for_plotting"] is True


def test_get_all_events_scoped_query_excludes_pending_placeholder_rows(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scoped_events_uploader")
    service.ingest(
        files=[("event_pending_scope.csv", sample_csv_content)],
        program_id="P-SCOPED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SCOPE", "work_order": "WO-SCOPE"},
    )
    query_service = QueryService(test_database, test_cache, test_settings)

    unscoped = query_service.get_all_events(global_filters={}, limit=100, offset=0)
    scoped = query_service.get_all_events(
        program_ids=["P-SCOPED"],
        versions=["V1"],
        global_filters={},
        limit=100,
        offset=0,
    )

    assert any(
        event["event_id"] == "event_pending_scope"
        for event in unscoped["events"]
    )
    assert not any(
        event["event_id"] == "__pending_channel_map__::P-SCOPED::V1"
        for event in unscoped["events"]
    )
    assert len(scoped["events"]) == 1
    assert scoped["events"][0]["event_id"] == "event_pending_scope"
    assert scoped["total_count"] == 1


def test_dashboard_events_mapper_preserves_selectability_flags() -> None:
    class QueryServiceStub:
        def get_all_events(
            self,
            program_ids: list[str] | None = None,
            versions: list[str] | None = None,
            global_filters: dict[str, list[str] | str] | None = None,
            limit: int = 100,
            offset: int = 0,
        ) -> dict[str, object]:
            del program_ids, versions, global_filters, limit, offset
            return {
                "events": [
                    {
                        "event_id": "__pending_channel_map__::0000::00",
                        "program_id": "0000",
                        "version": "00",
                        "status": "Pending",
                        "has_channel_map": False,
                        "missing_channel_map": True,
                        "selectable_for_plotting": False,
                    }
                ],
                "total_count": 1,
                "has_more": False,
            }

    response = asyncio.run(
        dashboard_get_events(
            request=EventsRequest(global_filters={}),
            query_service=QueryServiceStub(),  # type: ignore[arg-type]
            limit=100,
            offset=0,
        )
    )
    assert len(response.events) == 1
    assert response.events[0].has_channel_map is False
    assert response.events[0].missing_channel_map is True
    assert response.events[0].selectable_for_plotting is False
