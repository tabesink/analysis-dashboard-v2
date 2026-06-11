"""Assess whether a program/version scope needs damage recalculation."""

from __future__ import annotations

from typing import Any, Literal

from server.services.schedule_damage_calculation import scheduled_event_rows

ScopeDamageRepairState = Literal["complete", "needs_recalc", "stale_only"]


def assess_scope_damage_repair_state(
    db: Any,
    query_service: Any,
    *,
    program_id: str,
    version: str,
    preview: dict[str, Any],
) -> ScopeDamageRepairState:
    """Return whether scheduled damage is complete, stale-only, or needs recalculation."""
    scheduled = scheduled_event_rows(preview)
    if not scheduled:
        return "complete"

    persisted = db.list_event_channel_damage_for_program_version(program_id, version)
    status_by_key = {
        (str(row["event_id"]), str(row["channel_key"])): str(row.get("status") or "")
        for row in persisted
    }

    has_current = False
    has_stale = False
    has_error = False
    all_current = True

    for event_row in scheduled:
        event_id = str(event_row["event_id"])
        for item in query_service.get_damage_channel_series([event_id]):
            channel_key = str(item["channel_key"])
            status = status_by_key.get((event_id, channel_key))
            if status is None:
                all_current = False
                continue
            if status == "current":
                has_current = True
            elif status == "stale":
                has_stale = True
                all_current = False
            elif status == "error":
                has_error = True
                all_current = False
            else:
                all_current = False

    if all_current:
        return "complete"
    if has_error or (has_current and not all_current):
        return "needs_recalc"
    if has_stale and not has_current and not has_error:
        return "stale_only"
    return "needs_recalc"
