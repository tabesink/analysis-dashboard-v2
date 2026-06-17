"""Database export service for portability (Parquet + ZIP)."""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from server.config import Settings
from server.services.transfer_package import TRANSFER_PACKAGE_TABLES, TransferPackageService
from server.storage.database import UnifiedStore

logger = logging.getLogger(__name__)


class TaskCancelledError(Exception):
    """Raised when a background export task is cancelled."""

@dataclass
class TaskStatus:
    """In-memory export job state (single-process admin use)."""

    task_id: str
    kind: str  # "export"
    status: str = "running"  # running | completed | failed | cancelled
    progress: str = ""
    phase: str = ""
    sub_phase: str = ""
    current: int = 0
    total: int = 0
    current_table: str | None = None
    events_loaded: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    zip_path: Path | None = None
    updated_at: float = field(default_factory=time.time)


_tasks_lock = threading.Lock()
_tasks: dict[str, TaskStatus] = {}
_TASK_PERSIST_KINDS = frozenset({"export"})
_cancel_events_lock = threading.Lock()
_cancel_events: dict[str, threading.Event] = {}


def _new_task_id() -> str:
    return uuid.uuid4().hex


def _parquet_task_state_dir() -> Path:
    from server.config import get_settings

    directory = get_settings().scratch_dir / "parquet-tasks"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _task_to_json_dict(task: TaskStatus) -> dict[str, Any]:
    return {
        "task_id": task.task_id,
        "kind": task.kind,
        "status": task.status,
        "progress": task.progress,
        "phase": task.phase,
        "sub_phase": task.sub_phase,
        "current": task.current,
        "total": task.total,
        "current_table": task.current_table,
        "events_loaded": task.events_loaded,
        "result": task.result,
        "error": task.error,
        "zip_path": str(task.zip_path) if task.zip_path else None,
        "updated_at": task.updated_at,
    }


def _task_from_json_dict(data: dict[str, Any]) -> TaskStatus:
    zip_raw = data.get("zip_path")
    return TaskStatus(
        task_id=str(data["task_id"]),
        kind=str(data["kind"]),
        status=str(data.get("status", "running")),
        progress=str(data.get("progress", "")),
        phase=str(data.get("phase", "")),
        sub_phase=str(data.get("sub_phase", "")),
        current=int(data.get("current", 0)),
        total=int(data.get("total", 0)),
        current_table=data.get("current_table"),
        events_loaded=data.get("events_loaded"),
        result=data.get("result"),
        error=data.get("error"),
        zip_path=Path(zip_raw) if zip_raw else None,
        updated_at=float(data.get("updated_at", time.time())),
    )


def _persist_task_to_disk(task: TaskStatus) -> None:
    if task.kind not in _TASK_PERSIST_KINDS:
        return
    directory = _parquet_task_state_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{task.task_id}.json"
    tmp = path.with_suffix(".json.tmp")
    payload = json.dumps(_task_to_json_dict(task), indent=None)
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def _load_task_from_disk(task_id: str) -> TaskStatus | None:
    path = _parquet_task_state_dir() / f"{task_id}.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        return _task_from_json_dict(data)
    except Exception:
        logger.warning("Could not load persisted task %s", task_id, exc_info=True)
        return None


def _delete_persisted_task(task_id: str) -> None:
    path = _parquet_task_state_dir() / f"{task_id}.json"
    path.unlink(missing_ok=True)
    path.with_suffix(".json.tmp").unlink(missing_ok=True)


