"""Behavior tests for async channel reprocess derived-data tasks."""

from __future__ import annotations

import time

from server.config import Settings
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from tests.server.services.test_channel_map_snapshot import (
    _equivalent_yaml_bytes,
    _fixed_ui_channel_map,
)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


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


def _channel_map_save_entries() -> list[dict[str, int | str]]:
    return [
        {"plot_key": plot_key, "x_col": 2, "y_col": 3 if index % 2 == 0 else 4}
        for index, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    ]


def _wait_for_derived_task(
    client: TestClient,
    task_id: str,
    *,
    timeout_seconds: float = 10.0,
) -> dict:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/dashboard/derived-data/task/{task_id}")
        if response.status_code == 200:
            payload = response.json()
            if payload["status"] in {"completed", "failed"}:
                return payload
        time.sleep(0.05)
    raise TimeoutError(f"Derived task {task_id} did not finish within {timeout_seconds}s")


def _count_rows(db, table: str, *, where: str = "", params: list | None = None) -> int:
    query = f"SELECT COUNT(*) FROM {table}"
    if where:
        query += f" WHERE {where}"
    row = db.read_connection.execute(query, params or []).fetchone()
    return int(row[0])


def _lttb_signature(db, event_id: str) -> list[tuple[str, float, float]]:
    rows = db.read_connection.execute(
        """
        SELECT plot_key, x, y
        FROM measurements_lttb
        WHERE event_id = ?
        ORDER BY plot_key, x, y
        """,
        [event_id],
    ).fetchall()
    return [(str(plot_key), float(x), float(y)) for plot_key, x, y in rows]


def _raw_signature(db, event_id: str) -> list[tuple[str, float, float]]:
    rows = db.read_connection.execute(
        """
        SELECT channel_name, timestamp, value
        FROM measurements_raw
        WHERE event_id = ?
        ORDER BY channel_name, timestamp, value
        """,
        [event_id],
    ).fetchall()
    return [(str(channel), float(timestamp), float(value)) for channel, timestamp, value in rows]


def _channel_map_save_entries_with_y_col(y_col: int) -> list[dict[str, int | str]]:
    return [
        {"plot_key": plot_key, "x_col": 2, "y_col": y_col}
        for plot_key in FIXED_CHANNEL_MAP_PLOTS
    ]


