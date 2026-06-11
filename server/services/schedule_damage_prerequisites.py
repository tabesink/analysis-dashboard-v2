"""Check raw load-history and cross-plot prerequisites for damage calculation."""

from __future__ import annotations

from typing import Any

from server.models.damage import DamageFailureIssue, DamageFailureReport


def _is_scheduled_row(row: dict[str, Any]) -> bool:
    return bool(str(row.get("pattern") or "").strip())


def _event_display_name(row: dict[str, Any]) -> str:
    rsp_event_name = str(row.get("rsp_event_name") or "").strip()
    if rsp_event_name:
        return rsp_event_name
    rsp_file_name = str(row.get("rsp_file_name") or "").strip()
    if rsp_file_name:
        return rsp_file_name
    return str(row.get("event_id") or "")


def check_damage_prerequisites(
    db: Any,
    *,
    program_id: str,
    version: str,
    preview: dict[str, Any],
) -> DamageFailureReport | None:
    """Return a prerequisite report when derived data is missing or stale."""
    event_rows: list[dict[str, Any]] = list(preview.get("event_rows") or [])
    scheduled_rows = [row for row in event_rows if _is_scheduled_row(row)]
    if not scheduled_rows:
        return DamageFailureReport(
            summary="Damage calculation prerequisites are not met",
            issues=[
                DamageFailureIssue(
                    field="schedulePattern",
                    code="no_scheduled_events",
                    message="No scheduled events are available for damage calculation",
                )
            ],
        )

    issues: list[DamageFailureIssue] = []
    for row in scheduled_rows:
        event_id = str(row["event_id"])
        event_name = _event_display_name(row)
        derived = db.get_event_derived_data(event_id)
        if derived is None or str(derived.get("measurements_status")) != "current":
            issues.append(
                DamageFailureIssue(
                    event_id=event_id,
                    event_name=event_name,
                    field="event_id",
                    code="missing_raw_load_histories",
                    message=(
                        f"Raw load histories are missing or stale for {event_id}. "
                        "Assign channels or finish channel reprocess first."
                    ),
                )
            )
        if derived is None or str(derived.get("lttb_status")) != "current":
            issues.append(
                DamageFailureIssue(
                    event_id=event_id,
                    event_name=event_name,
                    field="event_id",
                    code="missing_cross_plot_data",
                    message=(
                        f"Cross-plot data is missing or stale for {event_id}. "
                        "Assign channels or finish channel reprocess first."
                    ),
                )
            )

    if not issues:
        return None
    return DamageFailureReport(
        summary="Damage calculation prerequisites are not met",
        issues=issues,
    )
