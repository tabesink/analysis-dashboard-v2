"""Post-upload precompute orchestration for program/version derived data."""

from __future__ import annotations

import json
from typing import Any, Literal

from server.services.schedule_damage_prerequisites import check_damage_prerequisites
from server.services.scope_damage_repair import assess_scope_damage_repair_state

PostUploadPrecomputeAction = Literal[
    "no_op",
    "blocked",
    "start_damage_calculation",
    "reuse_active_task",
    "rescale_scheduled_damage",
]


def decide_after_channel_reprocess_completion(
    db: Any,
    *,
    program_id: str,
    version: str,
    user_id: str,
    damage_service: Any,
) -> dict[str, Any]:
    """Decide whether to start damage calculation after channel reprocess completes."""
    active_schedule = db.get_active_durability_schedule(program_id, version)
    if active_schedule is None:
        return {"action": "no_op", "reason": "no_active_schedule"}

    preview = json.loads(str(active_schedule["parse_preview_json"]))
    repair_state = assess_scope_damage_repair_state(
        db,
        damage_service.query_service,
        program_id=program_id,
        version=version,
        preview=preview,
    )
    if repair_state == "complete":
        return {"action": "no_op", "reason": "damage_current"}

    prerequisite_report = check_damage_prerequisites(
        db,
        program_id=program_id,
        version=version,
        preview=preview,
    )
    if prerequisite_report is not None:
        return {
            "action": "blocked",
            "damage_prerequisite_report": prerequisite_report.model_dump(),
        }

    start = damage_service._start_damage_calculation_task(
        program_id=program_id,
        version=version,
        user_id=user_id,
        active_schedule=active_schedule,
        preview=preview,
        reuse_task_kinds=frozenset({"damage_calculation"}),
    )
    if start.get("reused_existing_task"):
        return {
            "action": "reuse_active_task",
            "task_id": start["task_id"],
            "task_kind": start["task_kind"],
            "reused_existing_task": True,
        }
    return {
        "action": "start_damage_calculation",
        "damage_task_id": start["task_id"],
        "task_id": start["task_id"],
        "task_kind": start["task_kind"],
        "reused_existing_task": False,
    }


