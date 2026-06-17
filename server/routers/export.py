"""Database export endpoints and legacy import tombstones."""

import logging
import re
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from server.config import get_settings
from server.dependencies import AdminRequiredDep, get_export_service
from server.services.operation_admission import (
    OperationAdmissionError,
    assert_can_start_database_export,
    assert_can_switch_or_delete_database,
    exclusive_database_operation,
)
from server.services.export import ExportService, _update_task, get_task
from server.services.session import SessionManager
from server.storage.database import UnifiedStore
from server.storage.migrations import MigrationRunner
from server.upload.task_kinds import (
    TASK_KIND_DATABASE_CREATE,
    TASK_KIND_DATABASE_DELETE,
    TASK_KIND_DATABASE_SWITCH,
)
from server.utils.logging import get_audit_logger

router = APIRouter(prefix="/export")
audit_log = get_audit_logger()
logger = logging.getLogger(__name__)
STALL_THRESHOLD_EXPORT_SEC = 120  # 2 minutes with no heartbeat = likely dead export thread
DELETE_CONFIRMATION_PREFIX = "DELETE "
_DB_LABEL_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")
_DB_SWITCH_LOCK = threading.RLock()


def _settings():
    return get_settings()


class DatabaseInfoResponse(BaseModel):
    """Database information response."""

    path: str
    size_mb: float
    event_count: int
    program_count: int
    max_upload_size_mb: int = Field(
        description="Maximum allowed size for large upload payloads (MB)",
    )


class StartTaskResponse(BaseModel):
    """Background task started."""

    task_id: str


class DatabaseCatalogResponse(BaseModel):
    """List of manageable dashboard database files under data_root."""

    current_database: str
    current_path: str
    databases: list[str]


class CreateDatabaseRequest(BaseModel):
    """Request body for creating a new managed dashboard database."""

    name: str


class ConnectDatabaseRequest(BaseModel):
    """Request body for connecting to an existing database file."""

    database_name: str


class DeleteDatabaseRequest(BaseModel):
    """Typed-confirm request for deleting a managed database file."""

    database_name: str
    confirmation: str


class DeleteDatabaseResponse(BaseModel):
    """Response after deleting a managed database file."""

    deleted_database: str
    current_database: str
    current_path: str
    databases: list[str]


class CreateDatabaseResponse(BaseModel):
    """Response after creating a new managed database without switching runtime."""

    created_database: str
    created_path: str
    current_database: str
    current_path: str
    databases: list[str]


class SwitchDatabaseResponse(BaseModel):
    """Response after switching the active app database."""

    active_database: str
    active_path: str
    previous_database: str
    previous_path: str
    databases: list[str]


class TaskStatusResponse(BaseModel):
    """Pollable task status."""

    task_id: str
    kind: str
    status: str
    progress: str
    phase: str = ""
    sub_phase: str = ""
    current: int
    total: int
    current_table: str | None = None
    events_loaded: int | None = None
    error: str | None = None
    result: dict[str, Any] | None = None
    updated_at: float = 0.0


def _list_database_files() -> list[Path]:
    """Return deterministic list of dashboard*.db files under data_root."""
    settings = _settings()
    return sorted(
        path
        for path in settings.data_root.glob("dashboard*.db")
        if path.is_file() and path.suffix == ".db"
    )


def _database_name(path: Path) -> str:
    return path.name


def _run_database_health_checks(db: UnifiedStore) -> None:
    """Lightweight runtime health checks before making a DB active."""
    db.read_connection.execute("SELECT 1").fetchone()
    db.read_connection.execute("SELECT COUNT(*) FROM _schema_metadata").fetchone()
    db.read_connection.execute("SELECT COUNT(*) FROM dim_event").fetchone()


def _initialize_store(db_path: Path) -> UnifiedStore:
    """Initialize/migrate target DB and return ready store."""
    migration_runner = MigrationRunner(db_path)
    store, _ = migration_runner.initialize_store_for_startup()
    _run_database_health_checks(store)
    return store


