"""Build Inspect Damage responses from persisted event_channel_damage rows."""

from __future__ import annotations
from typing import Any

from server.models.damage import (
    DamageCell,
    DamageChannelMetadata,
    DamageFailureReport,
    DamageInspectResponse,
    DamageInspectRow,
    DamageInspectScopeState,
)


def build_damage_inspect_response(
    db: Any,
    query_service: Any,
    *,
    event_ids: list[str],
    include_all_calculated: bool = False,
) -> DamageInspectResponse:
    """Return persisted damage rows for the requested events without compute-on-read."""
    if include_all_calculated:
        event_ids = db.list_event_ids_with_persisted_damage()
    else:
        event_ids = list(dict.fromkeys(event_ids))

    if not event_ids:
        return DamageInspectResponse(channels=[], rows=[], scopes=[])

    persisted_rows = db.list_event_channel_damage_for_event_ids(event_ids)
    persisted_by_event: dict[str, list[dict[str, Any]]] = {}
    for row in persisted_rows:
        persisted_by_event.setdefault(str(row["event_id"]), []).append(row)

    channels_by_key: dict[str, DamageChannelMetadata] = {}
    rows_by_event: dict[str, DamageInspectRow] = {}
    scope_events: dict[tuple[str, str], list[str]] = {}
    has_stale_values = False

    for event_id in event_ids:
        event = db.get_event(event_id)
        if event is None:
            continue
        program_id = str(event["program_id"])
        version = str(event["version"])
        scope_events.setdefault((program_id, version), []).append(event_id)
        rows_by_event[event_id] = DamageInspectRow(
            event_id=event_id,
            job_number=event.get("job_number"),
            work_order=event.get("work_order"),
            program_id=program_id,
            damages={},
        )

        for persisted in persisted_by_event.get(event_id, []):
            channel_key = str(persisted["channel_key"])
            status = str(persisted["status"])
            if status == "stale":
                has_stale_values = True
            channels_by_key.setdefault(
                channel_key,
                DamageChannelMetadata(
                    channel_key=channel_key,
                    channel_name=str(persisted["channel_name"]),
                    unit=persisted.get("channel_unit"),
                ),
            )
            rows_by_event[event_id].damages[channel_key] = DamageCell(
                damage=persisted.get("scheduled_damage"),
                base_damage=persisted.get("base_damage"),
                status=status,
                error=persisted.get("error"),
                stale_reason=persisted.get("stale_reason"),
            )

    scopes = [
        _build_scope_state(
            db,
            query_service,
            program_id=program_id,
            version=version,
            event_ids=ids,
        )
        for (program_id, version), ids in sorted(scope_events.items())
    ]

    channels = sorted(channels_by_key.values(), key=lambda item: item.channel_key)
    rows = [rows_by_event[event_id] for event_id in event_ids if event_id in rows_by_event]
    return DamageInspectResponse(
        channels=channels,
        rows=rows,
        has_stale_values=has_stale_values,
        scopes=scopes,
    )


def _build_scope_state(
    db: Any,
    query_service: Any,
    *,
    program_id: str,
    version: str,
    event_ids: list[str],
) -> DamageInspectScopeState:
    active_schedule = db.get_active_durability_schedule(program_id, version)
    has_active_schedule = active_schedule is not None
    persisted = db.list_event_channel_damage_for_event_ids(event_ids)
    has_current_results = any(str(row["status"]) == "current" for row in persisted)
    has_stale_results = any(str(row["status"]) == "stale" for row in persisted)

    # Inspect is a strict query path: do not run repair/prerequisite policy checks here.
    # Schedule upload/save owns command decisions and calculation start behavior.
    prerequisite_report: DamageFailureReport | None = None
    can_start_calculation = False
    needs_damage_repair = False
    failure_report = _latest_failure_report(db, program_id=program_id, version=version)
    active_task = db.find_active_derived_data_task(program_id, version)
    active_damage_task_id = (
        str(active_task["task_id"])
        if active_task is not None
        and str(active_task.get("task_kind")) == "damage_calculation"
        else None
    )

    return DamageInspectScopeState(
        program_id=program_id,
        version=version,
        has_current_results=has_current_results,
        has_stale_results=has_stale_results,
        needs_damage_repair=needs_damage_repair,
        has_active_schedule=has_active_schedule,
        can_start_calculation=can_start_calculation,
        prerequisite_report=prerequisite_report,
        failure_report=failure_report,
        active_damage_task_id=active_damage_task_id,
    )


def _latest_failure_report(
    db: Any,
    *,
    program_id: str,
    version: str,
) -> DamageFailureReport | None:
    task = db.find_latest_failed_damage_calculation_task(program_id, version)
    if task is None:
        return None
    result = task.get("result_json") or {}
    raw_report = result.get("failure_report")
    if not isinstance(raw_report, dict):
        return None
    return DamageFailureReport(**raw_report)
