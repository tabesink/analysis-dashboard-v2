"""Behavior tests for per-event header resolution during channel reprocess (IDM-28-04)."""

from __future__ import annotations

from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from tests.server.services.test_damage_query_service import (
    _channel_map_yaml,
    _csv_with_24_abbrev_damage_channels,
    _csv_with_24_damage_channels,
)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _channel_map_save_entries() -> list[dict[str, int | str]]:
    import yaml

    payload = yaml.safe_load(_channel_map_yaml())
    return [
        {"plot_key": plot_key, "x_col": mapping["x_col"], "y_col": mapping["y_col"]}
        for plot_key in FIXED_CHANNEL_MAP_PLOTS
        for mapping in [payload[plot_key]]
    ]


def _count_lttb_rows(db, event_id: str) -> int:
    row = db.read_connection.execute(
        "SELECT COUNT(*) FROM measurements_lttb WHERE event_id = ?",
        [event_id],
    ).fetchone()
    return int(row[0])


def _lttb_plot_keys(db, event_id: str) -> set[str]:
    rows = db.read_connection.execute(
        "SELECT DISTINCT plot_key FROM measurements_lttb WHERE event_id = ? ORDER BY plot_key",
        [event_id],
    ).fetchall()
    return {str(plot_key) for plot_key, in rows}


def test_channel_reprocess_regenerates_lttb_for_mixed_naming_conventions(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("reprocess_mixed_headers")

    service.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id="P-REPROCESS-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    )
    service.ingest(
        files=[("abbrev_event.csv", _csv_with_24_abbrev_damage_channels())],
        program_id="P-REPROCESS-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    )

    result = service.save_channel_map_and_process_artifacts(
        program_id="P-REPROCESS-MIXED",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    assert result["failed_count"] == 0
    assert result["processed_count"] == 2

    for event_id in ("moog_event", "abbrev_event"):
        assert _lttb_plot_keys(test_database, event_id) == set(FIXED_CHANNEL_MAP_PLOTS)
        assert _count_lttb_rows(test_database, event_id) > 0


def test_channel_reprocess_does_not_use_first_artifact_titles_for_lookup(
    test_database,
    test_cache,
    test_settings,
) -> None:
    """Abbrev event must resolve its own headers even when Moog was ingested first."""
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("reprocess_first_artifact")

    service.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id="P-REPROCESS-ORDER",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-ORDER", "work_order": "WO-ORDER"},
    )
    service.ingest(
        files=[("abbrev_event.csv", _csv_with_24_abbrev_damage_channels())],
        program_id="P-REPROCESS-ORDER",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-ORDER", "work_order": "WO-ORDER"},
    )

    result = service.save_channel_map_and_process_artifacts(
        program_id="P-REPROCESS-ORDER",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    assert result["failed_count"] == 0
    abbrev_lttb = _count_lttb_rows(test_database, "abbrev_event")
    assert abbrev_lttb > 0
    assert _lttb_plot_keys(test_database, "abbrev_event") == set(FIXED_CHANNEL_MAP_PLOTS)


def test_channel_reprocess_marks_artifact_failed_when_plot_extraction_is_empty(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("reprocess_empty_plots")

    service.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id="P-REPROCESS-EMPTY",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-EMPTY", "work_order": "WO-EMPTY"},
    )

    with test_database.write_connection() as conn:
        conn.execute("DELETE FROM event_previews WHERE event_id = ?", ["moog_event"])
        conn.execute(
            """
            UPDATE ingestion_artifacts
            SET preview_json = ?
            WHERE event_id = ?
            """,
            ['{"lines": ["#HEADER", "#DATA", "1,0.0"]}', "moog_event"],
        )

    result = service.save_channel_map_and_process_artifacts(
        program_id="P-REPROCESS-EMPTY",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    assert result["failed_count"] == 1
    assert result["processed_count"] == 0
    assert _count_lttb_rows(test_database, "moog_event") == 0

    artifacts = test_database.list_ingestion_artifacts("P-REPROCESS-EMPTY", "V1")
    assert artifacts[0]["status"] == "failed"
    assert "plot" in str(artifacts[0]["error"]).lower()