def decide_after_schedule_save(
    db: Any,
    *,
    program_id: str,
    version: str,
    user_id: str,
    active_schedule: dict[str, Any],
    damage_service: Any,
    previous_preview: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Decide whether to start damage calculation after schedule data is persisted."""
    preview = json.loads(str(active_schedule["parse_preview_json"]))
    prerequisite_report = check_damage_prerequisites(
        db,
        program_id=program_id,
        version=version,
        preview=preview,
    )
    if prerequisite_report is not None:
        return {
            "action": "blocked",
            "damage_prerequisite_report": prerequisite_report.model_dump(),
        }

    from server.services.schedule_damage_rescale import (
        assess_rescale_eligibility,
        is_schedule_scaling_only_change,
        rescale_schedule_damage,
    )

    if is_schedule_scaling_only_change(previous_preview, preview):
        eligible, _ineligible_reason = assess_rescale_eligibility(
            db,
            damage_service.query_service,
            program_id=program_id,
            version=version,
            preview=preview,
        )
        if eligible:
            result = rescale_schedule_damage(
                db,
                active_schedule=active_schedule,
                preview=preview,
            )
            return {
                "action": "rescale_scheduled_damage",
                "updated_rows": result["updated_rows"],
            }

    start = damage_service._start_damage_calculation_task(
        program_id=program_id,
        version=version,
        user_id=user_id,
        active_schedule=active_schedule,
        preview=preview,
        reuse_task_kinds=frozenset({"channel_reprocess", "damage_calculation"}),
    )
    if start.get("reused_existing_task"):
        return {
            "action": "reuse_active_task",
            "task_id": start["task_id"],
            "task_kind": start["task_kind"],
            "reused_existing_task": True,
        }
    return {
        "action": "start_damage_calculation",
        "damage_task_id": start["task_id"],
        "task_id": start["task_id"],
        "task_kind": start["task_kind"],
        "reused_existing_task": False,
    }


def decide_after_inspect_damage_access(
    db: Any,
    *,
    program_id: str,
    version: str,
    user_id: str,
    damage_service: Any,
) -> dict[str, Any]:
    """Decide whether to backfill missing persisted damage after Inspect Damage access."""
    active_schedule = db.get_active_durability_schedule(program_id, version)
    if active_schedule is None:
        return {"action": "no_op", "reason": "no_active_schedule"}

    preview = json.loads(str(active_schedule["parse_preview_json"]))
    repair_state = assess_scope_damage_repair_state(
        db,
        damage_service.query_service,
        program_id=program_id,
        version=version,
        preview=preview,
    )
    if repair_state == "complete":
        return {"action": "no_op", "reason": "damage_current"}
    if repair_state == "stale_only":
        return {"action": "no_op", "reason": "persisted_damage_exists"}

    prerequisite_report = check_damage_prerequisites(
        db,
        program_id=program_id,
        version=version,
        preview=preview,
    )
    if prerequisite_report is not None:
        return {
            "action": "blocked",
            "damage_prerequisite_report": prerequisite_report.model_dump(),
        }

    start = damage_service._start_damage_calculation_task(
        program_id=program_id,
        version=version,
        user_id=user_id,
        active_schedule=active_schedule,
        preview=preview,
        reuse_task_kinds=frozenset({"damage_calculation"}),
    )
    if start.get("reused_existing_task"):
        return {
            "action": "reuse_active_task",
            "task_id": start["task_id"],
            "task_kind": start["task_kind"],
            "reused_existing_task": True,
        }
    return {
        "action": "start_damage_calculation",
        "damage_task_id": start["task_id"],
        "task_id": start["task_id"],
        "task_kind": start["task_kind"],
        "reused_existing_task": False,
    }


def inspect_precompute_decision_to_response(decision: dict[str, Any]) -> dict[str, Any]:
    """Convert an inspect-access precompute decision into API response fields."""
    extension: dict[str, Any] = {}
    action = decision.get("action")
    if action in {"start_damage_calculation", "reuse_active_task"}:
        extension["damage_task_id"] = decision.get("damage_task_id") or decision.get("task_id")
        extension["task_kind"] = decision.get("task_kind") or "damage_calculation"
        if action == "reuse_active_task":
            extension["reused_existing_task"] = True
        else:
            extension["reused_existing_task"] = decision.get("reused_existing_task", False)
    elif action == "blocked":
        extension["damage_prerequisite_report"] = decision["damage_prerequisite_report"]
    return extension


def schedule_precompute_decision_to_extension(decision: dict[str, Any]) -> dict[str, Any]:
    """Convert a schedule-save precompute decision into API response fields."""
    extension: dict[str, Any] = {}
    action = decision.get("action")
    if action in {"start_damage_calculation", "reuse_active_task"}:
        extension["damage_task_id"] = decision.get("damage_task_id") or decision.get("task_id")
    elif action == "blocked":
        extension["damage_prerequisite_report"] = decision["damage_prerequisite_report"]
    return extension


def channel_reprocess_precompute_to_result(decision: dict[str, Any]) -> dict[str, Any]:
    """Convert a channel-reprocess follow-up decision into task result fields."""
    follow_up = schedule_precompute_decision_to_extension(decision)
    if not follow_up:
        return {}
    return {"precompute_follow_up": follow_up}



def run_after_channel_reprocess_completion(
    db: Any,
    cache: Any,
    settings: Any,
    *,
    program_id: str,
    version: str,
    user_id: str,
) -> dict[str, Any]:
    """Apply post-channel-reprocess precompute for a completed derived-data task."""
    from server.services.damage_calculation_task import DamageCalculationTaskService
    from server.services.query import QueryService

    query_service = QueryService(db, cache, settings)
    damage_service = DamageCalculationTaskService(db, query_service)
    return decide_after_channel_reprocess_completion(
        db,
        program_id=program_id,
        version=version,
        user_id=user_id,
        damage_service=damage_service,
    )
