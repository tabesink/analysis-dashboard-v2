"""DB14-08 regression pack: end-to-end round-trip coverage for the lean source-of-truth model."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
import yaml

from server.exceptions import ValidationError
from server.services.channel_map_snapshot import ChannelMapNormalizationService
from server.services.derived_data_lineage import DerivedDataLineageService
from server.services.durability_schedule import (
    DurabilityScheduleParser,
    DurabilityScheduleStorageService,
)
from server.services.etl import RSPConversionResult
from server.services.event_preview import EventPreviewService
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from server.services.transfer_package import TransferPackageService
from server.storage.database import UnifiedStore


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _count_rows(store: UnifiedStore, table: str, *, where: str = "", params: list | None = None) -> int:
    query = f"SELECT COUNT(*) FROM {table}"
    if where:
        query += f" WHERE {where}"
    return int(store.read_connection.execute(query, params or []).fetchone()[0])


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


def _sample_schedule_bytes() -> bytes:
    return b"""*id regression_schedule_v1
*multiplier 1.25
*run_a* 8 0.4
"""


def _stub_rsp_converter(canonical_csv: bytes):
    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            return RSPConversionResult(
                filename=filename.replace(".rsp", ".csv"),
                content=canonical_csv,
                row_count=10,
                channel_count=5,
            )

    return StubRSPConverter()


def _ingest_csv(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content: bytes,
    sample_channel_map_content: bytes,
    *,
    program_id: str,
    version: str = "V1",
    filename: str = "regression_event.csv",
) -> tuple[IngestionService, str, str]:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    owner = test_database.create_user(f"{program_id.lower()}_owner")
    result = service.ingest(
        files=[(filename, sample_csv_content)],
        program_id=program_id,
        version=version,
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": f"JOB-{program_id}", "work_order": f"WO-{program_id}"},
    )
    assert result.success is True
    return service, owner["id"], result.event_ids[0]


def _import_transfer_package(
    export_dir: Path,
    target_settings,
) -> UnifiedStore:
    target = UnifiedStore(target_settings.database_path)
    TransferPackageService(target, target_settings).import_package(export_dir)
    return target


def test_csv_roundtrip_preserves_lineage_preview_measurements_and_lttb(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    service, _owner_id, event_id = _ingest_csv(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
        program_id="P-CSV-RT",
    )

    source_records = test_database.list_source_artifacts("P-CSV-RT", "V1")
    derived_records = test_database.list_derived_artifacts("P-CSV-RT", "V1")
    assert len(source_records) == 1
    assert source_records[0]["artifact_type"] == "source_csv"
    assert source_records[0]["sha256"] == hashlib.sha256(sample_csv_content).hexdigest()

    canonical_bytes = service.derived_artifact_storage.resolve_uri(
        derived_records[0]["artifact_uri"]
    ).read_bytes()
    assert canonical_bytes == sample_csv_content

    preview = EventPreviewService(db=test_database).get_for_event(event_id)
    assert preview is not None
    assert preview["row_count"] == 10
    assert preview["conversion_kind"] == "identity"
    assert preview["source_filename"] == "regression_event.csv"

    measurements_before = _count_rows(test_database, "measurements_raw", where="event_id = ?", params=[event_id])
    lttb_before = _count_rows(test_database, "measurements_lttb", where="event_id = ?", params=[event_id])
    assert measurements_before > 0
    assert lttb_before > 0

    lineage = DerivedDataLineageService(test_database).get_lineage(event_id)
    assert lineage is not None
    assert lineage["derived_artifact_id"] == derived_records[0]["artifact_id"]
    assert lineage["channel_map_snapshot_id"] is not None

    export_dir = tmp_path / "csv-roundtrip"
    TransferPackageService(test_database, test_settings).export_package(export_dir)

    target_settings = test_settings.model_copy(deep=True)
    target_settings.data_root = tmp_path / "csv-target-data"
    target_settings.data_root.mkdir(parents=True, exist_ok=True)
    target = _import_transfer_package(export_dir, target_settings)
    try:
        imported_source = target.list_source_artifacts("P-CSV-RT", "V1")
        imported_derived = target.list_derived_artifacts("P-CSV-RT", "V1")
        assert len(imported_source) == 1
        assert len(imported_derived) == 1

        resolved_source = service.source_artifact_storage.resolve_uri(imported_source[0]["artifact_uri"])
        resolved_canonical = service.derived_artifact_storage.resolve_uri(
            imported_derived[0]["artifact_uri"]
        )
        assert resolved_source.read_bytes() == sample_csv_content
        assert resolved_canonical.read_bytes() == sample_csv_content

        imported_preview = EventPreviewService(db=target).get_for_event(event_id)
        assert imported_preview is not None
        assert imported_preview["row_count"] == preview["row_count"]
        assert imported_preview["headers"] == preview["headers"]

        assert _count_rows(target, "measurements_raw", where="event_id = ?", params=[event_id]) == (
            measurements_before
        )
        assert _count_rows(target, "measurements_lttb", where="event_id = ?", params=[event_id]) == (
            lttb_before
        )

        imported_lineage = DerivedDataLineageService(target).get_lineage(event_id)
        assert imported_lineage is not None
        assert imported_lineage["derived_artifact_id"] == imported_derived[0]["artifact_id"]
    finally:
        target.close()


def test_rsp_roundtrip_preserves_dual_artifacts_and_matches_csv_downstream(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    csv_service, _csv_owner, csv_event_id = _ingest_csv(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
        program_id="P-RSP-PARITY-CSV",
        filename="parity.csv",
    )

    rsp_service = _make_ingestion_service(test_database, test_cache, test_settings)
    rsp_owner = test_database.create_user("rsp_parity_owner")
    rsp_service.rsp_converter = _stub_rsp_converter(sample_csv_content)
    raw_rsp = b"raw-rsp-regression-payload"
    rsp_result = rsp_service.ingest(
        files=[("parity.rsp", raw_rsp)],
        program_id="P-RSP-PARITY-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=rsp_owner["id"],
        metadata={"job_number": "JOB-RSP-PARITY", "work_order": "WO-RSP-PARITY"},
    )
    assert rsp_result.success is True
    rsp_event_id = rsp_result.event_ids[0]

    rsp_sources = test_database.list_source_artifacts("P-RSP-PARITY-RSP", "V1")
    rsp_derived = test_database.list_derived_artifacts("P-RSP-PARITY-RSP", "V1")
    assert len(rsp_sources) == 1
    assert len(rsp_derived) == 1
    assert rsp_sources[0]["artifact_type"] == "source_rsp"
    assert rsp_derived[0]["artifact_type"] == "canonical_csv"
    assert rsp_sources[0]["sha256"] == hashlib.sha256(raw_rsp).hexdigest()
    assert (
        rsp_service.source_artifact_storage.resolve_uri(rsp_sources[0]["artifact_uri"]).read_bytes()
        == raw_rsp
    )
    assert (
        rsp_service.derived_artifact_storage.resolve_uri(rsp_derived[0]["artifact_uri"]).read_bytes()
        == sample_csv_content
    )

    csv_preview = EventPreviewService(db=test_database).get_for_event(csv_event_id)
    rsp_preview = EventPreviewService(db=test_database).get_for_event(rsp_event_id)
    assert csv_preview is not None
    assert rsp_preview is not None
    assert rsp_preview["headers"] == csv_preview["headers"]
    assert rsp_preview["row_count"] == csv_preview["row_count"]
    assert rsp_preview["conversion_kind"] == "rsp_converter"

    csv_measurements = _count_rows(
        test_database, "measurements_raw", where="event_id = ?", params=[csv_event_id]
    )
    rsp_measurements = _count_rows(
        test_database, "measurements_raw", where="event_id = ?", params=[rsp_event_id]
    )
    csv_lttb = _count_rows(
        test_database, "measurements_lttb", where="event_id = ?", params=[csv_event_id]
    )
    rsp_lttb = _count_rows(
        test_database, "measurements_lttb", where="event_id = ?", params=[rsp_event_id]
    )
    assert rsp_measurements == csv_measurements
    assert rsp_lttb == csv_lttb

    export_dir = tmp_path / "rsp-roundtrip"
    TransferPackageService(test_database, test_settings).export_package(export_dir)

    target_settings = test_settings.model_copy(deep=True)
    target_settings.data_root = tmp_path / "rsp-target-data"
    target_settings.data_root.mkdir(parents=True, exist_ok=True)
    target = _import_transfer_package(export_dir, target_settings)
    try:
        imported_rsp_sources = target.list_source_artifacts("P-RSP-PARITY-RSP", "V1")
        imported_rsp_derived = target.list_derived_artifacts("P-RSP-PARITY-RSP", "V1")
        assert (
            csv_service.source_artifact_storage.resolve_uri(
                imported_rsp_sources[0]["artifact_uri"]
            ).read_bytes()
            == raw_rsp
        )
        assert (
            csv_service.derived_artifact_storage.resolve_uri(
                imported_rsp_derived[0]["artifact_uri"]
            ).read_bytes()
            == sample_csv_content
        )
    finally:
        target.close()


def _snapshot_plot_columns(snapshot_json: str) -> list[tuple[str, int, int]]:
    payload = json.loads(snapshot_json)
    return [
        (plot["plot_key"], plot["x_col"], plot["y_col"])
        for plot in payload["plots"]
    ]


def test_channel_map_yaml_and_ui_paths_produce_equivalent_snapshots(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
) -> None:
    normalizer = ChannelMapNormalizationService()
    channel_map = _fixed_ui_channel_map()
    yaml_snapshot = normalizer.normalize_from_yaml(_equivalent_yaml_bytes(channel_map))
    ui_snapshot = normalizer.normalize_from_plot_map(channel_map, authoring_source="ui")
    assert yaml_snapshot.snapshot_sha256 == ui_snapshot.snapshot_sha256

    service = _make_ingestion_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("channel_map_equiv_owner")

    yaml_result = service.ingest(
        files=[("yaml_path.csv", sample_csv_content)],
        program_id="P-MAP-YAML",
        version="V1",
        channel_map_content=_equivalent_yaml_bytes(channel_map),
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-YAML", "work_order": "WO-YAML"},
    )
    assert yaml_result.success is True
    yaml_event_id = yaml_result.event_ids[0]
    yaml_event_snapshot = test_database.get_channel_map_snapshot_for_event(yaml_event_id)
    assert yaml_event_snapshot is not None
    assert yaml_event_snapshot["authoring_source"] == "yaml"

    service.ingest(
        files=[("ui_path.csv", sample_csv_content)],
        program_id="P-MAP-UI",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-UI", "work_order": "WO-UI"},
    )
    entries = [
        {"plot_key": plot_key, "x_col": mapping["x_col"], "y_col": mapping["y_col"]}
        for plot_key, mapping in channel_map.items()
    ]
    process_result = service.save_channel_map_and_process_artifacts(
        program_id="P-MAP-UI",
        version="V1",
        entries=entries,
        user_id=owner["id"],
    )
    assert process_result["processed_count"] == 1

    ui_events = test_database.get_events(program_id="P-MAP-UI", version="V1")
    assert len(ui_events) == 1
    ui_event_snapshot = test_database.get_channel_map_snapshot_for_event(ui_events[0]["event_id"])
    assert ui_event_snapshot is not None
    assert ui_event_snapshot["authoring_source"] == "ui"
    assert _snapshot_plot_columns(yaml_event_snapshot["snapshot_json"]) == _snapshot_plot_columns(
        ui_event_snapshot["snapshot_json"]
    )


def test_durability_schedule_enforces_one_active_and_edit_permissions(
    test_database,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    test_cache,
    tmp_path: Path,
) -> None:
    _service, owner_id, _event_id = _ingest_csv(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
        program_id="P-SCH-REG",
    )
    outsider = test_database.create_user("schedule_regression_outsider", can_write=True)
    read_only = test_database.create_user("schedule_regression_reader", can_write=False)

    assert test_database.user_can_edit_program_version("P-SCH-REG", "V1", owner_id, False) is True
    assert (
        test_database.user_can_edit_program_version("P-SCH-REG", "V1", outsider["id"], False) is False
    )
    assert test_database.user_can_edit_program_version("P-SCH-REG", "V1", read_only["id"], False) is False

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parser = DurabilityScheduleParser()
    first_content = _sample_schedule_bytes()
    second_content = first_content.replace(b"regression_schedule_v1", b"regression_schedule_v2")

    first = storage.attach_schedule(
        program_id="P-SCH-REG",
        version="V1",
        source_filename="first.sch",
        content=first_content,
        parsed=parser.parse_bytes(first_content),
        owner_user_id=owner_id,
        actor_user_id=owner_id,
    )
    second = storage.attach_schedule(
        program_id="P-SCH-REG",
        version="V1",
        source_filename="second.sch",
        content=second_content,
        parsed=parser.parse_bytes(second_content),
        owner_user_id=owner_id,
        actor_user_id=owner_id,
    )
    assert second.replaced_previous is True
    assert second.previous_schedule_id == first.schedule_id

    active = test_database.get_active_durability_schedule("P-SCH-REG", "V1")
    assert active is not None
    assert active["schedule_id"] == second.schedule_id
    assert len(test_database.list_durability_schedule_artifacts("P-SCH-REG", "V1")) == 2

    export_dir = tmp_path / "schedule-roundtrip"
    TransferPackageService(test_database, test_settings).export_package(export_dir)

    target_settings = test_settings.model_copy(deep=True)
    target_settings.data_root = tmp_path / "schedule-target-data"
    target_settings.data_root.mkdir(parents=True, exist_ok=True)
    target = _import_transfer_package(export_dir, target_settings)
    try:
        imported_active = target.get_active_durability_schedule("P-SCH-REG", "V1")
        assert imported_active is not None
        assert imported_active["schedule_id"] == second.schedule_id
        assert imported_active["schedule_sha256"] == hashlib.sha256(second_content).hexdigest()

        resolved = storage.resolve_uri(imported_active["artifact_uri"])
        assert resolved.read_bytes() == second_content
    finally:
        target.close()


def test_transfer_import_rejects_checksum_mismatch_and_missing_artifacts(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    _ingest_csv(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
        program_id="P-TRANSFER-REJECT",
    )

    export_dir = tmp_path / "reject-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)

    manifest = json.loads((export_dir / "manifest.json").read_text(encoding="utf-8"))
    source_entry = next(item for item in manifest["artifacts"] if item["artifact_class"] == "source")
    corrupted = export_dir / source_entry["package_path"]
    corrupted.write_bytes(b"tampered-source-bytes")

    with pytest.raises(ValidationError, match="checksum mismatch"):
        transfer.validate_package(export_dir)

    transfer.export_package(export_dir)
    (export_dir / source_entry["package_path"]).unlink()

    with pytest.raises(ValidationError, match="missing artifact"):
        transfer.validate_package(export_dir)
