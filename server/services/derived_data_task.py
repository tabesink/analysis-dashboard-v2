"""Derived-data task orchestration helpers."""

from __future__ import annotations

from typing import Any

from server.models.derived_data_task import DerivedTaskStatusEvent
from server.upload.task_kinds import (
    ACTIVE_TASK_STATUSES as ACTIVE_DERIVED_DATA_STATUSES,
    DERIVED_DATA_TASK_KINDS,
    TASK_KIND_CHANNEL_REPROCESS,
    TASK_KIND_DAMAGE_CALCULATION,
    TASK_KIND_FOLDER_UPLOAD,
)


def build_reuse_active_derived_data_task_response(
    existing: dict[str, Any],
) -> dict[str, Any]:
    """Return a start response that reuses an active derived-data task."""
    task_kind = str(existing.get("task_kind") or TASK_KIND_CHANNEL_REPROCESS)
    return {
        "task_id": str(existing["task_id"]),
        "task_kind": task_kind,
        "reused_existing_task": True,
    }


def build_derived_task_status_event(task_id: str, row: dict[str, Any]) -> DerivedTaskStatusEvent:
    """Build a lean derived-data polling payload from a task row."""
    raw_result = row.get("result_json")
    result = raw_result if isinstance(raw_result, dict) else None
    return DerivedTaskStatusEvent(
        task_id=str(row.get("task_id") or task_id),
        task_kind=str(row.get("task_kind") or TASK_KIND_CHANNEL_REPROCESS),  # type: ignore[arg-type]
        status=str(row.get("status") or "queued"),
        phase=str(row.get("phase") or "queued"),
        sub_phase=row.get("sub_phase"),  # type: ignore[arg-type]
        progress_message=row.get("progress_message"),  # type: ignore[arg-type]
        completed_events=int(row.get("completed_events") or 0),
        total_events=int(row.get("total_events") or 0),
        current_event=row.get("current_event"),  # type: ignore[arg-type]
        error=row.get("error"),  # type: ignore[arg-type]
        result=result,
    )
