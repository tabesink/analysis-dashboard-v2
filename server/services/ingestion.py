"""Data ingestion service with atomic transaction semantics."""

import csv
import hashlib
import json
import logging
import os
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from server.config import Settings
from server import __version__
from server.services.channel_map_snapshot import (
    ChannelMapNormalizationService,
    ChannelMapSnapshotStorageService,
    StoredChannelMapSnapshot,
)
from server.services.channel_reprocess_progress import (
    generating_cross_plot_message,
    validating_artifact_message,
)
from server.services.derived_artifact_storage import DerivedArtifactStorageService
from server.services.derived_data_lineage import DerivedDataLineageService
from server.services.event_header_provider import EventHeaderProvider
from server.services.event_preview import EventPreviewService
from server.services.per_event_channel_resolver import (
    PlotChannelMapping,
    resolve_plot_channels_from_headers,
)
from server.services.downsampling import LTTBDownsampler
from server.services.source_artifact_storage import (
    SourceArtifactStorageService,
    StoredSourceArtifact,
)
from server.services.etl import (
    ChannelMapLoader,
    CSVParser,
    DataTransformer,
    DataValidator,
    RSPConverter,
    ValidationSeverity,
)
from server.storage.database import UnifiedStore
from server.upload.task_kinds import TASK_KIND_CHANNEL_REPROCESS
from server.utils.cache import CacheKeys, SimpleCache
from server.utils.weight_ranges import apply_derived_weight_ranges

logger = logging.getLogger(__name__)
UPLOAD_TASK_TTL_MINUTES = 30
FIXED_CHANNEL_MAP_PLOTS = [
    "bj_xy_force_plot",
    "bj_xz_force_plot",
    "shock_xy_force_plot",
    "shock_xz_force_plot",
    "bushing_f_xy_force_plot",
    "bushing_f_xz_force_plot",
    "bushing_r_xy_force_plot",
    "bushing_r_xz_force_plot",
]

@dataclass
class FileResult:
    """Result for a single file ingestion."""

    filename: str
    success: bool
    event_id: str | None = None
    error: str | None = None
    row_count: int = 0
    validation_issues: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class IngestionResult:
    """Result of the ingestion process."""

    success: bool
    files: list[FileResult] = field(default_factory=list)
    event_ids: list[str] = field(default_factory=list)
    error: str | None = None
    total_rows: int = 0
    pending_channel_map: bool = False


EventCommittedCallback = Callable[[str, int, int], None]
UploadTaskUpdateCallback = Callable[..., None]
ChannelReprocessProgressCallback = Callable[..., None]