def _validate_database_label(name: str) -> str:
    """Validate user-provided database label for dashboard-<label>-<timestamp>.db."""
    label = name.strip()
    if not label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database name is required",
        )
    if not _DB_LABEL_PATTERN.fullmatch(label):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Database name must be 1-64 characters: letters, numbers, hyphens, "
                "and underscores; must start with a letter or number"
            ),
        )
    return label


def _next_database_path(label: str) -> Path:
    """Create a unique dashboard-<label>-<timestamp>.db path."""
    settings = _settings()
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    base = settings.data_root / f"dashboard-{label}-{stamp}.db"
    if not base.exists():
        return base
    index = 1
    while True:
        candidate = settings.data_root / f"dashboard-{label}-{stamp}-{index}.db"
        if not candidate.exists():
            return candidate
        index += 1


def _clear_runtime_caches(request: Request) -> int:
    """Drop in-memory query caches after the active database changes."""
    cache = request.app.state.cache
    cleared = cache.clear()
    if cleared:
        logger.info(
            "cleared runtime query cache after database switch",
            extra={"event": "db_switch_cache_cleared", "cleared_entries": cleared},
        )
    return cleared


def _swap_active_database(request: Request, new_store: UnifiedStore) -> tuple[Path, list[str]]:
    """Swap app.state DB/session manager only after health checks pass."""
    with _DB_SWITCH_LOCK:
        previous_store: UnifiedStore = request.app.state.db
        previous_session_manager = request.app.state.session_manager
        previous_path = previous_store.db_path

        try:
            _run_database_health_checks(new_store)
            request.app.state.db = new_store
            request.app.state.session_manager = SessionManager(new_store)
            _run_database_health_checks(request.app.state.db)
        except Exception:
            request.app.state.db = previous_store
            request.app.state.session_manager = previous_session_manager
            new_store.close()
            raise

        if previous_store is not new_store:
            _clear_runtime_caches(request)
            try:
                previous_store.close()
            except Exception:
                logger.warning("failed to close previous database store", exc_info=True)

        return previous_path, [_database_name(path) for path in _list_database_files()]


@router.get(
    "/database/list",
    response_model=DatabaseCatalogResponse,
)
async def list_databases(
    _: AdminRequiredDep,
    request: Request,
) -> DatabaseCatalogResponse:
    """List available dashboard database files and current active DB."""
    current_path: Path = request.app.state.db.db_path
    databases = [_database_name(path) for path in _list_database_files()]
    if _database_name(current_path) not in databases:
        databases.insert(0, _database_name(current_path))
    return DatabaseCatalogResponse(
        current_database=_database_name(current_path),
        current_path=str(current_path),
        databases=databases,
    )


@router.post(
    "/database/create-new",
    response_model=CreateDatabaseResponse,
)
async def create_new_database(
    _: AdminRequiredDep,
    request: Request,
    payload: CreateDatabaseRequest,
) -> CreateDatabaseResponse:
    """Create dashboard-<name>-<timestamp>.db without changing the active runtime DB."""
    try:
        with exclusive_database_operation(TASK_KIND_DATABASE_CREATE):
            label = _validate_database_label(payload.name)
            target_path = _next_database_path(label)
            new_store = _initialize_store(target_path)
            try:
                _run_database_health_checks(new_store)
            except Exception:
                new_store.close()
                target_path.unlink(missing_ok=True)
                raise

            new_store.close()
            current_path: Path = request.app.state.db.db_path
            databases = [_database_name(path) for path in _list_database_files()]
            if _database_name(target_path) not in databases:
                databases.append(_database_name(target_path))
                databases.sort()
            audit_log.info(
                "db create-new created managed database",
                extra={
                    "event": "db_create_new_created",
                    "reason": f"created={target_path.name} active={current_path.name}",
                },
            )
            return CreateDatabaseResponse(
                created_database=target_path.name,
                created_path=str(target_path),
                current_database=current_path.name,
                current_path=str(current_path),
                databases=databases,
            )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc


def _validate_database_filename(target_name: str) -> str:
    """Ensure database_name is a .db filename with no path components."""
    if not target_name or Path(target_name).name != target_name or not target_name.endswith(".db"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="database_name must be a managed .db filename (no path components)",
        )
    return target_name