def reconcile_persisted_parquet_tasks() -> None:
    """Mark orphaned running tasks failed after a process restart."""
    task_dir = _parquet_task_state_dir()
    for path in sorted(task_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            task = _task_from_json_dict(data)
            if task.status != "running":
                continue
            task.status = "failed"
            task.phase = "failed"
            task.progress = "Failed (server restarted)"
            task.error = (
                "Server restarted while this task was running. "
                "Check server logs for export task failure before retrying."
            )
            task.updated_at = time.time()
            _persist_task_to_disk(task)
            with _tasks_lock:
                _tasks[task.task_id] = task
            logger.warning(
                "Marked orphaned %s task %s as failed after restart",
                task.kind,
                task.task_id,
            )
        except Exception:
            logger.warning("Could not reconcile persisted task file %s", path, exc_info=True)


def _put_task(task: TaskStatus) -> None:
    task.updated_at = time.time()
    with _tasks_lock:
        _tasks[task.task_id] = task
    _persist_task_to_disk(task)


def get_task(task_id: str) -> TaskStatus | None:
    with _tasks_lock:
        task = _tasks.get(task_id)
    if task is not None:
        return task
    loaded = _load_task_from_disk(task_id)
    if loaded is None:
        return None
    with _tasks_lock:
        _tasks[task_id] = loaded
    return loaded


def list_tasks(
    *,
    kinds: set[str] | None = None,
    statuses: set[str] | None = None,
) -> list[TaskStatus]:
    """List known export tasks from memory and persisted state."""
    with _tasks_lock:
        known_ids = set(_tasks.keys())
    for path in _parquet_task_state_dir().glob("*.json"):
        known_ids.add(path.stem)
    tasks: list[TaskStatus] = []
    for task_id in sorted(known_ids):
        task = get_task(task_id)
        if task is None:
            continue
        if kinds is not None and task.kind not in kinds:
            continue
        if statuses is not None and task.status not in statuses:
            continue
        tasks.append(task)
    return tasks


def _register_cancel_event(task_id: str) -> threading.Event:
    ev = threading.Event()
    with _cancel_events_lock:
        _cancel_events[task_id] = ev
    return ev


def _unregister_cancel_event(task_id: str) -> None:
    with _cancel_events_lock:
        _cancel_events.pop(task_id, None)


def _check_cancel(task_id: str) -> None:
    with _cancel_events_lock:
        ev = _cancel_events.get(task_id)
    if ev is not None and ev.is_set():
        raise TaskCancelledError()


def _update_task(
    task_id: str,
    *,
    progress: str | None = None,
    phase: str | None = None,
    sub_phase: str | None = None,
    current: int | None = None,
    total: int | None = None,
    current_table: str | None = None,
    clear_current_table: bool = False,
    events_loaded: int | None = None,
    status: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
    zip_path: Path | None = None,
) -> None:
    with _tasks_lock:
        t = _tasks.get(task_id)
    if not t:
        t = _load_task_from_disk(task_id)
        if t:
            with _tasks_lock:
                _tasks[task_id] = t
    if not t:
        return
    with _tasks_lock:
        t.updated_at = time.time()
        if progress is not None:
            t.progress = progress
        if phase is not None:
            t.phase = phase
        if sub_phase is not None:
            t.sub_phase = sub_phase
        if current is not None:
            t.current = current
        if total is not None:
            t.total = total
        if clear_current_table:
            t.current_table = None
        elif current_table is not None:
            t.current_table = current_table
        if events_loaded is not None:
            t.events_loaded = events_loaded
        if status is not None:
            t.status = status
        if result is not None:
            t.result = result
        if error is not None:
            t.error = error
        if zip_path is not None:
            t.zip_path = zip_path
    _persist_task_to_disk(t)


def _is_managed_artifact_member(member: str) -> bool:
    parts = Path(member).parts
    return "managed_artifacts" in parts


class ExportService:
    """
    Service for database export operations.

    Exports Parquet (zstd) + schema/load SQL, zipped.
    """

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings

    def _mk_scratch_dir(self, prefix: str) -> Path:
        """Create a temp directory under data_root/tmp (not container /tmp tmpfs)."""
        scratch = self.settings.scratch_dir
        scratch.mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix=prefix, dir=str(scratch)))

    def get_database_path(self) -> Path:
        """Get path to the current database file."""
        return self.db.db_path

    def get_database_info(self) -> dict[str, Any]:
        """Get metadata about the current database."""
        db_path = self.db.db_path

        event_count = self.db.read_connection.execute(
            "SELECT COUNT(*) FROM dim_event WHERE is_deleted = false"
        ).fetchone()[0]

        size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0

        program_count = len(self.db.get_program_ids())

        return {
            "path": str(db_path),
            "size_mb": round(size_mb, 2),
            "event_count": event_count,
            "program_count": program_count,
        }

    def start_export_task(self) -> str:
        """Create export task and run it in a background thread."""
        task_id = _new_task_id()
        _register_cancel_event(task_id)
        task = TaskStatus(task_id=task_id, kind="export", phase="exporting")
        _put_task(task)
        thread = threading.Thread(target=self._run_export, args=(task_id,), daemon=True)
        thread.start()
        return task_id

    def cancel_task(self, task_id: str) -> bool:
        """Request cancellation of a running export task. Returns False if unknown or not running."""
        t = get_task(task_id)
        if not t or t.status != "running":
            return False
        with _cancel_events_lock:
            ev = _cancel_events.get(task_id)
        if ev is not None:
            ev.set()
        t_after = get_task(task_id)
        if t_after and t_after.status == "running":
            _update_task(task_id, progress="Cancellation requested…")
        return True

    def mark_export_downloading(self, task_id: str) -> bool:
        """Mark export task as in the client download phase (HTTP download started)."""
        t = get_task(task_id)
        if not t or t.kind != "export" or t.status != "completed":
            return False
        _update_task(task_id, phase="downloading")
        return True

    def _run_export(self, task_id: str) -> None:
        work = self._mk_scratch_dir("export-parquet-")
        export_dir = work / "data"
        success = False
        try:
            _check_cancel(task_id)
            export_dir.mkdir()
            _update_task(task_id, phase="exporting", progress="Starting export…")

            def on_progress(table: str | None, cur: int, tot: int) -> None:
                _check_cancel(task_id)
                if table:
                    msg = f"Exporting {table} ({cur}/{tot})"
                else:
                    msg = f"Preparing export ({cur}/{tot})"
                _update_task(
                    task_id,
                    progress=msg,
                    phase="exporting",
                    current=cur,
                    total=tot,
                    current_table=table,
                )

            TransferPackageService(self.db, self.settings).export_package(export_dir)
            if on_progress:
                table_count = len(
                    [
                        table
                        for table in TRANSFER_PACKAGE_TABLES
                        if (export_dir / f"{table}.parquet").is_file()
                    ]
                )
                on_progress(None, table_count, table_count)

            _check_cancel(task_id)
            _update_task(
                task_id,
                phase="compressing",
                progress="Creating ZIP archive…",
                current=1,
                total=1,
            )
            zip_base = work / "dashboard_export"
            shutil.make_archive(str(zip_base), "zip", root_dir=str(export_dir))
            zip_path = Path(str(zip_base) + ".zip")

            _update_task(
                task_id,
                status="completed",
                progress="Ready to download",
                phase="pending_download",
                zip_path=zip_path,
                result={
                    "filename": "dashboard_export.zip",
                    "size_mb": round(zip_path.stat().st_size / (1024 * 1024), 2),
                },
            )
            success = True
        except TaskCancelledError:
            logger.info("Export task cancelled: %s", task_id)
            _update_task(
                task_id,
                status="cancelled",
                error="Cancelled",
                progress="Cancelled",
                phase="cancelled",
            )
        except Exception as e:
            logger.exception("Export task failed")
            _update_task(
                task_id,
                status="failed",
                error=str(e),
                progress="Failed",
                phase="failed",
            )
        finally:
            _unregister_cancel_event(task_id)
            try:
                if export_dir.exists():
                    shutil.rmtree(export_dir, ignore_errors=True)
            except Exception:
                pass
            if not success:
                shutil.rmtree(work, ignore_errors=True)

    def cleanup_export_zip(self, task_id: str) -> None:
        """Remove export artifact and working files after download."""
        _unregister_cancel_event(task_id)
        with _tasks_lock:
            t = _tasks.pop(task_id, None)
        _delete_persisted_task(task_id)
        if not t or not t.zip_path:
            return
        zp = t.zip_path
        try:
            parent = zp.parent
            zp.unlink(missing_ok=True)
            shutil.rmtree(parent, ignore_errors=True)
        except Exception:
            logger.warning("Could not cleanup export zip for task %s", task_id)
