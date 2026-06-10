"""Behavior tests for DB14-07 transfer package export/import with artifact validation."""

from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

import pytest

from server.exceptions import ValidationError
from server.services.ingestion import IngestionService
from server.services.transfer_package import (
    MANIFEST_FILENAME,
    PACKAGE_TYPE,
    TransferPackageService,
    is_transfer_package_root,
)
from server.storage.database import LOAD_DATA_PORTABILITY_TABLES, LOAD_DATA_TABLES, UnifiedStore


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _ingest_csv_event(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content: bytes,
    sample_channel_map_content: bytes,
    *,
    program_id: str = "P-TRANSFER",
    version: str = "V1",
) -> tuple[IngestionService, str, str]:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    owner = test_database.create_user(f"{program_id.lower()}_owner")
    result = service.ingest(
        files=[("transfer_event.csv", sample_csv_content)],
        program_id=program_id,
        version=version,
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-TRANSFER", "work_order": "WO-TRANSFER"},
    )
    assert result.success is True
    return service, owner["id"], result.event_ids[0]


def test_transfer_package_export_includes_manifest_and_source_artifact(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    service, _owner_id, _event_id = _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    source_records = test_database.list_source_artifacts("P-TRANSFER", "V1")
    assert len(source_records) == 1

    export_dir = tmp_path / "transfer-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)

    manifest_path = export_dir / MANIFEST_FILENAME
    assert manifest_path.is_file()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["package_type"] == PACKAGE_TYPE
    assert manifest["artifacts"]

    source_entry = next(
        item for item in manifest["artifacts"] if item["artifact_class"] == "source"
    )
    package_file = export_dir / source_entry["package_path"]
    assert package_file.is_file()
    assert package_file.read_bytes() == sample_csv_content
    assert source_entry["sha256"] == hashlib.sha256(sample_csv_content).hexdigest()

    resolved = service.source_artifact_storage.resolve_uri(source_records[0]["artifact_uri"])
    assert package_file.read_bytes() == resolved.read_bytes()


def test_transfer_package_export_includes_lineage_parquet_tables(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )

    export_dir = tmp_path / "lineage-export"
    TransferPackageService(test_database, test_settings).export_package(export_dir)

    exported = {p.stem for p in export_dir.glob("*.parquet")}
    lineage_only = set(LOAD_DATA_TABLES) - set(LOAD_DATA_PORTABILITY_TABLES)
    assert lineage_only.issubset(exported)
    assert "source_artifacts" in exported
    assert "derived_artifacts" in exported
    assert "event_previews" in exported


def test_validate_transfer_package_rejects_source_artifact_checksum_mismatch(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    export_dir = tmp_path / "checksum-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)

    manifest = json.loads((export_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))
    source_entry = next(
        item for item in manifest["artifacts"] if item["artifact_class"] == "source"
    )
    corrupted = export_dir / source_entry["package_path"]
    corrupted.write_bytes(b"corrupted-bytes")

    with pytest.raises(ValidationError, match="checksum mismatch"):
        transfer.validate_package(export_dir)


def test_validate_transfer_package_rejects_missing_referenced_artifact(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    export_dir = tmp_path / "missing-artifact-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)

    manifest = json.loads((export_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))
    source_entry = next(
        item for item in manifest["artifacts"] if item["artifact_class"] == "source"
    )
    (export_dir / source_entry["package_path"]).unlink()

    with pytest.raises(ValidationError, match="missing artifact"):
        transfer.validate_package(export_dir)


def test_transfer_package_round_trip_preserves_source_artifact_bytes(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    service, owner_id, event_id = _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    source_before = test_database.list_source_artifacts("P-TRANSFER", "V1")[0]

    export_dir = tmp_path / "roundtrip-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)
    transfer.validate_package(export_dir)

    target_settings = test_settings.model_copy(deep=True)
    target_settings.data_root = tmp_path / "target-data"
    target_settings.data_root.mkdir(parents=True, exist_ok=True)
    target = UnifiedStore(target_settings.database_path)
    target_admin = target.create_user("target_admin", role="admin", can_write=True)
    try:
        target_transfer = TransferPackageService(target, target_settings)
        target_transfer.import_package(export_dir)

        source_after = target.list_source_artifacts("P-TRANSFER", "V1")
        assert len(source_after) == 1
        resolved = service.source_artifact_storage.resolve_uri(source_after[0]["artifact_uri"])
        assert resolved.read_bytes() == sample_csv_content
        assert target.get_event(event_id) is not None
        assert target.get_user_by_username("target_admin") is not None
        assert target.get_user_by_username(f"p-transfer_owner") is None
    finally:
        target.close()


def test_legacy_load_data_export_still_omits_lineage_tables(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )

    export_dir = tmp_path / "legacy-export"
    test_database.export_to_parquet(export_dir)

    exported = {p.stem for p in export_dir.glob("*.parquet")}
    assert "source_artifacts" not in exported
    assert not is_transfer_package_root(export_dir)


def test_is_transfer_package_root_detects_manifest(
    tmp_path: Path,
) -> None:
    legacy = tmp_path / "legacy"
    legacy.mkdir()
    (legacy / "schema.sql").write_text("-- schema", encoding="utf-8")
    (legacy / "load.sql").write_text("-- load", encoding="utf-8")
    assert is_transfer_package_root(legacy) is False

    transfer = tmp_path / "transfer"
    transfer.mkdir()
    (transfer / MANIFEST_FILENAME).write_text(
        json.dumps({"package_type": PACKAGE_TYPE}),
        encoding="utf-8",
    )
    assert is_transfer_package_root(transfer) is True


def test_validate_import_zip_accepts_transfer_package_archive(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    from server.services.export import ExportService

    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    export_dir = tmp_path / "zip-export"
    TransferPackageService(test_database, test_settings).export_package(export_dir)
    archive_base = tmp_path / "transfer_zip"
    archive = Path(shutil.make_archive(str(archive_base), "zip", root_dir=export_dir))

    result = ExportService(test_database, test_settings).validate_import_zip(archive)

    assert result["valid"] is True
    assert result.get("package_type") == PACKAGE_TYPE
    assert result.get("artifact_count", 0) >= 1
    assert "source_artifacts" in result["tables"]


def test_validate_transfer_package_rejects_schedule_checksum_mismatch(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
    sample_channel_map_content,
    tmp_path: Path,
) -> None:
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )

    _ingest_csv_event(
        test_database,
        test_cache,
        test_settings,
        sample_csv_content,
        sample_channel_map_content,
    )
    owner = test_database.create_user("schedule_transfer_owner")
    schedule_content = b"""*id schedule_v1
*multiplier 1.0
*run_a* 5 0.5
"""
    parsed = DurabilityScheduleParser().parse_bytes(schedule_content)
    DurabilityScheduleStorageService(test_settings.data_root, test_database).attach_schedule(
        program_id="P-TRANSFER",
        version="V1",
        source_filename="durability.sch",
        content=schedule_content,
        parsed=parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )

    export_dir = tmp_path / "schedule-checksum-export"
    transfer = TransferPackageService(test_database, test_settings)
    transfer.export_package(export_dir)

    manifest = json.loads((export_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))
    schedule_entry = next(
        item for item in manifest["artifacts"] if item["artifact_class"] == "schedule"
    )
    (export_dir / schedule_entry["package_path"]).write_bytes(b"tampered")

    with pytest.raises(ValidationError, match="checksum mismatch"):
        transfer.validate_package(export_dir)