class IngestionService:
    """
    Orchestrates file ingestion with parse/validate preflight and per-event commits.
    """

    def __init__(self, db: UnifiedStore, cache: SimpleCache, settings: Settings):
        self.db = db
        self.cache = cache
        self.settings = settings
        self.parser = CSVParser()
        self.channel_loader = ChannelMapLoader()
        self.rsp_converter = RSPConverter()
        self.transformer = DataTransformer()
        self.validator = DataValidator(settings.validation)
        self.downsampler = LTTBDownsampler(
            target_points=settings.lttb_resolution,
            inflection_eps=settings.lttb_inflection_eps,
            point_budget=settings.lttb_point_budget,
        )
        self.artifact_root = settings.data_root / "artifacts" / "channel-map"
        self.source_artifact_storage = SourceArtifactStorageService(
            settings.data_root,
            db,
        )
        self.derived_artifact_storage = DerivedArtifactStorageService(
            settings.data_root,
            db,
        )
        self.channel_map_normalizer = ChannelMapNormalizationService(self.channel_loader)
        self.channel_map_snapshot_storage = ChannelMapSnapshotStorageService(
            settings.data_root,
            db,
        )
        self.event_preview_service = EventPreviewService(db=db)
        self.derived_data_lineage = DerivedDataLineageService(db=db)

    def _with_derived_weight_ranges(self, metadata: dict[str, Any]) -> dict[str, Any]:
        """Keep raw inputs and add derived range fields for filtering."""
        return apply_derived_weight_ranges(metadata)

    def _artifact_path_for(self, program_id: str, version: str, file_hash: str, filename: str) -> Path:
        """Build a stable managed artifact path for retained converted CSV bytes."""
        safe_program = "".join(c if c.isalnum() or c in "._-" else "_" for c in program_id)
        safe_version = "".join(c if c.isalnum() or c in "._-" else "_" for c in version)
        stem = Path(filename).stem
        safe_stem = "".join(c if c.isalnum() or c in "._-" else "_" for c in stem)[:80] or "upload"
        return self.artifact_root / safe_program / safe_version / f"{file_hash}_{safe_stem}.csv"

    def _relative_artifact_path(self, path: Path) -> str:
        try:
            return str(path.relative_to(self.settings.data_root))
        except ValueError:
            return str(path)

    def _absolute_artifact_path(self, artifact_path: str) -> Path:
        path = Path(artifact_path)
        if path.is_absolute():
            return path
        return self.settings.data_root / path

    def _preview_for_content(self, content: bytes) -> dict[str, Any]:
        text = content.decode("utf-8", errors="replace")
        return {"lines": text.splitlines()[:20]}

    def _channel_map_with_dataframe_headers(
        self,
        channel_map: dict[str, dict[str, Any]],
        dataframe: Any,
    ) -> dict[str, dict[str, Any]]:
        """Resolve channel-map names from parsed CSV/RSP headers."""
        columns = [str(column) for column in dataframe.columns]
        units = dataframe.attrs.get("units")
        return self._channel_map_with_headers(
            channel_map,
            columns,
            units if isinstance(units, list) else None,
        )

    def _channel_map_with_preview_headers(
        self,
        channel_map: dict[str, dict[str, Any]],
        artifact: dict[str, Any],
    ) -> dict[str, dict[str, Any]]:
        raw_preview = artifact.get("preview_json")
        if not raw_preview:
            return channel_map
        try:
            preview = json.loads(raw_preview) if isinstance(raw_preview, str) else raw_preview
        except (TypeError, json.JSONDecodeError):
            return channel_map
        lines = preview.get("lines", []) if isinstance(preview, dict) else []
        headers = self._metadata_row_from_preview(lines, "#TITLES")
        units = self._metadata_row_from_preview(lines, "#UNITS")
        if not headers:
            return channel_map
        return self._channel_map_with_headers(channel_map, headers, units)

    def _metadata_row_from_preview(self, lines: Any, marker: str) -> list[str]:
        if not isinstance(lines, list):
            return []
        for index, line in enumerate(lines[:-1]):
            if str(line).strip() == marker:
                return next(csv.reader([str(lines[index + 1])]))
        return []

    def _channel_map_with_headers(
        self,
        channel_map: dict[str, dict[str, Any]],
        headers: list[str],
        units: list[str] | None,
    ) -> dict[str, dict[str, Any]]:
        resolved: dict[str, dict[str, Any]] = {}
        for plot_key, mapping in channel_map.items():
            next_mapping = dict(mapping)
            x_col = int(next_mapping.get("x_col", 0))
            y_col = int(next_mapping.get("y_col", 1))
            if x_col < len(headers):
                next_mapping["x_channel"] = headers[x_col]
            if y_col < len(headers):
                next_mapping["y_channel"] = headers[y_col]
            if units is not None:
                if x_col < len(units):
                    next_mapping["x_unit"] = units[x_col] or None
                if y_col < len(units):
                    next_mapping["y_unit"] = units[y_col] or None
            resolved[plot_key] = next_mapping
        return resolved

    def _store_source_artifacts_for_batch(
        self,
        *,
        normalized_files: list[tuple[str, bytes, bytes]],
        program_id: str,
        version: str,
        uploaded_by_user_id: str | None,
    ) -> dict[str, StoredSourceArtifact]:
        """Retain immutable original upload bytes for each file in the batch."""
        stored: dict[str, StoredSourceArtifact] = {}
        for filename, _, original_content in normalized_files:
            stored[filename] = self.source_artifact_storage.store_original_upload(
                program_id=program_id,
                version=version,
                filename=filename,
                content=original_content,
                owner_user_id=uploaded_by_user_id,
            )
        return stored

    def _register_canonical_artifact_and_run(
        self,
        *,
        program_id: str,
        version: str,
        filename: str,
        parse_content: bytes,
        parsed: Any,
        source_artifact: StoredSourceArtifact,
        uploaded_by_user_id: str | None,
        status: str,
        warning_count: int = 0,
    ) -> int:
        """Store canonical CSV derived artifact and create an ingestion-run audit record."""
        derived = self.derived_artifact_storage.store_canonical_csv(
            program_id=program_id,
            version=version,
            source_artifact_id=source_artifact.artifact_id,
            content=parse_content,
            owner_user_id=uploaded_by_user_id,
        )
        conversion_kind = (
            "rsp_converter" if filename.lower().endswith(".rsp") else "identity"
        )
        return self.db.create_ingestion_run(
            program_id=program_id,
            version=version,
            source_artifact_id=source_artifact.artifact_id,
            derived_artifact_id=derived.artifact_id,
            source_filename=filename,
            parser_name="CSVParser",
            conversion_kind=conversion_kind,
            status=status,
            row_count=int(getattr(parsed, "row_count", 0) or 0),
            column_count=len(getattr(parsed, "dataframe").columns)
            if hasattr(parsed, "dataframe")
            else 0,
            warning_count=warning_count,
            metadata_json=json.dumps(
                {
                    "app_version": __version__,
                    "parsed_filename": parsed.filename,
                    "source_artifact_uri": source_artifact.artifact_uri,
                    "derived_artifact_uri": derived.artifact_uri,
                }
            ),
            owner_user_id=uploaded_by_user_id,
        )

    def _persist_active_channel_map_snapshot(
        self,
        *,
        program_id: str,
        version: str,
        channel_map: dict[str, dict[str, Any]],
        authoring_source: str,
        owner_user_id: str | None,
    ) -> StoredChannelMapSnapshot:
        """Normalize, persist, and activate a channel-map snapshot for a program/version."""
        normalized = self.channel_map_normalizer.normalize_from_plot_map(
            channel_map,
            authoring_source=authoring_source,  # type: ignore[arg-type]
        )
        stored = self.channel_map_snapshot_storage.store_snapshot(
            program_id=program_id,
            version=version,
            normalized=normalized,
            owner_user_id=owner_user_id,
        )
        self.channel_map_snapshot_storage.set_active_snapshot(
            program_id,
            version,
            stored.snapshot_id,
        )
        self.derived_data_lineage.mark_stale_pending_on_snapshot_change(
            program_id=program_id,
            version=version,
            active_snapshot_id=stored.snapshot_id,
        )
        return stored

    def _ingestion_run_id_for_source_file(
        self,
        program_id: str,
        version: str,
        source_filename: str,
    ) -> int | None:
        for run in self.db.list_ingestion_runs(program_id, version):
            if run.get("source_filename") == source_filename:
                return int(run["ingestion_run_id"])
        return None

    def _preview_warnings_from_validation(self, validation: Any) -> list[dict[str, Any]]:
        return [
            {
                "severity": issue.severity.value,
                "code": issue.code,
                "message": issue.message,
                "details": issue.details,
            }
            for issue in validation.issues
            if issue.severity == ValidationSeverity.WARNING
        ]

    def _store_event_preview_for_commit(
        self,
        *,
        event_id: str,
        canonical_csv: bytes,
        source_filename: str,
        ingestion_run_id: int | None,
        warnings: list[dict[str, Any]] | None = None,
        conn: Any | None = None,
    ) -> None:
        run = self.db.get_ingestion_run(ingestion_run_id) if ingestion_run_id is not None else None
        run_metadata: dict[str, Any] = {}
        if run and run.get("metadata_json"):
            try:
                run_metadata = json.loads(run["metadata_json"])
            except (TypeError, json.JSONDecodeError):
                run_metadata = {}
        preview = self.event_preview_service.derive_from_canonical_csv(
            canonical_csv=canonical_csv,
            source_filename=source_filename,
            conversion_kind=str(run.get("conversion_kind") if run else "identity"),
            warnings=warnings,
            source_artifact_uri=run_metadata.get("source_artifact_uri"),
            canonical_artifact_uri=run_metadata.get("derived_artifact_uri"),
        )
        self.event_preview_service.store_for_event(
            event_id=event_id,
            preview=preview,
            conn=conn,
        )

    def _store_artifact(
        self,
        *,
        program_id: str,
        version: str,
        filename: str,
        parse_content: bytes,
        validation_content: bytes,
        parsed: Any,
        status: str,
        uploaded_by_user_id: str | None,
        metadata: dict[str, Any],
        custom_field_values: dict[str, str],
        event_id: str | None = None,
        error: str | None = None,
    ) -> int:
        """Persist converted CSV bytes and DB metadata for later channel-map processing."""
        file_hash = hashlib.sha256(validation_content).hexdigest()[:16]
        artifact_path = self._artifact_path_for(program_id, version, file_hash, filename)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_bytes(parse_content)
        artifact_kind = "converted_csv" if filename.lower().endswith(".rsp") else "csv"
        return self.db.upsert_ingestion_artifact(
            program_id=program_id,
            version=version,
            source_file=filename,
            artifact_path=self._relative_artifact_path(artifact_path),
            artifact_kind=artifact_kind,
            file_hash=file_hash,
            row_count=int(getattr(parsed, "row_count", 0) or 0),
            column_count=len(getattr(parsed, "dataframe").columns) if hasattr(parsed, "dataframe") else 0,
            preview_json=json.dumps(self._preview_for_content(parse_content)),
            metadata_json=json.dumps(metadata),
            custom_fields_json=json.dumps(custom_field_values),
            status=status,
            owner_user_id=uploaded_by_user_id,
            event_id=event_id,
            error=error,
        )

    def start_upload_task(
        self,
        files: list[tuple[str, bytes]],
        program_id: str,
        version: str,
        channel_map_content: bytes | None,
        status_value: str,
        is_admin: bool,
        uploaded_by_user_id: str,
        metadata: dict[str, Any],
        custom_field_values: dict[str, str],
    ) -> str:
        """Create task row and run ingestion in background thread."""
        self.db.delete_expired_upload_tasks()
        task_id = uuid.uuid4().hex
        total_events = sum(
            1
            for filename, _ in files
            if filename.lower().endswith((".csv", ".rsp"))
        )
        self.db.create_upload_task(
            task_id=task_id,
            created_by_user_id=uploaded_by_user_id,
            total_events=total_events,
            ttl_minutes=UPLOAD_TASK_TTL_MINUTES,
        )

        def _run() -> None:
            self.db.update_upload_task(task_id, status="running", phase="upload_received")
            try:
                result = self.ingest(
                    files=files,
                    program_id=program_id,
                    version=version,
                    channel_map_content=channel_map_content,
                    status_value=status_value,
                    is_admin=is_admin,
                    uploaded_by_user_id=uploaded_by_user_id,
                    metadata=metadata,
                    custom_field_values=custom_field_values,
                    on_task_update=lambda **fields: self.db.update_upload_task(
                        task_id,
                        **fields,
                    ),
                    on_event_committed=lambda event_id, completed, total: self.db.update_upload_task(
                        task_id,
                        phase="writing",
                        completed_events=completed,
                        total_events=total,
                        current_event=event_id,
                        progress_message=f"Processed {completed}/{total}: {event_id}",
                    ),
                )
                self.db.update_upload_task(
                    task_id,
                    status="completed" if result.success else "failed",
                    phase="completed" if result.success else "failed",
                    completed_events=len(result.event_ids),
                    total_events=max(total_events, len(result.files)),
                    current_event=None,
                    error=result.error,
                    result={
                        "success": result.success,
                        "files": [f.__dict__ for f in result.files],
                        "event_ids": result.event_ids,
                        "error": result.error,
                        "total_rows": result.total_rows,
                        "pending_channel_map": result.pending_channel_map,
                    },
                )
            except Exception as exc:  # pragma: no cover
                logger.exception("Upload task failed unexpectedly: %s", task_id)
                self.db.update_upload_task(
                    task_id,
                    status="failed",
                    phase="failed",
                    current_event=None,
                    error=str(exc),
                )

        threading.Thread(target=_run, daemon=True).start()
        return task_id

    def ingest(
        self,
        files: list[tuple[str, bytes]],  # (filename, content)
        program_id: str,
        version: str,
        channel_map_content: bytes | None,
        status_value: str = "Pending",
        is_admin: bool = False,
        uploaded_by_user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        custom_field_values: dict[str, str] | None = None,
        on_task_update: UploadTaskUpdateCallback | None = None,
        on_event_committed: EventCommittedCallback | None = None,
    ) -> IngestionResult:
        """
        Ingest files with per-event commit semantics.

        Args:
            files: List of (filename, content) tuples
            program_id: Program identifier
            version: Version identifier
            channel_map_content: Raw bytes of channel_map.yaml
            status_value: Status value (default Pending if not specified)
            is_admin: Whether requester has admin privileges
            metadata: Additional metadata fields for events

        Returns:
            IngestionResult with success status and details
        """
        # Phase 1: Parse and validate (no side effects)
        parsed_files = []
        channel_map = None
        effective_status = status_value if is_admin else "Pending"
        metadata = self._with_derived_weight_ranges(metadata or {})
        custom_field_values = custom_field_values or {}

        try:
            normalized_files = self._normalize_files(files, on_task_update)
            if not normalized_files:
                return IngestionResult(success=False, error="No valid CSV or RSP files found")

            stored_sources = self._store_source_artifacts_for_batch(
                normalized_files=normalized_files,
                program_id=program_id,
                version=version,
                uploaded_by_user_id=uploaded_by_user_id,
            )

            if not channel_map_content:
                file_results: list[FileResult] = []
                created_events: list[str] = []
                total_rows = 0
                existing_hashes = self.db.get_file_hashes(program_id, version)
                existing_event_ids = self._get_existing_event_ids()
                self.db.upsert_program(program_id, name=program_id)

                total_files = len(normalized_files)
                for index, (filename, parse_content, validation_content) in enumerate(
                    normalized_files,
                    start=1,
                ):
                    if on_task_update:
                        on_task_update(
                            phase="validating",
                            progress_message=f"Validating {index}/{total_files}: {filename}",
                            completed_events=index - 1,
                            total_events=total_files,
                            current_event=filename,
                        )
                    parsed = self.parser.parse(parse_content, filename)
                    if not parsed.is_valid:
                        return IngestionResult(
                            success=False,
                            error=f"Parse failed for {filename}: {parsed.error}",
                        )

                    validation = self.validator.validate(
                        df=parsed.dataframe,
                        channel_map={},
                        file_content=validation_content,
                        existing_hashes=existing_hashes,
                    )
                    if not validation.is_valid:
                        error_msg = (
                            validation.errors[0].message
                            if validation.errors
                            else "Validation failed"
                        )
                        return IngestionResult(
                            success=False,
                            error=f"Validation failed for {filename}: {error_msg}",
                        )

                    warning_count = sum(
                        1
                        for issue in validation.issues
                        if issue.severity == ValidationSeverity.WARNING
                    )
                    ingestion_run_id = self._register_canonical_artifact_and_run(
                        program_id=program_id,
                        version=version,
                        filename=filename,
                        parse_content=parse_content,
                        parsed=parsed,
                        source_artifact=stored_sources[filename],
                        uploaded_by_user_id=uploaded_by_user_id,
                        status="pending_channel_map",
                        warning_count=warning_count,
                    )

                    event_id = self._generate_event_id(parsed.filename, existing_event_ids)
                    try:
                        with self.db.write_connection() as conn:
                            existing_event_ids.add(event_id)
                            existing_hashes.add(validation.file_hash)

                            event_metadata = {
                                "status": effective_status,
                                "source_file": parsed.filename,
                                "file_hash": validation.file_hash,
                                "row_count": len(parsed.dataframe),
                                "uploaded_by_user_id": uploaded_by_user_id,
                                "last_updated_by_user_id": uploaded_by_user_id,
                                **metadata,
                            }
                            columns = ["event_id", "program_id", "version"] + list(
                                event_metadata.keys()
                            )
                            placeholders = ", ".join(["?"] * len(columns))
                            values = [event_id, program_id, version] + list(
                                event_metadata.values()
                            )
                            conn.execute(
                                f"INSERT INTO dim_event ({', '.join(columns)}) "
                                f"VALUES ({placeholders})",
                                values,
                            )
                            self.db.upsert_event_custom_field_values(
                                event_id=event_id,
                                custom_values=custom_field_values,
                                conn=conn,
                            )
                            self.db.upsert_event_ingestion_link(
                                event_id=event_id,
                                ingestion_run_id=ingestion_run_id,
                                channel_map_snapshot_id=None,
                                conn=conn,
                            )
                            self._store_event_preview_for_commit(
                                event_id=event_id,
                                canonical_csv=parse_content,
                                source_filename=filename,
                                ingestion_run_id=ingestion_run_id,
                                warnings=self._preview_warnings_from_validation(validation),
                                conn=conn,
                            )
                            has_measurements = self._insert_raw_measurements_for_event(
                                conn=conn,
                                event_id=event_id,
                                dataframe=parsed.dataframe,
                            )
                            self.derived_data_lineage.record_commit(
                                event_id=event_id,
                                ingestion_run_id=ingestion_run_id,
                                channel_map_snapshot_id=None,
                                has_measurements=has_measurements,
                                has_lttb=False,
                                conn=conn,
                            )
                    except Exception as exc:
                        logger.error("Failed ingesting %s without channel map: %s", filename, exc)
                        if created_events:
                            self._invalidate_cache()
                        return IngestionResult(
                            success=False,
                            files=file_results,
                            event_ids=created_events,
                            total_rows=total_rows,
                            error=f"Ingestion failed for {filename}: {exc}",
                        )

                    artifact_id = self._store_artifact(
                        program_id=program_id,
                        version=version,
                        filename=filename,
                        parse_content=parse_content,
                        validation_content=validation_content,
                        parsed=parsed,
                        status="pending",
                        uploaded_by_user_id=uploaded_by_user_id,
                        metadata={**metadata, "status": effective_status},
                        custom_field_values=custom_field_values,
                        event_id=event_id,
                    )
                    created_events.append(event_id)
                    total_rows += parsed.row_count
                    file_results.append(
                        FileResult(
                            filename=filename,
                            success=True,
                            event_id=event_id,
                            row_count=parsed.row_count,
                            validation_issues=[
                                {
                                    "severity": "info",
                                    "code": "PENDING_CHANNEL_MAP",
                                    "message": (
                                        "Event created; channel map required before plotting"
                                    ),
                                    "details": {"artifact_id": artifact_id},
                                }
                            ],
                        )
                    )
                    if on_event_committed:
                        on_event_committed(
                            event_id,
                            len(created_events),
                            len(normalized_files),
                        )

                self._invalidate_cache()
                return IngestionResult(
                    success=True,
                    files=file_results,
                    event_ids=created_events,
                    total_rows=total_rows,
                    pending_channel_map=True,
                )

            channel_map = self.channel_loader.load(channel_map_content)

            # Get existing file hashes for duplicate detection
            existing_hashes = self.db.get_file_hashes(program_id, version)

            total_files = len(normalized_files)
            for index, (filename, parse_content, validation_content) in enumerate(
                normalized_files,
                start=1,
            ):
                if on_task_update:
                    on_task_update(
                        phase="validating",
                        progress_message=f"Validating {index}/{total_files}: {filename}",
                        completed_events=index - 1,
                        total_events=total_files,
                        current_event=filename,
                    )
                # Parse file
                parsed = self.parser.parse(parse_content, filename)
                if not parsed.is_valid:
                    return IngestionResult(
                        success=False,
                        error=f"Parse failed for {filename}: {parsed.error}",
                    )

                # Validate data
                validation = self.validator.validate(
                    df=parsed.dataframe,
                    channel_map=channel_map,
                    file_content=validation_content,
                    existing_hashes=existing_hashes,
                )

                if not validation.is_valid:
                    error_msg = validation.errors[0].message if validation.errors else "Validation failed"
                    return IngestionResult(
                        success=False,
                        error=f"Validation failed for {filename}: {error_msg}",
                    )

                warning_count = sum(
                    1
                    for issue in validation.issues
                    if issue.severity == ValidationSeverity.WARNING
                )
                ingestion_run_id = self._register_canonical_artifact_and_run(
                    program_id=program_id,
                    version=version,
                    filename=filename,
                    parse_content=parse_content,
                    parsed=parsed,
                    source_artifact=stored_sources[filename],
                    uploaded_by_user_id=uploaded_by_user_id,
                    status="completed",
                    warning_count=warning_count,
                )

                # Store validation results with parsed file
                parsed_files.append(
                    (
                        parsed,
                        validation,
                        parse_content,
                        validation_content,
                        filename,
                        ingestion_run_id,
                    )
                )

        except Exception as e:
            logger.error(f"Pre-flight validation failed: {e}")
            return IngestionResult(success=False, error=f"Validation error: {str(e)}")

        if not parsed_files:
            return IngestionResult(success=False, error="No valid CSV or RSP files found")
        channel_map = self._channel_map_with_dataframe_headers(
            channel_map,
            parsed_files[0][0].dataframe,
        )
        channel_map_snapshot = self._persist_active_channel_map_snapshot(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source="yaml",
            owner_user_id=uploaded_by_user_id,
        )

        # Phase 2: Write data with per-event commits
        created_events: list[str] = []
        file_results: list[FileResult] = []
        total_rows = 0

        # Get existing event IDs to ensure uniqueness
        existing_event_ids = self._get_existing_event_ids()

        try:
            # Ensure program exists
            self.db.upsert_program(program_id, name=program_id)

            with self.db.write_connection() as conn:
                # Upsert channel map once per program/version.
                for i, (plot_key, mapping) in enumerate(channel_map.items()):
                    conn.execute(
                        """
                        INSERT INTO dim_channel_map
                            (program_id, version, plot_key, x_col, y_col, x_channel, y_channel,
                             plot_order, x_scale_factor, y_scale_factor, x_unit, y_unit)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (program_id, version, plot_key) DO UPDATE SET
                            x_col = EXCLUDED.x_col,
                            y_col = EXCLUDED.y_col,
                            x_channel = EXCLUDED.x_channel,
                            y_channel = EXCLUDED.y_channel,
                            plot_order = EXCLUDED.plot_order,
                            x_scale_factor = EXCLUDED.x_scale_factor,
                            y_scale_factor = EXCLUDED.y_scale_factor,
                            x_unit = EXCLUDED.x_unit,
                            y_unit = EXCLUDED.y_unit
                        """,
                        [
                            program_id,
                            version,
                            plot_key,
                            mapping.get("x_col", 0),
                            mapping.get("y_col", 1),
                            mapping.get("x_channel", f"col_{mapping.get('x_col', 0)}"),
                            mapping.get("y_channel", f"col_{mapping.get('y_col', 1)}"),
                            mapping.get("plot_order", i),
                            mapping.get("x_scale_factor", 1.0),
                            mapping.get("y_scale_factor", 1.0),
                            mapping.get("x_unit"),
                            mapping.get("y_unit"),
                        ],
                    )

            for parsed, validation, parse_content, validation_content, original_filename, ingestion_run_id in parsed_files:
                event_id = self._generate_event_id(parsed.filename, existing_event_ids)
                try:
                    with self.db.write_connection() as conn:
                        existing_event_ids.add(event_id)

                        event_metadata = {
                            "status": effective_status,
                            "source_file": parsed.filename,
                            "file_hash": validation.file_hash,
                            "row_count": len(parsed.dataframe),
                            "uploaded_by_user_id": uploaded_by_user_id,
                            "last_updated_by_user_id": uploaded_by_user_id,
                            **metadata,
                        }
                        columns = ["event_id", "program_id", "version"] + list(
                            event_metadata.keys()
                        )
                        placeholders = ", ".join(["?"] * len(columns))
                        values = [event_id, program_id, version] + list(
                            event_metadata.values()
                        )

                        conn.execute(
                            f"INSERT INTO dim_event ({', '.join(columns)}) "
                            f"VALUES ({placeholders})",
                            values,
                        )
                        self.db.upsert_event_custom_field_values(
                            event_id=event_id,
                            custom_values=custom_field_values,
                            conn=conn,
                        )
                        self.db.upsert_event_ingestion_link(
                            event_id=event_id,
                            ingestion_run_id=ingestion_run_id,
                            channel_map_snapshot_id=channel_map_snapshot.snapshot_id,
                            conn=conn,
                        )
                        self._store_event_preview_for_commit(
                            event_id=event_id,
                            canonical_csv=parse_content,
                            source_filename=original_filename,
                            ingestion_run_id=ingestion_run_id,
                            warnings=self._preview_warnings_from_validation(validation),
                            conn=conn,
                        )

                        has_measurements = self._insert_raw_measurements_for_event(
                            conn=conn,
                            event_id=event_id,
                            dataframe=parsed.dataframe,
                        )

                        has_lttb = False
                        for plot_key, mapping in channel_map.items():
                            x_col = mapping.get("x_col", 0)
                            y_col = mapping.get("y_col", 1)
                            plot_df = self.transformer.extract_plot_data(
                                parsed.dataframe, x_col, y_col
                            )
                            if not plot_df.empty:
                                has_lttb = True
                                lttb_df = self.downsampler.downsample(plot_df)
                                lttb_df["event_id"] = event_id
                                lttb_df["plot_key"] = plot_key
                                conn.execute("""
                                    INSERT INTO measurements_lttb
                                        (event_id, plot_key, x, y)
                                    SELECT event_id, plot_key, x, y
                                    FROM lttb_df
                                """)
                        self.derived_data_lineage.record_commit(
                            event_id=event_id,
                            ingestion_run_id=ingestion_run_id,
                            channel_map_snapshot_id=channel_map_snapshot.snapshot_id,
                            has_measurements=has_measurements,
                            has_lttb=has_lttb,
                            conn=conn,
                        )
                except Exception as exc:
                    logger.error("Failed ingesting %s: %s", parsed.filename, exc)
                    file_results.append(
                        FileResult(
                            filename=parsed.filename,
                            success=False,
                            event_id=event_id,
                            error=f"Ingestion failed: {exc}",
                        )
                    )
                    if created_events:
                        self._invalidate_cache()
                    return IngestionResult(
                        success=False,
                        files=file_results,
                        event_ids=created_events,
                        total_rows=total_rows,
                        error=f"Ingestion failed for {parsed.filename}: {exc}",
                    )

                created_events.append(event_id)
                total_rows += parsed.row_count
                validation_issues = [
                    {
                        "severity": issue.severity.value,
                        "code": issue.code,
                        "message": issue.message,
                        "details": issue.details,
                    }
                    for issue in validation.issues
                    if issue.severity == ValidationSeverity.WARNING
                ]
                file_results.append(
                    FileResult(
                        filename=parsed.filename,
                        success=True,
                        event_id=event_id,
                        row_count=parsed.row_count,
                        validation_issues=validation_issues,
                    )
                )
                self._store_artifact(
                    program_id=program_id,
                    version=version,
                    filename=original_filename,
                    parse_content=parse_content,
                    validation_content=validation_content,
                    parsed=parsed,
                    status="processed",
                    uploaded_by_user_id=uploaded_by_user_id,
                    metadata={**metadata, "status": effective_status},
                    custom_field_values=custom_field_values,
                    event_id=event_id,
                )
                if on_event_committed:
                    on_event_committed(event_id, len(created_events), len(parsed_files))

            with self.db.write_connection() as conn:
                import json

                conn.execute(
                    """
                    INSERT INTO audit_log (action, user_id, event_id, details)
                    VALUES (?, ?, ?, ?)
                    """,
                    [
                        "INGESTION_SUCCESS",
                        uploaded_by_user_id,
                        created_events[0] if created_events else None,
                        json.dumps(
                            {
                                "program_id": program_id,
                                "version": version,
                                "event_ids": created_events,
                                "total_rows": total_rows,
                                "file_count": len(file_results),
                            }
                        ),
                    ],
                )

            # Invalidate cache after successful ingestion
            self._invalidate_cache()

            logger.info(
                f"Ingestion complete: {len(created_events)} events, "
                f"{total_rows} rows for {program_id}/{version}"
            )

            return IngestionResult(
                success=True,
                files=file_results,
                event_ids=created_events,
                total_rows=total_rows,
            )

        except Exception as e:
            logger.error(f"Ingestion failed before completion: {e}")
            if created_events:
                self._invalidate_cache()
            return IngestionResult(
                success=False,
                files=file_results,
                error=f"Ingestion failed: {str(e)}",
            )

    def validate_loaded_channel_map(
        self,
        channel_map: dict[str, dict[str, Any]],
        column_count: int,
    ) -> dict[str, dict[str, Any]]:
        """Validate a YAML-loaded channel map against the fixed plot contract."""
        expected = set(FIXED_CHANNEL_MAP_PLOTS)
        actual = set(channel_map)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            msg = "Channel map must contain exactly the fixed 8 plot definitions"
            if missing:
                msg += f"; missing: {', '.join(missing)}"
            if extra:
                msg += f"; unexpected: {', '.join(extra)}"
            raise ValueError(msg)

        normalized: dict[str, dict[str, Any]] = {}
        for order, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS):
            mapping = channel_map[plot_key]
            try:
                x_col = int(mapping.get("x_col"))
                y_col = int(mapping.get("y_col"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{plot_key} requires numeric x_col and y_col") from exc
            if x_col < 0 or y_col < 0:
                raise ValueError(f"{plot_key} column indexes must be zero-based and non-negative")
            if x_col >= column_count or y_col >= column_count:
                raise ValueError(
                    f"{plot_key} references a column outside the preview CSV "
                    f"(x_col={x_col}, y_col={y_col}, columns={column_count})"
                )
            normalized[plot_key] = {
                "x_col": x_col,
                "y_col": y_col,
                "x_channel": f"col_{x_col}",
                "y_channel": f"col_{y_col}",
                "plot_order": mapping.get("plot_order", order),
                "x_scale_factor": mapping.get("x_scale_factor", 1.0),
                "y_scale_factor": mapping.get("y_scale_factor", 1.0),
                "x_unit": mapping.get("x_unit"),
                "y_unit": mapping.get("y_unit"),
            }
        return normalized

    def validate_fixed_channel_map(
        self,
        entries: list[dict[str, Any]],
        column_count: int,
    ) -> dict[str, dict[str, Any]]:
        """Validate the fixed 8-row channel-map editor payload."""
        by_key = {str(entry.get("plot_key")): entry for entry in entries}
        expected = set(FIXED_CHANNEL_MAP_PLOTS)
        actual = set(by_key)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            msg = "Channel map must contain exactly the fixed 8 plot definitions"
            if missing:
                msg += f"; missing: {', '.join(missing)}"
            if extra:
                msg += f"; unexpected: {', '.join(extra)}"
            raise ValueError(msg)

        channel_map: dict[str, dict[str, Any]] = {}
        for order, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS):
            entry = by_key[plot_key]
            try:
                x_col = int(entry.get("x_col"))
                y_col = int(entry.get("y_col"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{plot_key} requires numeric x_col and y_col") from exc
            if x_col < 0 or y_col < 0:
                raise ValueError(f"{plot_key} column indexes must be zero-based and non-negative")
            if x_col >= column_count or y_col >= column_count:
                raise ValueError(
                    f"{plot_key} references a column outside the preview CSV "
                    f"(x_col={x_col}, y_col={y_col}, columns={column_count})"
                )
            channel_map[plot_key] = {
                "x_col": x_col,
                "y_col": y_col,
                "x_channel": f"col_{x_col}",
                "y_channel": f"col_{y_col}",
                "plot_order": order,
                "x_scale_factor": 1.0,
                "y_scale_factor": 1.0,
                "x_unit": None,
                "y_unit": None,
            }
        return channel_map

    def upload_channel_map_yaml_and_process_artifacts(
        self,
        *,
        program_id: str,
        version: str,
        channel_map_content: bytes,
        user_id: str,
    ) -> dict[str, Any]:
        """Load a channel-map YAML file and reprocess retained artifacts for the version."""
        artifacts = self.db.list_ingestion_artifacts(program_id=program_id, version=version)
        preview_artifact = artifacts[0] if artifacts else None
        if preview_artifact is None:
            raise ValueError("No retained CSV artifacts are available for this program/version")
        column_count = int(preview_artifact.get("column_count") or 0)
        channel_map = self.channel_loader.load(channel_map_content)
        channel_map = self.validate_loaded_channel_map(channel_map, column_count)
        return self._persist_channel_map_and_process_artifacts(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source="yaml",
            user_id=user_id,
            artifacts=artifacts,
        )

    def save_channel_map_and_process_artifacts(
        self,
        *,
        program_id: str,
        version: str,
        entries: list[dict[str, Any]],
        user_id: str,
    ) -> dict[str, Any]:
        """Save a fixed channel map and reprocess retained artifacts for the version."""
        artifacts = self.db.list_ingestion_artifacts(program_id=program_id, version=version)
        preview_artifact = artifacts[0] if artifacts else None
        if preview_artifact is None:
            raise ValueError("No retained CSV artifacts are available for this program/version")
        column_count = int(preview_artifact.get("column_count") or 0)
        channel_map = self.validate_fixed_channel_map(entries, column_count)
        return self._persist_channel_map_and_process_artifacts(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source="ui",
            user_id=user_id,
            artifacts=artifacts,
        )

    def start_channel_reprocess_from_save(
        self,
        *,
        program_id: str,
        version: str,
        entries: list[dict[str, Any]],
        user_id: str,
    ) -> dict[str, Any]:
        """Persist a fixed channel map and start async retained-artifact reprocessing."""
        artifacts = self.db.list_ingestion_artifacts(program_id=program_id, version=version)
        preview_artifact = artifacts[0] if artifacts else None
        if preview_artifact is None:
            raise ValueError("No retained CSV artifacts are available for this program/version")
        column_count = int(preview_artifact.get("column_count") or 0)
        channel_map = self.validate_fixed_channel_map(entries, column_count)
        return self._start_channel_reprocess_task(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source="ui",
            user_id=user_id,
            artifacts=artifacts,
        )

    def start_channel_reprocess_from_yaml(
        self,
        *,
        program_id: str,
        version: str,
        channel_map_content: bytes,
        user_id: str,
    ) -> dict[str, Any]:
        """Load channel-map YAML and start async retained-artifact reprocessing."""
        artifacts = self.db.list_ingestion_artifacts(program_id=program_id, version=version)
        preview_artifact = artifacts[0] if artifacts else None
        if preview_artifact is None:
            raise ValueError("No retained CSV artifacts are available for this program/version")
        column_count = int(preview_artifact.get("column_count") or 0)
        channel_map = self.channel_loader.load(channel_map_content)
        channel_map = self.validate_loaded_channel_map(channel_map, column_count)
        return self._start_channel_reprocess_task(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source="yaml",
            user_id=user_id,
            artifacts=artifacts,
        )

    def _start_channel_reprocess_task(
        self,
        *,
        program_id: str,
        version: str,
        channel_map: dict[str, dict[str, Any]],
        authoring_source: str,
        user_id: str,
        artifacts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Create or reuse a channel reprocess task and run processing in the background."""
        self.db.delete_expired_upload_tasks()
        existing = self.db.find_active_derived_data_task(program_id, version)
        if existing is not None:
            from server.services.derived_data_task import build_reuse_active_derived_data_task_response

            return build_reuse_active_derived_data_task_response(existing)

        self.db.mark_event_channel_damage_stale(
            program_id=program_id,
            version=version,
            stale_reason="channel_reprocess_required",
        )

        channel_map_snapshot = self._persist_channel_map_only(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source=authoring_source,  # type: ignore[arg-type]
            owner_user_id=user_id,
        )

        task_id = uuid.uuid4().hex
        total_events = len(artifacts)
        self.db.create_upload_task(
            task_id=task_id,
            created_by_user_id=user_id,
            total_events=total_events,
            ttl_minutes=UPLOAD_TASK_TTL_MINUTES,
            task_kind=TASK_KIND_CHANNEL_REPROCESS,
            phase="validating",
            scope={"program_id": program_id, "version": version},
        )

        def _run() -> None:
            self.db.update_upload_task(task_id, status="running", phase="validating")
            try:
                result = self._process_retained_artifacts(
                    program_id=program_id,
                    version=version,
                    channel_map=channel_map,
                    channel_map_snapshot=channel_map_snapshot,
                    user_id=user_id,
                    artifacts=artifacts,
                    on_progress=lambda **fields: self.db.update_upload_task(task_id, **fields),
                )
                failed_count = int(result["failed_count"])
                from server.services.post_upload_precompute import (
                    channel_reprocess_precompute_to_result,
                    run_after_channel_reprocess_completion,
                )

                precompute_decision = run_after_channel_reprocess_completion(
                    self.db,
                    self.cache,
                    self.settings,
                    program_id=program_id,
                    version=version,
                    user_id=user_id,
                )
                result = {
                    **result,
                    **channel_reprocess_precompute_to_result(precompute_decision),
                }
                self.db.update_upload_task(
                    task_id,
                    status="completed",
                    phase="completed",
                    sub_phase=None,
                    progress_message=None,
                    completed_events=int(result["processed_count"]),
                    total_events=total_events,
                    current_event=None,
                    error=(
                        f"{failed_count} artifact(s) failed"
                        if failed_count
                        else None
                    ),
                    result=result,
                )
            except Exception as exc:  # pragma: no cover
                logger.exception("Channel reprocess task failed unexpectedly: %s", task_id)
                self.db.update_upload_task(
                    task_id,
                    status="failed",
                    phase="failed",
                    sub_phase=None,
                    progress_message=None,
                    current_event=None,
                    error=str(exc),
                )

        threading.Thread(target=_run, daemon=True).start()
        return {
            "task_id": task_id,
            "task_kind": TASK_KIND_CHANNEL_REPROCESS,
            "reused_existing_task": False,
        }

    def _persist_channel_map_only(
        self,
        *,
        program_id: str,
        version: str,
        channel_map: dict[str, dict[str, Any]],
        authoring_source: str,
        owner_user_id: str,
    ) -> StoredChannelMapSnapshot:
        """Persist channel-map snapshot and dim_channel_map rows."""
        channel_map_snapshot = self._persist_active_channel_map_snapshot(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source=authoring_source,  # type: ignore[arg-type]
            owner_user_id=owner_user_id,
        )

        with self.db.write_connection() as conn:
            for plot_key, mapping in channel_map.items():
                conn.execute(
                    """
                    INSERT INTO dim_channel_map
                        (program_id, version, plot_key, x_col, y_col, x_channel, y_channel,
                         plot_order, x_scale_factor, y_scale_factor, x_unit, y_unit)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (program_id, version, plot_key) DO UPDATE SET
                        x_col = EXCLUDED.x_col,
                        y_col = EXCLUDED.y_col,
                        x_channel = EXCLUDED.x_channel,
                        y_channel = EXCLUDED.y_channel,
                        plot_order = EXCLUDED.plot_order,
                        x_scale_factor = EXCLUDED.x_scale_factor,
                        y_scale_factor = EXCLUDED.y_scale_factor,
                        x_unit = EXCLUDED.x_unit,
                        y_unit = EXCLUDED.y_unit
                    """,
                    [
                        program_id,
                        version,
                        plot_key,
                        mapping["x_col"],
                        mapping["y_col"],
                        mapping["x_channel"],
                        mapping["y_channel"],
                        mapping["plot_order"],
                        1.0,
                        1.0,
                        mapping.get("x_unit"),
                        mapping.get("y_unit"),
                    ],
                )
        return channel_map_snapshot

    def _insert_raw_measurements_for_event(
        self,
        *,
        conn: Any,
        event_id: str,
        dataframe: pd.DataFrame,
    ) -> bool:
        """Store canonical full-resolution signal rows for one event."""
        df_long = self.transformer.transform_to_long(dataframe)
        if df_long.empty:
            return False

        df_long["event_id"] = event_id
        conn.execute("""
            INSERT INTO measurements_raw
                (event_id, timestamp, channel_name, value)
            SELECT event_id, timestamp, channel_name, value
            FROM df_long
        """)
        return True

    def _has_raw_measurements(self, *, conn: Any, event_id: str) -> bool:
        row = conn.execute(
            "SELECT COUNT(*) FROM measurements_raw WHERE event_id = ?",
            [event_id],
        ).fetchone()
        return bool(row and int(row[0]) > 0)

    def _is_generic_col_channel(self, channel_name: str) -> bool:
        return channel_name.startswith("col_") and channel_name[4:].isdigit()

    def _plot_lookup_channels_for_event(
        self,
        *,
        event_id: str,
        mapping: dict[str, Any],
        header_provider: EventHeaderProvider,
    ) -> tuple[str, str, str | None]:
        """Resolve index-based map entries to this event's raw channel titles."""
        x_channel = str(mapping["x_channel"])
        y_channel = str(mapping["y_channel"])
        uses_index_lookup = self._is_generic_col_channel(
            x_channel
        ) or self._is_generic_col_channel(y_channel)
        if not uses_index_lookup:
            return x_channel, y_channel, None

        metadata = header_provider.load_for_event(event_id)
        if metadata is None:
            return x_channel, y_channel, "Event header metadata is missing"

        resolution = resolve_plot_channels_from_headers(
            PlotChannelMapping(
                x_col=int(mapping["x_col"]),
                y_col=int(mapping["y_col"]),
                x_unit=mapping.get("x_unit"),
                y_unit=mapping.get("y_unit"),
            ),
            metadata.headers,
            metadata.units,
        )
        if resolution.error_code is not None:
            return x_channel, y_channel, resolution.error_message

        return (
            resolution.x_channel_name or x_channel,
            resolution.y_channel_name or y_channel,
            None,
        )

    def _extract_plot_data_from_raw(
        self,
        *,
        conn: Any,
        event_id: str,
        x_channel: str,
        y_channel: str,
    ) -> pd.DataFrame:
        """Build plot source data from canonical raw rows instead of retained artifacts."""
        rows = conn.execute(
            """
            SELECT x.value AS x, y.value AS y
            FROM measurements_raw x
            JOIN measurements_raw y
              ON y.event_id = x.event_id
             AND y.timestamp = x.timestamp
            WHERE x.event_id = ?
              AND x.channel_name = ?
              AND y.channel_name = ?
              AND x.value IS NOT NULL
              AND y.value IS NOT NULL
            ORDER BY x.timestamp
            """,
            [event_id, x_channel, y_channel],
        ).fetchall()
        return pd.DataFrame(rows, columns=["x", "y"])

    def _process_retained_artifacts(
        self,
        *,
        program_id: str,
        version: str,
        channel_map: dict[str, dict[str, Any]],
        channel_map_snapshot: StoredChannelMapSnapshot,
        user_id: str,
        artifacts: list[dict[str, Any]],
        on_progress: ChannelReprocessProgressCallback | None = None,
    ) -> dict[str, Any]:
        """Regenerate cross-plot LTTB data from canonical raw load histories."""
        processed: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []
        total_rows = 0
        total_events = len(artifacts)
        header_provider = EventHeaderProvider(self.db)

        for index, artifact in enumerate(artifacts, start=1):
            artifact_id = int(artifact["artifact_id"])
            source_file = str(artifact["source_file"])
            if on_progress:
                on_progress(
                    phase="validating",
                    sub_phase="artifact_validation",
                    progress_message=validating_artifact_message(index, total_events, source_file),
                    completed_events=len(processed),
                    total_events=total_events,
                    current_event=source_file,
                )
            try:
                event_id = artifact.get("event_id")
                if not event_id:
                    raise ValueError(
                        f"Retained artifact {artifact_id} is not linked to an event"
                    )
                event_id = str(event_id)

                read_conn = self.db.read_connection
                if not self._has_raw_measurements(conn=read_conn, event_id=event_id):
                    raise ValueError(
                        f"Canonical raw load histories are missing for {event_id}; "
                        "run the raw-measurement backfill before assigning channels"
                    )

                lttb_plots: list[tuple[str, Any]] = []
                for plot_key, mapping in channel_map.items():
                    x_channel, y_channel, lookup_error = self._plot_lookup_channels_for_event(
                        event_id=event_id,
                        mapping=mapping,
                        header_provider=header_provider,
                    )
                    if lookup_error is not None:
                        raise ValueError(
                            f"{plot_key}: {lookup_error}"
                        )
                    plot_df = self._extract_plot_data_from_raw(
                        conn=read_conn,
                        event_id=event_id,
                        x_channel=x_channel,
                        y_channel=y_channel,
                    )
                    if plot_df.empty:
                        continue
                    lttb_df = self.downsampler.downsample(plot_df)
                    lttb_df["event_id"] = event_id
                    lttb_df["plot_key"] = plot_key
                    lttb_plots.append((plot_key, lttb_df))
                    if on_progress:
                        on_progress(
                            phase="generating",
                            sub_phase="cross_plot_lttb",
                            progress_message=generating_cross_plot_message(
                                event_id,
                                plot_key,
                                len(lttb_df),
                            ),
                            completed_events=len(processed),
                            total_events=total_events,
                            current_event=event_id,
                        )

                if not lttb_plots:
                    raise ValueError(
                        "No cross-plot data could be extracted from canonical raw "
                        f"load histories for {event_id}"
                    )

                with self.db.write_connection() as conn:
                    conn.execute("DELETE FROM measurements_lttb WHERE event_id = ?", [event_id])
                    ingestion_run_id = self._ingestion_run_id_for_source_file(
                        program_id,
                        version,
                        source_file,
                    )
                    if ingestion_run_id is not None:
                        self.db.upsert_event_ingestion_link(
                            event_id=event_id,
                            ingestion_run_id=ingestion_run_id,
                            channel_map_snapshot_id=channel_map_snapshot.snapshot_id,
                            conn=conn,
                        )

                    has_lttb = bool(lttb_plots)
                    for _plot_key, lttb_df in lttb_plots:
                        conn.execute("""
                            INSERT INTO measurements_lttb
                                (event_id, plot_key, x, y)
                            SELECT event_id, plot_key, x, y
                            FROM lttb_df
                        """)
                    if ingestion_run_id is not None:
                        self.derived_data_lineage.record_commit(
                            event_id=event_id,
                            ingestion_run_id=ingestion_run_id,
                            channel_map_snapshot_id=channel_map_snapshot.snapshot_id,
                            has_measurements=True,
                            has_lttb=has_lttb,
                            conn=conn,
                        )

                self.db.update_ingestion_artifact_status(
                    artifact_id,
                    status="processed",
                    event_id=event_id,
                    error=None,
                )
                row_count = int(artifact.get("row_count") or 0)
                total_rows += row_count
                processed.append(
                    {"artifact_id": artifact_id, "event_id": event_id, "row_count": row_count}
                )
            except Exception as exc:
                logger.error("Failed processing retained artifact %s: %s", artifact_id, exc)
                self.db.update_ingestion_artifact_status(
                    artifact_id,
                    status="failed",
                    error=str(exc),
                )
                failed.append(
                    {"artifact_id": artifact_id, "source_file": source_file, "error": str(exc)}
                )

        self._invalidate_cache()
        return {
            "program_id": program_id,
            "version": version,
            "processed": processed,
            "failed": failed,
            "processed_count": len(processed),
            "failed_count": len(failed),
            "total_rows": total_rows,
        }

    def _persist_channel_map_and_process_artifacts(
        self,
        *,
        program_id: str,
        version: str,
        channel_map: dict[str, dict[str, Any]],
        authoring_source: str,
        user_id: str,
        artifacts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Persist a channel map and reprocess retained artifacts for the version."""
        channel_map_snapshot = self._persist_channel_map_only(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            authoring_source=authoring_source,
            owner_user_id=user_id,
        )
        return self._process_retained_artifacts(
            program_id=program_id,
            version=version,
            channel_map=channel_map,
            channel_map_snapshot=channel_map_snapshot,
            user_id=user_id,
            artifacts=artifacts,
        )

    def _get_existing_event_ids(self) -> set[str]:
        """Get all existing event IDs from the database."""
        query = "SELECT event_id FROM dim_event"
        result = self.db.read_connection.execute(query).fetchall()
        return {row[0] for row in result}

    def _generate_event_id(self, filename: str, existing_ids: set[str]) -> str:
        """Generate event ID from filename without extension.

        If the base name already exists, appends a numeric suffix.
        """
        # Strip directory path (folder uploads include relative path)
        filename = os.path.basename(filename)

        # Remove data-file extension to get base name
        lower_filename = filename.lower()
        if lower_filename.endswith(".csv") or lower_filename.endswith(".rsp"):
            base_name = filename[:-4]
        else:
            base_name = filename

        # Check for uniqueness and add suffix if needed
        event_id = base_name
        counter = 1
        while event_id in existing_ids:
            event_id = f"{base_name}_{counter}"
            counter += 1

        return event_id

    def _normalize_files(
        self,
        files: list[tuple[str, bytes]],
        on_task_update: UploadTaskUpdateCallback | None = None,
    ) -> list[tuple[str, bytes, bytes]]:
        """Return files as CSV parse bytes while preserving original hash bytes."""
        data_files = [
            (filename, content)
            for filename, content in files
            if filename.lower().endswith((".csv", ".rsp"))
        ]
        kinds = {
            ".rsp" if filename.lower().endswith(".rsp") else ".csv"
            for filename, _ in data_files
        }
        if len(kinds) > 1:
            raise ValueError("Upload folders must contain only one data format: CSV or RSP")

        if ".rsp" not in kinds:
            return [(filename, content, content) for filename, content in data_files]

        total_files = len(data_files)
        normalized = []
        for index, (filename, content) in enumerate(data_files, start=1):
            if on_task_update:
                on_task_update(
                    phase="converting",
                    progress_message=f"Converting RSP {index}/{total_files}: {filename}",
                    completed_events=index - 1,
                    total_events=total_files,
                    current_event=filename,
                )
            converted = self.rsp_converter.convert(filename, content)
            logger.info(
                "Converted %s to %s (%s rows, %s channels)",
                filename,
                converted.filename,
                converted.row_count,
                converted.channel_count,
            )
            normalized.append((filename, converted.content, content))
        return normalized

    def _invalidate_cache(self) -> None:
        """Invalidate cached data after ingestion."""
        self.cache.invalidate_prefix(CacheKeys.PROGRAM_IDS)
        self.cache.invalidate_prefix(CacheKeys.VERSIONS)
        self.cache.invalidate_prefix(CacheKeys.EVENTS)
        self.cache.invalidate_prefix(CacheKeys.EVENT_COUNT)

