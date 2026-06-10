"""Channel-map snapshot normalization and durable storage."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from server.services.etl import ChannelMapLoader
from server.services.source_artifact_storage import ARTIFACT_SCHEME, UNSAFE_PATH_PATTERN

AuthoringSource = Literal["yaml", "ui"]
SNAPSHOT_PREFIX = "snapshots/"
SNAPSHOT_BASENAME = "channel_map_snapshot.json"


@dataclass(frozen=True)
class NormalizedChannelMapSnapshot:
    """Canonical channel-map snapshot payload and checksum."""

    snapshot_json: str
    snapshot_sha256: str
    authoring_source: AuthoringSource


@dataclass(frozen=True)
class StoredChannelMapSnapshot:
    """Public result of persisting a normalized channel-map snapshot."""

    snapshot_id: int
    artifact_uri: str
    snapshot_sha256: str
    authoring_source: AuthoringSource


class ChannelMapNormalizationService:
    """Normalize YAML-uploaded and UI-authored channel maps into one snapshot shape."""

    def __init__(self, channel_loader: ChannelMapLoader | None = None) -> None:
        self.channel_loader = channel_loader or ChannelMapLoader()

    def normalize_from_yaml(self, content: bytes) -> NormalizedChannelMapSnapshot:
        channel_map = self.channel_loader.load(content)
        return self.normalize_from_plot_map(channel_map, authoring_source="yaml")

    def normalize_from_plot_map(
        self,
        channel_map: dict[str, dict[str, Any]],
        *,
        authoring_source: AuthoringSource,
    ) -> NormalizedChannelMapSnapshot:
        plots = [
            self._normalize_plot_entry(plot_key, mapping, plot_order=index)
            for index, (plot_key, mapping) in enumerate(
                sorted(channel_map.items(), key=lambda item: item[0])
            )
        ]
        snapshot_json = json.dumps({"plots": plots}, sort_keys=True, separators=(",", ":"))
        snapshot_sha256 = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()
        return NormalizedChannelMapSnapshot(
            snapshot_json=snapshot_json,
            snapshot_sha256=snapshot_sha256,
            authoring_source=authoring_source,
        )

    def _normalize_plot_entry(
        self,
        plot_key: str,
        mapping: dict[str, Any],
        *,
        plot_order: int,
    ) -> dict[str, Any]:
        x_col = int(mapping.get("x_col", 0))
        y_col = int(mapping.get("y_col", 1))
        return {
            "plot_key": plot_key,
            "x_col": x_col,
            "y_col": y_col,
            "x_channel": f"col_{x_col}",
            "y_channel": f"col_{y_col}",
            "plot_order": plot_order,
            "x_scale_factor": float(mapping.get("x_scale_factor", 1.0)),
            "y_scale_factor": float(mapping.get("y_scale_factor", 1.0)),
            "x_unit": mapping.get("x_unit"),
            "y_unit": mapping.get("y_unit"),
        }


class ChannelMapSnapshotStorageService:
    """Writes normalized channel-map snapshots and tracks the active snapshot."""

    REL_ROOT = Path("artifacts") / "snapshots"

    def __init__(self, data_root: Path, db: Any):
        self.data_root = data_root.resolve()
        self.db = db

    def store_snapshot(
        self,
        *,
        program_id: str,
        version: str,
        normalized: NormalizedChannelMapSnapshot,
        owner_user_id: str | None,
    ) -> StoredChannelMapSnapshot:
        artifact_uri = self.build_artifact_uri(normalized.snapshot_sha256)
        target = self.resolve_uri(artifact_uri)
        target.parent.mkdir(parents=True, exist_ok=True)
        content = normalized.snapshot_json.encode("utf-8")
        if target.exists():
            if target.read_bytes() != content:
                raise ValueError("Existing snapshot content does not match checksum")
        else:
            target.write_bytes(content)

        snapshot_id = self.db.upsert_channel_map_snapshot(
            program_id=program_id,
            version=version,
            snapshot_json=normalized.snapshot_json,
            snapshot_sha256=normalized.snapshot_sha256,
            authoring_source=normalized.authoring_source,
            artifact_uri=artifact_uri,
            owner_user_id=owner_user_id,
        )
        return StoredChannelMapSnapshot(
            snapshot_id=snapshot_id,
            artifact_uri=artifact_uri,
            snapshot_sha256=normalized.snapshot_sha256,
            authoring_source=normalized.authoring_source,
        )

    def set_active_snapshot(self, program_id: str, version: str, snapshot_id: int) -> None:
        self.db.set_active_channel_map_snapshot(
            program_id=program_id,
            version=version,
            snapshot_id=snapshot_id,
        )

    def build_artifact_uri(self, snapshot_sha256: str) -> str:
        artifact_key = self._artifact_key(snapshot_sha256)
        self._validate_uri_components(artifact_key, SNAPSHOT_BASENAME)
        return f"{ARTIFACT_SCHEME}{SNAPSHOT_PREFIX}{artifact_key}/{SNAPSHOT_BASENAME}"

    def resolve_uri(self, artifact_uri: str) -> Path:
        if not artifact_uri.startswith(ARTIFACT_SCHEME):
            raise ValueError("Artifact URI must use artifact:// scheme")
        rel = artifact_uri[len(ARTIFACT_SCHEME) :]
        if UNSAFE_PATH_PATTERN.search(rel) or rel.startswith("/") or "\\" in rel:
            raise ValueError("Unsafe artifact path component")
        if not rel.startswith(SNAPSHOT_PREFIX):
            raise ValueError("Unsupported artifact URI namespace")
        remainder = rel[len(SNAPSHOT_PREFIX) :]
        parts = remainder.split("/")
        if len(parts) != 2:
            raise ValueError("Invalid artifact URI path")
        artifact_key, basename = parts
        self._validate_uri_components(artifact_key, basename)
        return self.data_root / self.REL_ROOT / artifact_key / basename

    def _artifact_key(self, snapshot_sha256: str) -> str:
        return f"snap_{snapshot_sha256[:16]}"

    def _validate_uri_components(self, artifact_key: str, basename: str) -> None:
        for part in (artifact_key, basename):
            if not part or UNSAFE_PATH_PATTERN.search(part):
                raise ValueError("Unsafe artifact path component")
            if part.startswith("/") or "\\" in part:
                raise ValueError("Unsafe artifact path component")