@router.post(
    "/database/connect",
    response_model=SwitchDatabaseResponse,
)
async def connect_database(
    admin_user: AdminRequiredDep,
    request: Request,
    payload: ConnectDatabaseRequest,
) -> SwitchDatabaseResponse:
    """Connect active runtime to an existing managed dashboard*.db file."""
    try:
        assert_can_switch_or_delete_database(
            request.app.state.db,
            operation=TASK_KIND_DATABASE_SWITCH,
            requesting_user_id=admin_user["id"],
        )
        with exclusive_database_operation(TASK_KIND_DATABASE_SWITCH):
            settings = _settings()
            target_name = _validate_database_filename(payload.database_name.strip())
            target_path = settings.data_root / target_name
            if not target_path.is_file():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Database not found: {target_name}",
                )

            current_path: Path = request.app.state.db.db_path
            if current_path.resolve() == target_path.resolve():
                databases = [_database_name(path) for path in _list_database_files()]
                return SwitchDatabaseResponse(
                    active_database=current_path.name,
                    active_path=str(current_path),
                    previous_database=current_path.name,
                    previous_path=str(current_path),
                    databases=databases,
                )

            new_store = _initialize_store(target_path)
            previous_path, databases = _swap_active_database(request, new_store)
            active_path = request.app.state.db.db_path
            audit_log.info(
                "db connect switched active database",
                extra={
                    "event": "db_connect_switched",
                    "reason": f"from={previous_path.name} to={active_path.name}",
                },
            )
            return SwitchDatabaseResponse(
                active_database=active_path.name,
                active_path=str(active_path),
                previous_database=previous_path.name,
                previous_path=str(previous_path),
                databases=databases,
            )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc


@router.post(
    "/database/delete",
    response_model=DeleteDatabaseResponse,
)
async def delete_database(
    admin_user: AdminRequiredDep,
    request: Request,
    payload: DeleteDatabaseRequest,
) -> DeleteDatabaseResponse:
    """Delete a non-active managed dashboard*.db file after typed confirmation."""
    try:
        assert_can_switch_or_delete_database(
            request.app.state.db,
            operation=TASK_KIND_DATABASE_DELETE,
            requesting_user_id=admin_user["id"],
        )
        with exclusive_database_operation(TASK_KIND_DATABASE_DELETE):
            settings = _settings()
            target_name = _validate_database_filename(payload.database_name.strip())
            if not target_name.startswith("dashboard"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only managed dashboard*.db files can be deleted",
                )
            expected_confirmation = f"{DELETE_CONFIRMATION_PREFIX}{target_name}"
            if payload.confirmation.strip() != expected_confirmation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Confirmation mismatch. Type exactly: {expected_confirmation}",
                )

            current_path: Path = request.app.state.db.db_path
            if current_path.name == target_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the currently active database. Connect to another database first.",
                )

            target_path = settings.data_root / target_name
            if not target_path.is_file():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Database not found: {target_name}",
                )

            target_path.unlink(missing_ok=False)
            for suffix in (".wal", ".tmp"):
                sidecar = target_path.with_suffix(target_path.suffix + suffix)
                sidecar.unlink(missing_ok=True)

            databases = [_database_name(path) for path in _list_database_files()]
            audit_log.info(
                "db delete removed managed database",
                extra={
                    "event": "db_delete_removed",
                    "reason": f"deleted={target_name} active={current_path.name}",
                },
            )
            return DeleteDatabaseResponse(
                deleted_database=target_name,
                current_database=current_path.name,
                current_path=str(current_path),
                databases=databases,
            )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc


@router.get(
    "/database/info",
    response_model=DatabaseInfoResponse,
)
async def get_database_info(
    _: AdminRequiredDep,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> DatabaseInfoResponse:
    """Get information about the current database (admin)."""
    info = export_service.get_database_info()
    return DatabaseInfoResponse(
        **info,
        max_upload_size_mb=_settings().max_upload_size_mb,
    )


@router.post(
    "/database/parquet/export/start",
    response_model=StartTaskResponse,
)
async def start_parquet_export(
    _: AdminRequiredDep,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> StartTaskResponse:
    """Start background export to Parquet ZIP (admin)."""
    try:
        assert_can_start_database_export()
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc
    task_id = export_service.start_export_task()
    audit_log.info(
        "db export started",
        extra={"event": "db_export_started", "request_id": task_id},
    )
    return StartTaskResponse(task_id=task_id)


@router.get(
    "/database/parquet/task/{task_id}",
    response_model=TaskStatusResponse,
)
async def get_parquet_task_status(
    _: AdminRequiredDep,
    task_id: str,
) -> TaskStatusResponse:
    """Poll export task status (admin)."""
    t = get_task(task_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task_id")

    if t.status == "running" and t.updated_at > 0:
        elapsed = time.time() - t.updated_at
        stall_threshold = STALL_THRESHOLD_EXPORT_SEC
        if elapsed > stall_threshold:
            stall_minutes = int(stall_threshold // 60)
            _update_task(
                task_id,
                status="failed",
                error=f"Task stalled — no progress for {stall_minutes} minutes",
                progress="Failed (stalled)",
                phase="failed",
            )
            t = get_task(task_id)
            if not t:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task_id")

    return TaskStatusResponse(
        task_id=t.task_id,
        kind=t.kind,
        status=t.status,
        progress=t.progress,
        phase=t.phase,
        sub_phase=t.sub_phase,
        current=t.current,
        total=t.total,
        current_table=t.current_table,
        events_loaded=t.events_loaded,
        error=t.error,
        result=t.result,
        updated_at=t.updated_at,
    )


def _schedule_cleanup(export_service: ExportService, task_id: str) -> None:
    export_service.cleanup_export_zip(task_id)


@router.get(
    "/database/parquet/download/{task_id}",
    response_class=FileResponse,
)
async def download_parquet_export(
    _: AdminRequiredDep,
    task_id: str,
    background_tasks: BackgroundTasks,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> FileResponse:
    """Download completed Parquet ZIP; removes artifact after send (admin)."""
    t = get_task(task_id)
    if not t or t.kind != "export":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown export task")
    if t.status != "completed" or not t.zip_path or not t.zip_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Export not ready or already downloaded",
        )
    export_service.mark_export_downloading(task_id)
    zp = t.zip_path
    background_tasks.add_task(_schedule_cleanup, export_service, task_id)
    audit_log.info(
        "db export completed",
        extra={
            "event": "db_export_completed",
            "request_id": task_id,
            "export_filename": zp.name,
            "bytes": zp.stat().st_size if zp.is_file() else None,
        },
    )
    return FileResponse(
        path=str(zp),
        filename="dashboard_export.zip",
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=dashboard_export.zip"},
    )


@router.post(
    "/database/parquet/upload",
)
async def upload_parquet_export_for_import(
    _: AdminRequiredDep,
    file: UploadFile = File(..., description="Parquet export ZIP"),
) -> dict[str, str]:
    """Database import upload is removed from the active product surface."""
    _ = file
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Database import has been removed. "
            "Use database export plus create/connect database workflow instead."
        ),
    )


@router.delete(
    "/database/parquet/task/{task_id}",
    response_model=dict[str, bool],
)
async def cancel_parquet_task(
    _: AdminRequiredDep,
    task_id: str,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> dict[str, bool]:
    """Cancel a running export background task (admin)."""
    ok = export_service.cancel_task(task_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id or task is not running",
        )
    return {"ok": True}


@router.delete("/database/parquet/upload/{upload_id}")
async def cancel_parquet_upload(
    _: AdminRequiredDep,
    upload_id: str,
) -> dict[str, bool]:
    """Database import cancellation endpoint is removed with import flow."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Database import has been removed. "
            "Use database export plus create/connect database workflow instead."
        ),
    )


@router.post(
    "/database/parquet/import/{upload_id}",
)
async def start_parquet_import(
    _: AdminRequiredDep,
    upload_id: str,
) -> dict[str, str]:
    """Database import start endpoint is removed from active API behavior."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Database import has been removed. "
            "Use database export plus create/connect database workflow instead."
        ),
    )
