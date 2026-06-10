"""Transfer package export/import with artifact manifest and checksum validation."""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb

from server import __version__
from server.config import Settings
from server.exceptions import ValidationError
from server.services.derived_artifact_storage import DerivedArtifactStorageService
from server.services.durability_schedule import DurabilityScheduleStorageService
from server.services.source_artifact_storage import ARTIFACT_SCHEME, SourceArtifactStorageService
from server.services.channel_map_snapshot import ChannelMapSnapshotStorageService
from server.storage.database import LOAD_DATA_TABLES, UnifiedStore
from server.storage.schema_loader import get_schema_loader

logger = logging.getLogger(__name__)

MANIFEST_FILENAME = "manifest.json"
PACKAGE_TYPE = "analysis_dashboard_transfer_package"
PACKAGE_VERSION = "1.0"

TRANSFER_PACKAGE_TABLES: tuple[str, ...] = LOAD_DATA_TABLES

@dataclass(frozen=True)
class ManifestArtifact:
    """One artifact entry in the transfer package manifest."""

    artifact_uri: str
    package_path: str
    sha256: str
    artifact_class: str


def is_transfer_package_root(root: Path) -> bool:
    """True when ``root`` contains a transfer-package manifest."""
    manifest_path = root / MANIFEST_FILENAME
    if not manifest_path.is_file():
        return False
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(data, dict) and data.get("package_type") == PACKAGE_TYPE


def artifact_uri_to_package_path(artifact_uri: str) -> str:
    """Map a portable artifact URI to a zip-relative package path."""
    if not artifact_uri.startswith(ARTIFACT_SCHEME):
        raise ValueError(f"Unsupported artifact URI: {artifact_uri!r}")
    rel = artifact_uri[len(ARTIFACT_SCHEME) :]
    return f"artifacts/{rel}"


def package_path_to_artifact_uri(package_path: str) -> str:
    """Map a zip-relative package path back to a portable artifact URI."""
    normalized = package_path.replace("\\", "/").lstrip("/")
    if not normalized.startswith("artifacts/"):
        raise ValueError(f"Invalid package artifact path: {package_path!r}")
    rel = normalized[len("artifacts/") :]
    return f"{ARTIFACT_SCHEME}{rel}"


