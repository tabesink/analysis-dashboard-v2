"""Behavior tests for measurement/LTTB lineage and stale derived-data handling."""

import json
import yaml

from server.services.derived_data_lineage import (
    LTTB_DATA_KIND,
    MEASUREMENTS_DATA_KIND,
    STATUS_CURRENT,
    STATUS_STALE,
    DerivedDataLineageService,
)
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _make_lineage_service(test_database) -> DerivedDataLineageService:
    return DerivedDataLineageService(test_database)


def _fixed_ui_channel_map() -> dict[str, dict]:
    return {
        plot_key: {
            "x_col": 2,
            "y_col": 3 if index % 2 == 0 else 4,
            "x_channel": "col_2",
            "y_channel": f"col_{3 if index % 2 == 0 else 4}",
            "plot_order": index,
            "x_scale_factor": 1.0,
            "y_scale_factor": 1.0,
            "x_unit": None,
            "y_unit": None,
        }
        for index, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    }


def _equivalent_yaml_bytes(channel_map: dict[str, dict]) -> bytes:
    payload = {
        plot_key: {
            "x_col": mapping["x_col"],
            "y_col": mapping["y_col"],
        }
        for plot_key, mapping in channel_map.items()
    }
    return yaml.safe_dump(payload, sort_keys=True).encode("utf-8")


def test_ingest_records_derived_data_lineage_with_canonical_csv_and_snapshot(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    lineage = _make_lineage_service(test_database)
    uploader = test_database.create_user("derived_lineage_owner")

    result = service.ingest(
        files=[("event_lineage.csv", sample_csv_content)],
        program_id="P-DERIVED-LINEAGE",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-LINEAGE", "work_order": "WO-LINEAGE"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    derived = lineage.get_lineage(event_id)
    assert derived is not None
    assert derived["measurements_status"] == STATUS_CURRENT
    assert derived["lttb_status"] == STATUS_CURRENT
    assert derived["measurements_data_kind"] == MEASUREMENTS_DATA_KIND
    assert derived["lttb_data_kind"] == LTTB_DATA_KIND
    assert derived["derived_artifact_id"] is not None
    assert derived["channel_map_snapshot_id"] is not None
    assert derived["canonical_artifact_uri"].startswith("artifact://canonical/")

    snapshot = test_database.get_channel_map_snapshot_for_event(event_id)
    assert snapshot is not None
    assert derived["channel_map_snapshot_id"] == snapshot["snapshot_id"]


def test_pending_event_lttb_marked_stale_when_active_snapshot_changes(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    lineage = _make_lineage_service(test_database)
    uploader = test_database.create_user("derived_stale_owner")
    first_yaml = _equivalent_yaml_bytes(_fixed_ui_channel_map())
    second_map = _fixed_ui_channel_map()
    second_map[FIXED_CHANNEL_MAP_PLOTS[0]] = {
        **second_map[FIXED_CHANNEL_MAP_PLOTS[0]],
        "y_col": 4,
        "y_channel": "col_4",
    }
    second_yaml = _equivalent_yaml_bytes(second_map)

    first_result = service.ingest(
        files=[("event_one.csv", sample_csv_content)],
        program_id="P-DERIVED-STALE",
        version="V1",
        channel_map_content=first_yaml,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-1", "work_order": "WO-1"},
    )
    assert first_result.success is True
    first_event_id = first_result.event_ids[0]
    first_lineage = lineage.get_lineage(first_event_id)
    assert first_lineage is not None
    assert first_lineage["measurements_status"] == STATUS_CURRENT

    second_result = service.ingest(
        files=[("event_two.csv", sample_csv_content + b"\n11,0.010,110.0,210.0,310.0\n")],
        program_id="P-DERIVED-STALE",
        version="V1",
        channel_map_content=second_yaml,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-2", "work_order": "WO-2"},
    )
    assert second_result.success is True
    second_event_id = second_result.event_ids[0]

    first_after = lineage.get_lineage(first_event_id)
    second_after = lineage.get_lineage(second_event_id)
    assert first_after is not None
    assert second_after is not None
    assert first_after["measurements_status"] == STATUS_CURRENT
    assert first_after["lttb_status"] == STATUS_STALE
    assert second_after["measurements_status"] == STATUS_CURRENT
    assert second_after["lttb_status"] == STATUS_CURRENT
    assert first_after["channel_map_snapshot_id"] != second_after["channel_map_snapshot_id"]


def test_approved_event_lineage_stays_current_when_active_snapshot_changes(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    lineage = _make_lineage_service(test_database)
    uploader = test_database.create_user("derived_approved_owner")
    first_yaml = _equivalent_yaml_bytes(_fixed_ui_channel_map())
    second_map = _fixed_ui_channel_map()
    second_map[FIXED_CHANNEL_MAP_PLOTS[0]] = {
        **second_map[FIXED_CHANNEL_MAP_PLOTS[0]],
        "y_col": 4,
        "y_channel": "col_4",
    }
    second_yaml = _equivalent_yaml_bytes(second_map)

    first_result = service.ingest(
        files=[("approved_event.csv", sample_csv_content)],
        program_id="P-DERIVED-APPROVED",
        version="V1",
        channel_map_content=first_yaml,
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-APPROVED", "work_order": "WO-APPROVED"},
    )
    assert first_result.success is True
    approved_event_id = first_result.event_ids[0]
    approved_snapshot_id = lineage.get_lineage(approved_event_id)["channel_map_snapshot_id"]

    second_result = service.ingest(
        files=[("pending_event.csv", sample_csv_content + b"\n11,0.010,110.0,210.0,310.0\n")],
        program_id="P-DERIVED-APPROVED",
        version="V1",
        channel_map_content=second_yaml,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PENDING", "work_order": "WO-PENDING"},
    )
    assert second_result.success is True

    approved_after = lineage.get_lineage(approved_event_id)
    assert approved_after is not None
    assert approved_after["measurements_status"] == STATUS_CURRENT
    assert approved_after["lttb_status"] == STATUS_CURRENT
    assert approved_after["channel_map_snapshot_id"] == approved_snapshot_id


def test_reprocess_pending_artifact_restores_current_derived_data_status(
    test_database, test_cache, test_settings
) -> None:
    from tests.server.services.test_ingestion_service_status import _csv_with_detected_damage_channels

    service = _make_ingestion_service(test_database, test_cache, test_settings)
    lineage = _make_lineage_service(test_database)
    uploader = test_database.create_user("derived_reprocess_owner")

    service.ingest(
        files=[("event_pending_reprocess.csv", _csv_with_detected_damage_channels())],
        program_id="P-DERIVED-REPROCESS",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-REPROCESS", "work_order": "WO-REPROCESS"},
    )

    entries = [
        {"plot_key": plot_key, "x_col": 2, "y_col": 3 if i % 2 == 0 else 4}
        for i, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    ]
    result = service.save_channel_map_and_process_artifacts(
        program_id="P-DERIVED-REPROCESS",
        version="V1",
        entries=entries,
        user_id=uploader["id"],
    )

    assert result["processed_count"] == 1
    event_id = result["processed"][0]["event_id"]
    derived = lineage.get_lineage(event_id)
    assert derived is not None
    assert derived["measurements_status"] == STATUS_CURRENT
    assert derived["lttb_status"] == STATUS_CURRENT
    assert derived["lttb_data_kind"] == LTTB_DATA_KIND