def test_channel_map_save_starts_channel_reprocess_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_save_starter")
    service.ingest(
        files=[("event_pending_async.csv", _csv_with_detected_damage_channels())],
        program_id="P-ASYNC-SAVE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-ASYNC", "work_order": "WO-ASYNC"},
    )

    start = service.start_channel_reprocess_from_save(
        program_id="P-ASYNC-SAVE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    assert start["task_kind"] == "channel_reprocess"
    assert start["reused_existing_task"] is False
    assert start["task_id"]

    task = test_database.get_upload_task(start["task_id"])
    assert task is not None
    assert task["task_kind"] == "channel_reprocess"
    assert task["scope_json"] == {"program_id": "P-ASYNC-SAVE", "version": "V1"}


def test_channel_map_yaml_upload_starts_channel_reprocess_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_yaml_starter")
    service.ingest(
        files=[("event_pending_yaml_async.csv", _csv_with_detected_damage_channels())],
        program_id="P-ASYNC-YAML",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-ASYNC-YAML", "work_order": "WO-ASYNC-YAML"},
    )

    start = service.start_channel_reprocess_from_yaml(
        program_id="P-ASYNC-YAML",
        version="V1",
        channel_map_content=_equivalent_yaml_bytes(_fixed_ui_channel_map()),
        user_id=uploader["id"],
    )

    assert start["task_kind"] == "channel_reprocess"
    assert start["reused_existing_task"] is False
    assert start["task_id"]


def test_active_derived_task_is_reused_for_same_program_version(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_reuse")
    service.ingest(
        files=[("event_pending_reuse.csv", _csv_with_detected_damage_channels())],
        program_id="P-REUSE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-REUSE", "work_order": "WO-REUSE"},
    )

    first = service.start_channel_reprocess_from_save(
        program_id="P-REUSE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )
    second = service.start_channel_reprocess_from_save(
        program_id="P-REUSE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    assert second["task_id"] == first["task_id"]
    assert second["reused_existing_task"] is True


def test_channel_reprocess_task_updates_progress_and_completes(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_progress")
    service.ingest(
        files=[("event_042.csv", _csv_with_detected_damage_channels())],
        program_id="P-PROGRESS",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PROGRESS", "work_order": "WO-PROGRESS"},
    )
    artifacts = test_database.list_ingestion_artifacts(program_id="P-PROGRESS", version="V1")
    channel_map = service.validate_fixed_channel_map(
        _channel_map_save_entries(),
        int(artifacts[0]["column_count"] or 0),
    )
    channel_map = service._channel_map_with_preview_headers(channel_map, artifacts[0])
    snapshot = service._persist_channel_map_only(
        program_id="P-PROGRESS",
        version="V1",
        channel_map=channel_map,
        authoring_source="ui",
        owner_user_id=uploader["id"],
    )

    messages: list[str] = []
    service._process_retained_artifacts(
        program_id="P-PROGRESS",
        version="V1",
        channel_map=channel_map,
        channel_map_snapshot=snapshot,
        user_id=uploader["id"],
        artifacts=artifacts,
        on_progress=lambda **fields: messages.append(str(fields.get("progress_message") or "")),
    )

    assert any(message.startswith("Validating artifact") for message in messages)
    assert not any(message.startswith("Extracting raw load histories:") for message in messages)
    assert any(message.startswith("Generating cross-plot data:") for message in messages)


def _csv_variant(row_offset: int) -> bytes:
    return f"""#HEADER
#TITLES
,,001_1 LF LCA OtrBJ P_UG_X Force,002_2 LF LCA OtrBJ P_UG_Y Force,003_3 LF ShockLwBsh P_UG_X Momt
#UNITS
,,N,N,Nmm
#DATATYPES
Huge,Double,Float,Float,Float
#DATA
1,0.000,{100.0 + row_offset},{200.0 + row_offset},{300.0 + row_offset}
2,0.001,{101.0 + row_offset},{201.0 + row_offset},{301.0 + row_offset}
3,0.002,{102.0 + row_offset},{202.0 + row_offset},{302.0 + row_offset}
""".encode()


def test_channel_reprocess_keeps_completed_artifacts_when_sibling_fails(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_partial")
    service.ingest(
        files=[
            ("good_event.csv", _csv_variant(0)),
            ("bad_event.csv", _csv_variant(1)),
        ],
        program_id="P-PARTIAL",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PARTIAL", "work_order": "WO-PARTIAL"},
    )
    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-PARTIAL",
        version="V1",
    )
    assert len(artifacts) == 2
    bad_artifact = next(
        artifact for artifact in artifacts if artifact["source_file"].endswith("bad_event.csv")
    )
    with test_database.write_connection() as conn:
        conn.execute(
            "DELETE FROM measurements_raw WHERE event_id = ?",
            [bad_artifact["event_id"]],
        )

    start = service.start_channel_reprocess_from_save(
        program_id="P-PARTIAL",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    deadline = time.monotonic() + 10.0
    final_task: dict | None = None
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(start["task_id"])
        if task and task["status"] in {"completed", "failed"}:
            final_task = task
            break
        time.sleep(0.05)

    assert final_task is not None
    assert final_task["status"] == "completed"
    result = final_task["result_json"]
    assert result["processed_count"] == 1
    assert result["failed_count"] == 1

    artifacts = test_database.list_ingestion_artifacts("P-PARTIAL", "V1")
    statuses = {artifact["source_file"]: artifact["status"] for artifact in artifacts}
    assert statuses["good_event.csv"] == "processed"
    assert statuses["bad_event.csv"] == "failed"


def test_channel_reprocess_preserves_raw_and_regenerates_lttb(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_preserve_raw")
    service.ingest(
        files=[("event_preserve_raw.csv", _csv_with_detected_damage_channels())],
        program_id="P-PRESERVE-RAW",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PRESERVE", "work_order": "WO-PRESERVE"},
    )
    event_id = test_database.get_events(program_id="P-PRESERVE-RAW", version="V1")[0]["event_id"]
    raw_before = _raw_signature(test_database, event_id)

    first = service.save_channel_map_and_process_artifacts(
        program_id="P-PRESERVE-RAW",
        version="V1",
        entries=_channel_map_save_entries_with_y_col(3),
        user_id=uploader["id"],
    )
    assert first["failed_count"] == 0
    first_lttb = _lttb_signature(test_database, event_id)

    second = service.save_channel_map_and_process_artifacts(
        program_id="P-PRESERVE-RAW",
        version="V1",
        entries=_channel_map_save_entries_with_y_col(4),
        user_id=uploader["id"],
    )

    assert second["failed_count"] == 0
    assert _raw_signature(test_database, event_id) == raw_before
    assert _lttb_signature(test_database, event_id) != first_lttb


def test_async_channel_reprocess_matches_sync_lttb_output(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_reprocess_lttb_parity")
    csv_bytes = _csv_with_detected_damage_channels()
    entries = _channel_map_save_entries()

    service.ingest(
        files=[("parity_sync.csv", csv_bytes)],
        program_id="P-PARITY-SYNC",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PARITY", "work_order": "WO-PARITY"},
    )
    sync_result = service.save_channel_map_and_process_artifacts(
        program_id="P-PARITY-SYNC",
        version="V1",
        entries=entries,
        user_id=uploader["id"],
    )
    sync_event_id = sync_result["processed"][0]["event_id"]
    sync_signature = _lttb_signature(test_database, sync_event_id)

    service.ingest(
        files=[("parity_async.csv", csv_bytes)],
        program_id="P-PARITY-ASYNC",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PARITY", "work_order": "WO-PARITY"},
    )
    start = service.start_channel_reprocess_from_save(
        program_id="P-PARITY-ASYNC",
        version="V1",
        entries=entries,
        user_id=uploader["id"],
    )

    deadline = time.monotonic() + 10.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(start["task_id"])
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)

    async_events = test_database.get_events(program_id="P-PARITY-ASYNC", version="V1")
    async_signature = _lttb_signature(test_database, async_events[0]["event_id"])
    assert async_signature == sync_signature
