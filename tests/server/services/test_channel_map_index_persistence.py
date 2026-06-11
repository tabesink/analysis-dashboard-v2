"""Behavior tests for index-based channel-map persistence (IDM-28-02)."""

from __future__ import annotations

import json

import pytest

from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from tests.server.services.test_channel_map_snapshot import (
    _equivalent_yaml_bytes,
    _fixed_ui_channel_map,
)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _csv_with_moog_titles() -> bytes:
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


def _read_dim_channel_map(test_database, program_id: str, version: str) -> list[dict]:
    rows = test_database.read_connection.execute(
        """
        SELECT plot_key, x_col, y_col, x_channel, y_channel, plot_order
        FROM dim_channel_map
        WHERE program_id = ? AND version = ?
        ORDER BY plot_order
        """,
        [program_id, version],
    ).fetchall()
    return [
        {
            "plot_key": plot_key,
            "x_col": x_col,
            "y_col": y_col,
            "x_channel": x_channel,
            "y_channel": y_channel,
            "plot_order": plot_order,
        }
        for plot_key, x_col, y_col, x_channel, y_channel, plot_order in rows
    ]


def test_ui_save_persists_index_based_lookup_names(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("index_map_ui_save")
    service.ingest(
        files=[("event_moog_preview.csv", _csv_with_moog_titles())],
        program_id="P-INDEX-SAVE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-INDEX", "work_order": "WO-INDEX"},
    )

    service.start_channel_reprocess_from_save(
        program_id="P-INDEX-SAVE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    rows = _read_dim_channel_map(test_database, "P-INDEX-SAVE", "V1")
    assert len(rows) == len(FIXED_CHANNEL_MAP_PLOTS)
    for index, row in enumerate(rows):
        assert row["plot_key"] == FIXED_CHANNEL_MAP_PLOTS[index]
        assert row["x_channel"] == f"col_{row['x_col']}"
        assert row["y_channel"] == f"col_{row['y_col']}"
        assert row["plot_order"] == index
        assert "001_1 LF LCA" not in row["x_channel"]
        assert "002_2 LF LCA" not in row["y_channel"]


def test_yaml_upload_persists_index_based_lookup_names(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("index_map_yaml_save")
    service.ingest(
        files=[("event_moog_yaml.csv", _csv_with_moog_titles())],
        program_id="P-INDEX-YAML",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-YAML", "work_order": "WO-YAML"},
    )

    service.start_channel_reprocess_from_yaml(
        program_id="P-INDEX-YAML",
        version="V1",
        channel_map_content=_equivalent_yaml_bytes(_fixed_ui_channel_map()),
        user_id=uploader["id"],
    )

    rows = _read_dim_channel_map(test_database, "P-INDEX-YAML", "V1")
    assert len(rows) == len(FIXED_CHANNEL_MAP_PLOTS)
    for row in rows:
        assert row["x_channel"] == f"col_{row['x_col']}"
        assert row["y_channel"] == f"col_{row['y_col']}"
        assert "001_1 LF LCA" not in row["x_channel"]


def test_save_snapshot_normalizes_to_index_based_plot_definitions(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("index_map_snapshot")
    service.ingest(
        files=[("event_snapshot.csv", _csv_with_moog_titles())],
        program_id="P-INDEX-SNAPSHOT",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SNAP", "work_order": "WO-SNAP"},
    )

    service.start_channel_reprocess_from_save(
        program_id="P-INDEX-SNAPSHOT",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    active = test_database.get_active_channel_map_snapshot("P-INDEX-SNAPSHOT", "V1")
    assert active is not None
    payload = json.loads(active["snapshot_json"])
    plots_by_key = {plot["plot_key"]: plot for plot in payload["plots"]}
    assert set(plots_by_key) == set(FIXED_CHANNEL_MAP_PLOTS)
    for plot in plots_by_key.values():
        assert plot["x_channel"] == f"col_{plot['x_col']}"
        assert plot["y_channel"] == f"col_{plot['y_col']}"
        assert isinstance(plot["plot_order"], int)


def test_save_rejects_column_indexes_outside_preview_column_count(
    test_database,
    test_cache,
    test_settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("index_map_validation")
    service.ingest(
        files=[("event_validation.csv", _csv_with_moog_titles())],
        program_id="P-INDEX-VALIDATE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-VAL", "work_order": "WO-VAL"},
    )
    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-INDEX-VALIDATE",
        version="V1",
    )
    column_count = int(artifacts[0]["column_count"] or 0)
    out_of_range_entries = [
        {"plot_key": plot_key, "x_col": 2, "y_col": column_count}
        for plot_key in FIXED_CHANNEL_MAP_PLOTS
    ]

    with pytest.raises(ValueError, match="outside the preview CSV"):
        service.validate_fixed_channel_map(out_of_range_entries, column_count)
