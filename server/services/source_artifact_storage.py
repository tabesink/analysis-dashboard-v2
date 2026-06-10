"""Immutable source artifact storage with portable URI ledger records."""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from server.storage.database import UnifiedStore

ARTIFACT_SCHEME = "artifact://"
SOURCES_PREFIX = "sources/"
UNSAFE_PATH_PATTERN = re.compile(r"(\.\.|\x00)")

SOURCE_CSV_TYPE = "source_csv"
SOURCE_RSP_TYPE = "source_rsp"


@dataclass(frozen=True)
class StoredSourceArtifact:
    """Public result of storing an original upload artifact."""

    artifact_id: int
    artifact_type: str
    artifact_uri: str
    sha256: str
    size_bytes: int
    source_filename: str


class SourceArtifactStorageService:
    """Writes immutable original upload bytes and records lineage metadata in DuckDB."""

    REL_ROOT = Path("artifacts") / "sources"

    def __init__(self, data_root: Path, db: UnifiedStore):
        self.data_root = data_root.resolve()
        self.db = db

    def store_original_upload(
        self,
        *,
        program_id: str,
        version: str,
        filename: str,
        content: bytes,
        owner_user_id: str | None,
    ) -> StoredSourceArtifact:
        """Persist original CSV or RSP bytes and upsert the ledger record."""
        sha256 = hashlib.sha256(content).hexdigest()
        artifact_type = self._artifact_type_for_filename(filename)
        basename = self._basename_for_type(artifact_type)
        source_key = self._source_key(sha256)
        artifact_uri = self.build_artifact_uri(source_key, basename)

        target = self.resolve_uri(artifact_uri)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if target.read_bytes() != content:
                raise ValueError("Existing artifact content does not match checksum")
        else:
            target.write_bytes(content)

        artifact_id = self.db.upsert_source_artifact(
            program_id=program_id,
            version=version,
            source_filename=filename,
            artifact_type=artifact_type,
            artifact_uri=artifact_uri,
            sha256=sha256,
            size_bytes=len(content),
            owner_user_id=owner_user_id,
        )
        return StoredSourceArtifact(
            artifact_id=artifact_id,
            artifact_type=artifact_type,
            artifact_uri=artifact_uri,
            sha256=sha256,
            size_bytes=len(content),
            source_filename=filename,
        )

    def build_artifact_uri(self, source_key: str, basename: str) -> str:
        self._validate_uri_components(source_key, basename)
        return f"{ARTIFACT_SCHEME}{SOURCES_PREFIX}{source_key}/{basename}"

    def resolve_uri(self, artifact_uri: str) -> Path:
        """Resolve a portable artifact URI to an absolute filesystem path."""
        if not artifact_uri.startswith(ARTIFACT_SCHEME):
            raise ValueError("Artifact URI must use artifact:// scheme")
        rel = artifact_uri[len(ARTIFACT_SCHEME):]
        if UNSAFE_PATH_PATTERN.search(rel) or rel.startswith("/") or "\\" in rel:
            raise ValueError("Unsafe artifact path component")
        if not rel.startswith(SOURCES_PREFIX):
            raise ValueError("Unsupported artifact URI namespace")
        remainder = rel[len(SOURCES_PREFIX):]
        parts = remainder.split("/")
        if len(parts) != 2:
            raise ValueError("Invalid artifact URI path")
        source_key, basename = parts
        self._validate_uri_components(source_key, basename)
        return self.data_root / self.REL_ROOT / source_key / basename

    def _artifact_type_for_filename(self, filename: str) -> str:
        lower = filename.lower()
        if lower.endswith(".rsp"):
            return SOURCE_RSP_TYPE
        if lower.endswith(".csv"):
            return SOURCE_CSV_TYPE
        raise ValueError(f"Unsupported source artifact filename: {filename}")

    def _basename_for_type(self, artifact_type: str) -> str:
        if artifact_type == SOURCE_RSP_TYPE:
            return "original.rsp"
        return "original.csv"

    def _source_key(self, sha256: str) -> str:
        return f"src_{sha256[:16]}"

    def _validate_uri_components(self, source_key: str, basename: str) -> None:
        for part in (source_key, basename):
            if not part or UNSAFE_PATH_PATTERN.search(part):
                raise ValueError("Unsafe artifact path component")
            if part.startswith("/") or "\\" in part:
                raise ValueError("Unsafe artifact path component")
