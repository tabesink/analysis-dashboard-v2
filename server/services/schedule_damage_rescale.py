"""Rescale persisted scheduled damage when only schedule scaling inputs change."""

from __future__ import annotations

from typing import Any

from server.services.schedule_damage_calculation import (
    compute_scheduled_damage,
    scheduled_event_rows,
)
from server.services.schedule_damage_validation import validate_schedule_for_damage


def scheduled_event_matching(preview: dict[str, Any]) -> dict[str, str]:
    """Return event_id -> pattern for rows that participate in schedule-driven damage."""
    matching: dict[str, str] = {}
    for row in preview.get("event_rows") or []:
        pattern = str(row.get("pattern") or "").strip()
        if not pattern:
            continue
        matching[str(row["event_id"])] = pattern
    return matching


def scaling_by_event(preview: dict[str, Any]) -> dict[str, tuple[int, float]]:
    """Return event_id -> (repeats, weight) for scheduled rows."""
    scaling: dict[str, tuple[int, float]] = {}
    for row in preview.get("event_rows") or []:
        if not str(row.get("pattern") or "").strip():
            continue
        scaling[str(row["event_id"])] = (int(row["repeats"]), float(row["weight"]))
    return scaling


def is_schedule_scaling_only_change(
    previous_preview: dict[str, Any] | None,
    new_preview: dict[str, Any],
) -> bool:
    """Return True when event matching is unchanged and scaling inputs differ."""
    if previous_preview is None:
        return False

    if scheduled_event_matching(previous_preview) != scheduled_event_matching(new_preview):
        return False

    previous_multiplier = float(previous_preview.get("multiplier") or 1.0)
    new_multiplier = float(new_preview.get("multiplier") or 1.0)
    previous_scaling = scaling_by_event(previous_preview)
    new_scaling = scaling_by_event(new_preview)
    if previous_multiplier == new_multiplier and previous_scaling == new_scaling:
        return False
    return True


def assess_rescale_eligibility(
    db: Any,
    query_service: Any,
    *,
    program_id: str,
    version: str,
    preview: dict[str, Any],
) -> tuple[bool, str | None]:
    """Return whether persisted base damage can be reused for a rescale-only update."""
    rows = db.list_event_channel_damage_for_program_version(program_id, version)
    row_map = {(str(row["event_id"]), str(row["channel_key"])): row for row in rows}

    for event_row in scheduled_event_rows(preview):
        event_id = str(event_row["event_id"])
        for item in query_service.get_damage_channel_series([event_id]):
            channel_key = str(item["channel_key"])
            row = row_map.get((event_id, channel_key))
            if row is None or row.get("base_damage") is None:
                return False, "missing_base_damage"

            status = str(row.get("status") or "")
            if status == "error":
                return False, "error_base_damage"

            stale_reason = str(row.get("stale_reason") or "")
            if status == "stale" and stale_reason not in {"", "schedule_changed"}:
                return False, "stale_base_damage"

    return True, None


def rescale_schedule_damage(
    db: Any,
    *,
    active_schedule: dict[str, Any],
    preview: dict[str, Any],
) -> dict[str, Any]:
    """Update scheduled damage from current base damage and new scaling inputs."""
    validation_report = validate_schedule_for_damage(preview)
    if validation_report is not None:
        raise ValueError(validation_report.summary)

    multiplier = float(preview.get("multiplier") or 1.0)
    schedule_id = int(active_schedule["schedule_id"])
    schedule_sha256 = str(active_schedule["schedule_sha256"])
    scaling_rows = {str(row["event_id"]): row for row in scheduled_event_rows(preview)}
    updated_rows = 0

    for (event_id, _channel_key), row in _rows_for_scheduled_events(db, scaling_rows):
        event_row = scaling_rows[event_id]
        repeats = int(event_row["repeats"])
        weight = float(event_row["weight"])
        base_damage = float(row["base_damage"])
        scheduled_damage = compute_scheduled_damage(
            base_damage,
            repeats=repeats,
            weight=weight,
            multiplier=multiplier,
        )
        db.upsert_event_channel_damage(
            event_id=event_id,
            channel_key=str(row["channel_key"]),
            channel_name=str(row["channel_name"]),
            channel_unit=row.get("channel_unit"),
            base_damage=base_damage,
            scheduled_damage=scheduled_damage,
            repeats=repeats,
            weight=weight,
            multiplier=multiplier,
            schedule_id=schedule_id,
            schedule_sha256=schedule_sha256,
            status="current",
            stale_reason=None,
            error=None,
        )
        updated_rows += 1

    return {"updated_rows": updated_rows}


def _rows_for_scheduled_events(
    db: Any,
    scaling_rows: dict[str, dict[str, Any]],
) -> list[tuple[tuple[str, str], dict[str, Any]]]:
    if not scaling_rows:
        return []

    placeholders = ", ".join("?" for _ in scaling_rows)
    rows = db.read_connection.execute(
        f"""
        SELECT d.*
        FROM event_channel_damage d
        WHERE d.event_id IN ({placeholders})
          AND d.base_damage IS NOT NULL
        ORDER BY d.event_id, d.channel_key
        """,
        list(scaling_rows.keys()),
    ).fetchall()
    columns = [desc[0] for desc in db.read_connection.description]
    result: list[tuple[tuple[str, str], dict[str, Any]]] = []
    for raw in rows:
        row = dict(zip(columns, raw))
        event_id = str(row["event_id"])
        if event_id not in scaling_rows:
            continue
        result.append(((event_id, str(row["channel_key"])), row))
    return result
