"""Validate saved schedule rows before schedule-driven damage calculation."""

from __future__ import annotations

from typing import Any

from server.models.damage import DamageFailureIssue, DamageFailureReport


def _event_display_name(row: dict[str, Any]) -> str:
    rsp_event_name = str(row.get("rsp_event_name") or "").strip()
    if rsp_event_name:
        return rsp_event_name
    rsp_file_name = str(row.get("rsp_file_name") or "").strip()
    if rsp_file_name:
        return rsp_file_name
    return str(row.get("event_id") or "")


def _is_scheduled_row(row: dict[str, Any]) -> bool:
    return bool(str(row.get("pattern") or "").strip())


def validate_schedule_for_damage(preview: dict[str, Any]) -> DamageFailureReport | None:
    """Return a failure report when saved schedule rows cannot run damage calculation."""
    event_rows: list[dict[str, Any]] = list(preview.get("event_rows") or [])
    issues: list[DamageFailureIssue] = []

    for row in event_rows:
        if not _is_scheduled_row(row):
            continue

        event_id = str(row.get("event_id") or "")
        event_name = _event_display_name(row)
        if row.get("repeats") is None:
            issues.append(
                DamageFailureIssue(
                    event_id=event_id or None,
                    event_name=event_name or None,
                    field="repeats",
                    code="blank_repeats",
                    message="Repeats is required for scheduled events",
                )
            )
        if row.get("weight") is None:
            issues.append(
                DamageFailureIssue(
                    event_id=event_id or None,
                    event_name=event_name or None,
                    field="weight",
                    code="blank_weight",
                    message="Weight is required for scheduled events",
                )
            )

    if not issues:
        return None
    return DamageFailureReport(
        summary="Schedule validation failed",
        issues=issues,
    )
