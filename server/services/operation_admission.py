"""Lightweight operation admission guards for conflicting work."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
import threading
from typing import Any

from server.services.active_presence import get_active_users_for_database
from server.services.export import list_tasks
from server.upload.task_kinds import (
    ACTIVE_TASK_STATUSES,
    DATABASE_EXCLUSIVE_OPERATION_KINDS,
    DERIVED_DATA_TASK_KINDS,
    TASK_KIND_DATABASE_EXPORT,
    TASK_KIND_FOLDER_UPLOAD,
)

_EXCLUSIVE_DB_OPERATION_LOCK = threading.Lock()
_active_exclusive_db_operation: dict[str, str] | None = None


@dataclass(frozen=True)
class OperationBlocker:
    """Structured blocker payload for API conflict responses."""

    operation: str
    reason: str
    task_id: str | None = None
    status: str | None = None
    scope: dict[str, Any] | None = None
    usernames: list[str] | None = None
    last_heartbeat_at: Any | None = None
    cancel_requested_at: Any | None = None

    def to_dict(self) -> dict[str, Any]:
        def _json_value(value: Any) -> Any:
            if isinstance(value, datetime):
                return value.isoformat()
            return value

        payload: dict[str, Any] = {
            "operation": self.operation,
            "reason": self.reason,
        }
        if self.task_id:
            payload["task_id"] = self.task_id
        if self.status:
            payload["status"] = self.status
        if self.scope:
            payload["scope"] = self.scope
        if self.usernames:
            payload["usernames"] = self.usernames
        if self.last_heartbeat_at is not None:
            payload["last_heartbeat_at"] = _json_value(self.last_heartbeat_at)
        if self.cancel_requested_at is not None:
            payload["cancel_requested_at"] = _json_value(self.cancel_requested_at)
        return payload


class OperationAdmissionError(RuntimeError):
    """Raised when an operation is rejected by admission guards."""

    def __init__(
        self,
        *,
        operation: str,
        message: str,
        blockers: list[OperationBlocker],
    ) -> None:
        super().__init__(message)
        self.operation = operation
        self.message = message
        self.blockers = blockers

    def to_http_detail(self) -> dict[str, Any]:
        return {
            "code": "operation_blocked",
            "operation": self.operation,
            "message": self.message,
            "blocked_by": [item.to_dict() for item in self.blockers],
        }


def _active_upload_task_rows(db: Any, *, task_kinds: tuple[str, ...]) -> list[dict[str, Any]]:
    placeholders = ", ".join("?" for _ in task_kinds)
    status_placeholders = ", ".join("?" for _ in ACTIVE_TASK_STATUSES)
    rows = db.read_connection.execute(
        f"""
        SELECT *
        FROM upload_tasks
        WHERE task_kind IN ({placeholders})
          AND status IN ({status_placeholders})
        ORDER BY created_at DESC
        """,
        [*task_kinds, *ACTIVE_TASK_STATUSES],
    ).fetchall()
    columns = [desc[0] for desc in db.read_connection.description]
    return [db._normalize_upload_task_row(dict(zip(columns, row))) for row in rows]


def _active_folder_upload_blockers(db: Any) -> list[OperationBlocker]:
    rows = _active_upload_task_rows(db, task_kinds=(TASK_KIND_FOLDER_UPLOAD,))
    return [
        OperationBlocker(
            operation=TASK_KIND_FOLDER_UPLOAD,
            reason="active_folder_upload",
            task_id=str(row.get("task_id") or ""),
            status=str(row.get("status") or ""),
            scope=row.get("scope_json") if isinstance(row.get("scope_json"), dict) else None,
            last_heartbeat_at=row.get("last_heartbeat_at"),
            cancel_requested_at=row.get("cancel_requested_at"),
        )
        for row in rows
    ]


def _active_derived_task_blockers(db: Any) -> list[OperationBlocker]:
    rows = _active_upload_task_rows(db, task_kinds=tuple(DERIVED_DATA_TASK_KINDS))
    return [
        OperationBlocker(
            operation=str(row.get("task_kind") or "derived_task"),
            reason="active_derived_task",
            task_id=str(row.get("task_id") or ""),
            status=str(row.get("status") or ""),
            scope=row.get("scope_json") if isinstance(row.get("scope_json"), dict) else None,
            last_heartbeat_at=row.get("last_heartbeat_at"),
            cancel_requested_at=row.get("cancel_requested_at"),
        )
        for row in rows
    ]


def _active_export_task_blockers() -> list[OperationBlocker]:
    tasks = list_tasks(kinds={"export"}, statuses=set(ACTIVE_TASK_STATUSES))
    return [
        OperationBlocker(
            operation=TASK_KIND_DATABASE_EXPORT,
            reason="active_database_export",
            task_id=task.task_id,
            status=task.status,
        )
        for task in tasks
    ]


def _active_exclusive_operation_blockers() -> list[OperationBlocker]:
    with _EXCLUSIVE_DB_OPERATION_LOCK:
        active = dict(_active_exclusive_db_operation) if _active_exclusive_db_operation else None
    if active is None:
        return []
    return [
        OperationBlocker(
            operation=active["kind"],
            reason="active_exclusive_database_operation",
            task_id=active["operation_id"],
            status="running",
        )
    ]


def _active_database_user_blockers(
    db: Any,
    *,
    requesting_user_id: str | None = None,
) -> list[OperationBlocker]:
    active_database = db.db_path.name
    active_users = get_active_users_for_database(
        active_database=active_database,
        exclude_user_id=requesting_user_id,
    )
    if not active_users:
        return []
    sorted_usernames = sorted(
        {record.username for record in active_users if record.username}
    )
    return [
        OperationBlocker(
            operation="database_switch",
            reason="active_database_users",
            status="active",
            scope={
                "active_database": active_database,
                "active_user_count": len(sorted_usernames),
            },
            usernames=sorted_usernames,
        )
    ]


def assert_can_start_folder_upload(db: Any) -> None:
    blockers = _active_exclusive_operation_blockers()
    if blockers:
        raise OperationAdmissionError(
            operation=TASK_KIND_FOLDER_UPLOAD,
            message="Cannot start folder upload while an exclusive database operation is running.",
            blockers=blockers,
        )


def assert_can_start_derived_task(db: Any, *, task_kind: str) -> None:
    blockers = _active_exclusive_operation_blockers()
    if blockers:
        raise OperationAdmissionError(
            operation=task_kind,
            message="Cannot start derived task while an exclusive database operation is running.",
            blockers=blockers,
        )


def assert_can_switch_or_delete_database(
    db: Any,
    *,
    operation: str,
    requesting_user_id: str | None = None,
) -> None:
    db.reconcile_stale_upload_tasks()
    blockers = [
        *(
            _active_database_user_blockers(
                db,
                requesting_user_id=requesting_user_id,
            )
            if operation == "database_switch"
            else []
        ),
        *_active_folder_upload_blockers(db),
        *_active_derived_task_blockers(db),
        *_active_export_task_blockers(),
        *_active_exclusive_operation_blockers(),
    ]
    if blockers:
        raise OperationAdmissionError(
            operation=operation,
            message=(
                "Cannot continue while active users, uploads, derived tasks, export, "
                "or other exclusive database operations are active."
            ),
            blockers=blockers,
        )


def assert_can_start_database_export() -> None:
    blockers = _active_exclusive_operation_blockers()
    if blockers:
        raise OperationAdmissionError(
            operation=TASK_KIND_DATABASE_EXPORT,
            message="Cannot start database export while an exclusive database operation is running.",
            blockers=blockers,
        )


@contextmanager
def exclusive_database_operation(kind: str) -> Any:
    """Hold an exclusive DB operation slot for create/switch/delete workflows."""
    if kind not in DATABASE_EXCLUSIVE_OPERATION_KINDS:
        msg = f"Unsupported exclusive database operation kind: {kind}"
        raise ValueError(msg)
    operation_id = threading.current_thread().name
    with _EXCLUSIVE_DB_OPERATION_LOCK:
        global _active_exclusive_db_operation
        if _active_exclusive_db_operation is not None:
            active = dict(_active_exclusive_db_operation)
            blockers = [
                OperationBlocker(
                    operation=active["kind"],
                    reason="active_exclusive_database_operation",
                    task_id=active["operation_id"],
                    status="running",
                )
            ]
            raise OperationAdmissionError(
                operation=kind,
                message="Cannot continue while another exclusive database operation is running.",
                blockers=blockers,
            )
        _active_exclusive_db_operation = {
            "kind": kind,
            "operation_id": operation_id,
        }
    try:
        yield
    finally:
        with _EXCLUSIVE_DB_OPERATION_LOCK:
            if _active_exclusive_db_operation is not None:
                _active_exclusive_db_operation = None
