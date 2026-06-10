"""Behavior tests for channel-map snapshot normalization and lineage."""

import hashlib
import json

import yaml

from server.services.channel_map_snapshot import (
    ChannelMapNormalizationService,
    ChannelMapSnapshotStorageService,
)
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService


def _make_normalizer() -> ChannelMapNormalizationService:
    return ChannelMapNormalizationService()


def _make_storage(test_database, test_settings) -> ChannelMapSnapshotStorageService:
    return ChannelMapSnapshotStorageService(test_settings.data_root, test_database)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _fixed_ui_channel_map() -> dict[str, dict]:
    return {
        plot_key: {
            "x_col": 2,
            "y_col": 3 if index % 2 == 0 else 4,
            "x_channel": f"col_2",
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


def test_normalize_yaml_and_ui_produce_equivalent_snapshot() -> None:
    normalizer = _make_normalizer()
    channel_map = _fixed_ui_channel_map()

    yaml_snapshot = normalizer.normalize_from_yaml(_equivalent_yaml_bytes(channel_map))
    ui_snapshot = normalizer.normalize_from_plot_map(channel_map, authoring_source="ui")

    assert yaml_snapshot.snapshot_sha256 == ui_snapshot.snapshot_sha256
    assert yaml_snapshot.snapshot_json == ui_snapshot.snapshot_json
    assert yaml_snapshot.authoring_source == "yaml"
    assert ui_snapshot.authoring_source == "ui"

    payload = json.loads(yaml_snapshot.snapshot_json)
    assert [plot["plot_key"] for plot in payload["plots"]] == sorted(FIXED_CHANNEL_MAP_PLOTS)


def test_store_snapshot_sets_one_active_snapshot_per_program_version(
    test_database, test_settings
) -> None:
    storage = _make_storage(test_database, test_settings)
    normalizer = _make_normalizer()
    owner = test_database.create_user("snapshot_owner")
    first = normalizer.normalize_from_plot_map(_fixed_ui_channel_map(), authoring_source="ui")
    second_map = _fixed_ui_channel_map()
    second_map[FIXED_CHANNEL_MAP_PLOTS[0]] = {
        **second_map[FIXED_CHANNEL_MAP_PLOTS[0]],
        "y_col": 4,
        "y_channel": "col_4",
    }
    second = normalizer.normalize_from_plot_map(second_map, authoring_source="yaml")

    first_stored = storage.store_snapshot(
        program_id="P-SNAP",
        version="V1",
        normalized=first,
        owner_user_id=owner["id"],
    )
    storage.set_active_snapshot("P-SNAP", "V1", first_stored.snapshot_id)

    second_stored = storage.store_snapshot(
        program_id="P-SNAP",
        version="V1",
        normalized=second,
        owner_user_id=owner["id"],
    )
    storage.set_active_snapshot("P-SNAP", "V1", second_stored.snapshot_id)

    active = test_database.get_active_channel_map_snapshot("P-SNAP", "V1")
    assert active is not None
    assert active["snapshot_id"] == second_stored.snapshot_id
    assert active["snapshot_sha256"] == second.snapshot_sha256

    snapshots = test_database.list_channel_map_snapshots("P-SNAP", "V1")
    assert len(snapshots) == 2
    assert {row["snapshot_id"] for row in snapshots} == {
        first_stored.snapshot_id,
        second_stored.snapshot_id,
    }

    resolved = storage.resolve_uri(first_stored.artifact_uri)
    assert resolved.read_bytes().decode("utf-8") == first.snapshot_json


def test_ingest_links_event_to_channel_map_snapshot(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("snapshot_ingest_owner")

    result = service.ingest(
        files=[("event_snapshot.csv", sample_csv_content)],
        program_id="P-SNAP-INGEST",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SNAP", "work_order": "WO-SNAP"},
    )

    assert result.success is True
    event_id = result.event_ids[0]

    snapshot = test_database.get_channel_map_snapshot_for_event(event_id)
    assert snapshot is not None
    assert snapshot["authoring_source"] == "yaml"
    assert snapshot["artifact_uri"].startswith("artifact://snapshots/")

    active = test_database.get_active_channel_map_snapshot("P-SNAP-INGEST", "V1")
    assert active is not None
    assert active["snapshot_id"] == snapshot["snapshot_id"]

    expected_sha256 = hashlib.sha256(snapshot["snapshot_json"].encode("utf-8")).hexdigest()
    assert snapshot["snapshot_sha256"] == expected_sha256


def test_later_channel_map_edit_preserves_historical_event_snapshot(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("snapshot_lineage_owner")
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
        program_id="P-SNAPSHOT-LINEAGE",
        version="V1",
        channel_map_content=first_yaml,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-1", "work_order": "WO-1"},
    )
    assert first_result.success is True
    first_event_id = first_result.event_ids[0]
    first_snapshot = test_database.get_channel_map_snapshot_for_event(first_event_id)
    assert first_snapshot is not None

    second_result = service.ingest(
        files=[("event_two.csv", sample_csv_content + b"\n11,0.010,110.0,210.0,310.0\n")],
        program_id="P-SNAPSHOT-LINEAGE",
        version="V1",
        channel_map_content=second_yaml,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-2", "work_order": "WO-2"},
    )
    assert second_result.success is True
    second_event_id = second_result.event_ids[0]
    second_snapshot = test_database.get_channel_map_snapshot_for_event(second_event_id)
    assert second_snapshot is not None

    assert first_snapshot["snapshot_id"] != second_snapshot["snapshot_id"]
    assert test_database.get_channel_map_snapshot_for_event(first_event_id)["snapshot_id"] == (
        first_snapshot["snapshot_id"]
    )

    active = test_database.get_active_channel_map_snapshot("P-SNAPSHOT-LINEAGE", "V1")
    assert active is not None
    assert active["snapshot_id"] == second_snapshot["snapshot_id"]
