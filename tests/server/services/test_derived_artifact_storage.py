"""Behavior tests for derived artifact storage (canonical CSV)."""

import hashlib

from server.services.derived_artifact_storage import DerivedArtifactStorageService


def _make_service(test_database, test_settings) -> DerivedArtifactStorageService:
    return DerivedArtifactStorageService(test_settings.data_root, test_database)


def test_store_canonical_csv_writes_derived_bytes_with_checksum_and_uri(
    test_database, test_settings, sample_csv_content
) -> None:
    service = _make_service(test_database, test_settings)
    uploader = test_database.create_user("canonical_csv_owner")
    source = test_database.upsert_source_artifact(
        program_id="P-CANON",
        version="V1",
        source_filename="event.csv",
        artifact_type="source_csv",
        artifact_uri="artifact://sources/src_abc123/original.csv",
        sha256=hashlib.sha256(sample_csv_content).hexdigest(),
        size_bytes=len(sample_csv_content),
        owner_user_id=uploader["id"],
    )

    stored = service.store_canonical_csv(
        program_id="P-CANON",
        version="V1",
        source_artifact_id=source,
        content=sample_csv_content,
        owner_user_id=uploader["id"],
    )

    expected_sha256 = hashlib.sha256(sample_csv_content).hexdigest()
    assert stored.artifact_type == "canonical_csv"
    assert stored.sha256 == expected_sha256
    assert stored.source_artifact_id == source
    assert stored.artifact_uri == (
        f"artifact://canonical/can_{expected_sha256[:16]}/canonical.csv"
    )

    resolved = service.resolve_uri(stored.artifact_uri)
    assert resolved.read_bytes() == sample_csv_content

    records = test_database.list_derived_artifacts("P-CANON", "V1")
    assert len(records) == 1
    assert records[0]["artifact_uri"] == stored.artifact_uri
    assert records[0]["source_artifact_id"] == source