class TransferPackageService:
    """Export/import lean source-of-truth transfer packages."""

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings
        self._source_storage = SourceArtifactStorageService(settings.data_root, db)
        self._derived_storage = DerivedArtifactStorageService(settings.data_root, db)
        self._snapshot_storage = ChannelMapSnapshotStorageService(settings.data_root, db)
        self._schedule_storage = DurabilityScheduleStorageService(settings.data_root, db)

    def export_package(self, export_dir: Path) -> None:
        """Export lineage tables, artifact bytes, and manifest metadata."""
        export_dir.mkdir(parents=True, exist_ok=True)
        self.db.export_to_parquet(export_dir, tables=TRANSFER_PACKAGE_TABLES)
        artifacts = self._collect_manifest_artifacts()
        for entry in artifacts:
            source = self._resolve_artifact_path(entry.artifact_uri)
            target = export_dir / entry.package_path
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                shutil.copy2(source, target)
        manifest = self._build_manifest(artifacts)
        (export_dir / MANIFEST_FILENAME).write_text(
            json.dumps(manifest, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        logger.info(
            "Transfer package exported to %s (%s artifacts)",
            export_dir,
            len(artifacts),
        )

    def validate_package(self, package_root: Path) -> dict[str, Any]:
        """Validate manifest, checksums, and artifact resolvability without mutating data."""
        manifest = self._load_manifest(package_root)
        manifest_by_path = {
            item["package_path"]: item for item in manifest.get("artifacts", [])
        }
        manifest_by_uri = {
            item["artifact_uri"]: item for item in manifest.get("artifacts", [])
        }

        for entry in manifest.get("artifacts", []):
            package_path = entry.get("package_path")
            sha256 = entry.get("sha256")
            artifact_class = entry.get("artifact_class")
            if not package_path or not sha256 or not artifact_class:
                raise ValidationError(
                    "Invalid transfer package manifest: artifact entry is incomplete",
                    details={"entry": entry},
                )
            file_path = package_root / package_path
            if not file_path.is_file():
                raise ValidationError(
                    f"Transfer package missing artifact file: {package_path}",
                    details={"package_path": package_path},
                )
            actual = hashlib.sha256(file_path.read_bytes()).hexdigest()
            if actual != sha256:
                raise ValidationError(
                    f"Transfer package checksum mismatch for {artifact_class} artifact "
                    f"{entry.get('artifact_uri', package_path)}",
                    details={
                        "package_path": package_path,
                        "artifact_class": artifact_class,
                        "expected_sha256": sha256,
                        "actual_sha256": actual,
                    },
                )

        referenced = self._collect_referenced_artifact_uris(package_root)
        missing = sorted(uri for uri in referenced if uri not in manifest_by_uri)
        if missing:
            raise ValidationError(
                "Transfer package references missing artifacts: " + ", ".join(missing),
                details={"missing_artifact_uris": missing},
            )

        for uri in referenced:
            entry = manifest_by_uri[uri]
            package_path = entry["package_path"]
            if not (package_root / package_path).is_file():
                raise ValidationError(
                    f"Transfer package missing referenced artifact file: {package_path}",
                    details={"artifact_uri": uri, "package_path": package_path},
                )

        for package_path, entry in manifest_by_path.items():
            if package_path not in {manifest_by_uri[uri]["package_path"] for uri in referenced}:
                continue
            file_path = package_root / package_path
            if not file_path.is_file():
                raise ValidationError(
                    f"Transfer package missing artifact: {package_path}",
                    details={"package_path": package_path},
                )

        dim_event_pq = package_root / "dim_event.parquet"
        event_count = 0
        if dim_event_pq.is_file():
            conn = duckdb.connect(":memory:")
            try:
                event_count = int(
                    conn.execute(
                        """
                        SELECT COUNT(*) FROM read_parquet(?)
                        WHERE COALESCE(try_cast(is_deleted AS BOOLEAN), false) = false
                        """,
                        [str(dim_event_pq)],
                    ).fetchone()[0]
                )
            finally:
                conn.close()

        return {
            "valid": True,
            "package_type": PACKAGE_TYPE,
            "event_count": event_count,
            "artifact_count": len(manifest.get("artifacts", [])),
            "tables": sorted(p.stem for p in package_root.glob("*.parquet")),
        }

    def import_package(self, package_root: Path) -> dict[str, Any]:
        """Validate and import a transfer package into the target database and artifact store."""
        self.validate_package(package_root)
        result = self.db.import_from_parquet(
            package_root,
            tables=TRANSFER_PACKAGE_TABLES,
        )
        self.install_artifacts(package_root)
        return result

    def install_artifacts(self, package_root: Path) -> None:
        """Copy validated package artifact files into the runtime artifact store."""
        self._install_artifacts(package_root)

    def _collect_manifest_artifacts(self) -> list[ManifestArtifact]:
        entries: dict[str, ManifestArtifact] = {}

        def add(uri: str, sha256: str, artifact_class: str) -> None:
            package_path = artifact_uri_to_package_path(uri)
            entries[package_path] = ManifestArtifact(
                artifact_uri=uri,
                package_path=package_path,
                sha256=sha256,
                artifact_class=artifact_class,
            )

        for row in self.db.list_source_artifacts():
            add(row["artifact_uri"], row["sha256"], "source")
        for row in self.db.list_derived_artifacts():
            add(row["artifact_uri"], row["sha256"], "canonical")
        for row in self.db.list_channel_map_snapshots():
            add(row["artifact_uri"], row["snapshot_sha256"], "snapshot")
        for row in self.db.list_durability_schedule_artifacts():
            add(row["artifact_uri"], row["schedule_sha256"], "schedule")

        return sorted(entries.values(), key=lambda item: item.package_path)

    def _build_manifest(self, artifacts: list[ManifestArtifact]) -> dict[str, Any]:
        schema_loader = get_schema_loader()
        return {
            "package_type": PACKAGE_TYPE,
            "package_version": PACKAGE_VERSION,
            "created_at": datetime.now(UTC).isoformat(),
            "app_version": __version__,
            "schema_version": schema_loader.version,
            "tables": list(TRANSFER_PACKAGE_TABLES),
            "artifacts": [
                {
                    "artifact_uri": item.artifact_uri,
                    "package_path": item.package_path,
                    "sha256": item.sha256,
                    "artifact_class": item.artifact_class,
                }
                for item in artifacts
            ],
        }

    def _load_manifest(self, package_root: Path) -> dict[str, Any]:
        manifest_path = package_root / MANIFEST_FILENAME
        if not manifest_path.is_file():
            raise ValidationError(
                "Invalid transfer package: missing manifest.json",
                details={},
            )
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValidationError(
                "Invalid transfer package: manifest.json is not valid JSON",
                details={},
            ) from exc
        if not isinstance(manifest, dict):
            raise ValidationError(
                "Invalid transfer package: manifest.json must be an object",
                details={},
            )
        if manifest.get("package_type") != PACKAGE_TYPE:
            raise ValidationError(
                f"Unsupported transfer package type: {manifest.get('package_type')!r}",
                details={"package_type": manifest.get("package_type")},
            )
        return manifest

    def _resolve_artifact_path(self, artifact_uri: str) -> Path:
        if artifact_uri.startswith(f"{ARTIFACT_SCHEME}sources/"):
            return self._source_storage.resolve_uri(artifact_uri)
        if artifact_uri.startswith(f"{ARTIFACT_SCHEME}canonical/"):
            return self._derived_storage.resolve_uri(artifact_uri)
        if artifact_uri.startswith(f"{ARTIFACT_SCHEME}snapshots/"):
            return self._snapshot_storage.resolve_uri(artifact_uri)
        if artifact_uri.startswith(f"{ARTIFACT_SCHEME}schedules/"):
            return self._schedule_storage.resolve_uri(artifact_uri)
        raise ValidationError(
            f"Unsupported artifact URI namespace: {artifact_uri}",
            details={"artifact_uri": artifact_uri},
        )

    def _collect_referenced_artifact_uris(self, package_root: Path) -> set[str]:
        referenced: set[str] = set()
        uri_tables = (
            ("source_artifacts", "artifact_uri", "sha256"),
            ("derived_artifacts", "artifact_uri", "sha256"),
            ("channel_map_snapshots", "artifact_uri", "snapshot_sha256"),
            ("durability_schedule_artifacts", "artifact_uri", "schedule_sha256"),
        )
        conn = duckdb.connect(":memory:")
        try:
            for table, uri_column, checksum_column in uri_tables:
                parquet_path = package_root / f"{table}.parquet"
                if not parquet_path.is_file():
                    continue
                rows = conn.execute(
                    f"SELECT {uri_column}, {checksum_column} FROM read_parquet(?)",
                    [str(parquet_path)],
                ).fetchall()
                for uri, _checksum in rows:
                    if uri:
                        referenced.add(str(uri))
        finally:
            conn.close()
        return referenced

    def _install_artifacts(self, package_root: Path) -> None:
        manifest = self._load_manifest(package_root)
        for entry in manifest.get("artifacts", []):
            package_path = entry["package_path"]
            artifact_uri = entry["artifact_uri"]
            source = package_root / package_path
            target = self._resolve_artifact_path(artifact_uri)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                if target.read_bytes() != source.read_bytes():
                    raise ValidationError(
                        f"Existing artifact content does not match package for {artifact_uri}",
                        details={"artifact_uri": artifact_uri},
                    )
            else:
                shutil.copy2(source, target)
