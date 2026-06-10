"""Behavior tests for immutable source artifact storage."""

import hashlib
from pathlib import Path

import pytest

from server.services.source_artifact_storage import SourceArtifactStorageService


def _make_service(test_database, test_settings) -> SourceArtifactStorageService:
    return SourceArtifactStorageService(test_settings.data_root, test_database)


def test_csv_upload_stores_immutable_artifact_with_checksum_and_uri(
    test_database, test_settings, sample_csv_content
) -> None:
    service = _make_service(test_database, test_settings)
    uploader = test_database.create_user("source_csv_owner")
    content = sample_csv_content

    stored = service.store_original_upload(
        program_id="P-SOURCE",
        version="V1",
        filename="event_source.csv",
        content=content,
        owner_user_id=uploader["id"],
    )

    expected_sha256 = hashlib.sha256(content).hexdigest()
    assert stored.artifact_type == "source_csv"
    assert stored.sha256 == expected_sha256
    assert stored.size_bytes == len(content)
    assert stored.artifact_uri == (
        f"artifact://sources/src_{expected_sha256[:16]}/original.csv"
    )

    resolved = service.resolve_uri(stored.artifact_uri)
    assert resolved.read_bytes() == content

    records = test_database.list_source_artifacts(program_id="P-SOURCE", version="V1")
    assert len(records) == 1
    assert records[0]["artifact_uri"] == stored.artifact_uri
    assert records[0]["sha256"] == expected_sha256
    assert records[0]["owner_user_id"] == uploader["id"]


def test_rsp_upload_stores_original_bytes_outside_duckdb(
    test_database, test_settings
) -> None:
    service = _make_service(test_database, test_settings)
    uploader = test_database.create_user("source_rsp_owner")
    content = b"raw-rsp-bytes"

    stored = service.store_original_upload(
        program_id="P-RSP-SOURCE",
        version="V1",
        filename="capture.rsp",
        content=content,
        owner_user_id=uploader["id"],
    )

    expected_sha256 = hashlib.sha256(content).hexdigest()
    assert stored.artifact_type == "source_rsp"
    assert stored.artifact_uri.endswith("/original.rsp")
    assert stored.sha256 == expected_sha256

    resolved = service.resolve_uri(stored.artifact_uri)
    assert resolved.read_bytes() == content
    assert resolved.is_relative_to(test_settings.data_root / "artifacts" / "sources")


def test_resolve_uri_rejects_unsafe_artifact_paths(
    test_database, test_settings
) -> None:
    service = _make_service(test_database, test_settings)

    with pytest.raises(ValueError, match="Unsafe artifact path"):
        service.resolve_uri("artifact://sources/../escape/original.csv")

    with pytest.raises(ValueError, match="artifact:// scheme"):
        service.resolve_uri("file:///etc/passwd")

    with pytest.raises(ValueError, match="Unsupported artifact URI namespace"):
        service.resolve_uri("artifact://channel-map/foo/bar.csv")
