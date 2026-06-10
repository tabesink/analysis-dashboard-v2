"""Derived artifact storage for canonical CSV and other non-source artifacts."""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from server.services.source_artifact_storage import ARTIFACT_SCHEME, UNSAFE_PATH_PATTERN
from server.storage.database import UnifiedStore

CANONICAL_PREFIX = "canonical/"
CANONICAL_CSV_TYPE = "canonical_csv"


@dataclass(frozen=True)
class StoredDerivedArtifact:
    """Public result of storing a derived artifact."""

    artifact_id: int
    source_artifact_id: int
    artifact_type: str
    artifact_uri: str
    sha256: str
    size_bytes: int


class DerivedArtifactStorageService:
    """Writes derived artifact bytes and records lineage metadata in DuckDB."""

    REL_ROOT = Path("artifacts") / "canonical"

    def __init__(self, data_root: Path, db: UnifiedStore):
        self.data_root = data_root.resolve()
        self.db = db

    def store_canonical_csv(
        self,
        *,
        program_id: str,
        version: str,
        source_artifact_id: int,
        content: bytes,
        owner_user_id: str | None,
    ) -> StoredDerivedArtifact:
        """Persist canonical CSV bytes derived from a source upload."""
        sha256 = hashlib.sha256(content).hexdigest()
        artifact_key = self._artifact_key(sha256)
        artifact_uri = self.build_artifact_uri(artifact_key, "canonical.csv")

        target = self.resolve_uri(artifact_uri)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if target.read_bytes() != content:
                raise ValueError("Existing artifact content does not match checksum")
        else:
            target.write_bytes(content)

        artifact_id = self.db.upsert_derived_artifact(
            program_id=program_id,
            version=version,
            source_artifact_id=source_artifact_id,
            artifact_type=CANONICAL_CSV_TYPE,
            artifact_uri=artifact_uri,
            sha256=sha256,
            size_bytes=len(content),
            owner_user_id=owner_user_id,
        )
        return StoredDerivedArtifact(
            artifact_id=artifact_id,
            source_artifact_id=source_artifact_id,
            artifact_type=CANONICAL_CSV_TYPE,
            artifact_uri=artifact_uri,
            sha256=sha256,
            size_bytes=len(content),
        )

    def build_artifact_uri(self, artifact_key: str, basename: str) -> str:
        self._validate_uri_components(artifact_key, basename)
        return f"{ARTIFACT_SCHEME}{CANONICAL_PREFIX}{artifact_key}/{basename}"

    def resolve_uri(self, artifact_uri: str) -> Path:
        """Resolve a portable derived artifact URI to an absolute filesystem path."""
        if not artifact_uri.startswith(ARTIFACT_SCHEME):
            raise ValueError("Artifact URI must use artifact:// scheme")
        rel = artifact_uri[len(ARTIFACT_SCHEME):]
        if UNSAFE_PATH_PATTERN.search(rel) or rel.startswith("/") or "\\" in rel:
            raise ValueError("Unsafe artifact path component")
        if not rel.startswith(CANONICAL_PREFIX):
            raise ValueError("Unsupported artifact URI namespace")
        remainder = rel[len(CANONICAL_PREFIX):]
        parts = remainder.split("/")
        if len(parts) != 2:
            raise ValueError("Invalid artifact URI path")
        artifact_key, basename = parts
        self._validate_uri_components(artifact_key, basename)
        return self.data_root / self.REL_ROOT / artifact_key / basename

    def _artifact_key(self, sha256: str) -> str:
        return f"can_{sha256[:16]}"

    def _validate_uri_components(self, artifact_key: str, basename: str) -> None:
        for part in (artifact_key, basename):
            if not part or UNSAFE_PATH_PATTERN.search(part):
                raise ValueError("Unsafe artifact path component")
            if part.startswith("/") or "\\" in part:
                raise ValueError("Unsafe artifact path component")
