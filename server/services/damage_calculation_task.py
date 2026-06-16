"""Async schedule-driven damage calculation task orchestration."""

from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Any

from server.services.damage_calculation_progress import calculating_load_history_damage_message
from server.services.fatigue_damage import ChannelSeries, FatigueDamageCalculator
from server.services.schedule_damage_calculation import (
    compute_scheduled_damage,
    scheduled_event_rows,
)
from server.services.schedule_damage_prerequisites import check_damage_prerequisites
from server.services.schedule_damage_validation import validate_schedule_for_damage
from server.upload.task_kinds import (
    DERIVED_DATA_TASK_KINDS,
    TASK_KIND_DAMAGE_CALCULATION,
)

logger = logging.getLogger(__name__)

UPLOAD_TASK_TTL_MINUTES = 30


class DamageCalculationTaskService:
    """Start and run schedule-driven damage calculation derived-data tasks."""

    def __init__(
        self,
        db: Any,
        query_service: Any,
        calculator: Any | None = None,
    ) -> None:
        self.db = db
        self.query_service = query_service
        self.calculator = calculator or FatigueDamageCalculator()

    def start_for_scope(
        self,
        *,
        program_id: str,
        version: str,
        user_id: str,
    ) -> dict[str, Any]:
        """Start or reuse damage calculation for the active schedule in a scope."""
        active_schedule = self.db.get_active_durability_schedule(program_id, version)
        if active_schedule is None:
            raise ValueError(
                f"No active durability schedule for {program_id}/{version}",
            )
        return self.maybe_start_after_schedule_change(
            program_id=program_id,
            version=version,
            user_id=user_id,
            active_schedule=active_schedule,
        )

    def maybe_start_after_schedule_change(
        self,
        *,
        program_id: str,
        version: str,
        user_id: str,
        active_schedule: dict[str, Any],
    ) -> dict[str, Any]:
        """Return either a damage task start payload or a prerequisite report."""
        preview = json.loads(str(active_schedule["parse_preview_json"]))
        prerequisite_report = check_damage_prerequisites(
            self.db,
            program_id=program_id,
            version=version,
            preview=preview,
        )
        if prerequisite_report is not None:
            return {"damage_prerequisite_report": prerequisite_report.model_dump()}

        start = self._start_damage_calculation_task(
            program_id=program_id,
            version=version,
            user_id=user_id,
            active_schedule=active_schedule,
            preview=preview,
        )
        return {"damage_task_id": start["task_id"], **start}

    def _start_damage_calculation_task(
        self,
        *,
        program_id: str,
        version: str,
        user_id: str,
        active_schedule: dict[str, Any],
        preview: dict[str, Any],
        reuse_task_kinds: frozenset[str] | None = None,
    ) -> dict[str, Any]:
        self.db.delete_expired_upload_tasks()
        existing = self.db.find_active_derived_data_task(program_id, version)
        if existing is not None:
            allowed_kinds = reuse_task_kinds or DERIVED_DATA_TASK_KINDS
            if str(existing.get("task_kind") or "") not in allowed_kinds:
                existing = None
        if existing is not None:
            from server.services.derived_data_task import build_reuse_active_derived_data_task_response

            return build_reuse_active_derived_data_task_response(existing)

        rows = scheduled_event_rows(preview)
        task_id = uuid.uuid4().hex
        self.db.create_upload_task(
            task_id=task_id,
            created_by_user_id=user_id,
            total_events=len(rows),
            ttl_minutes=UPLOAD_TASK_TTL_MINUTES,
            task_kind=TASK_KIND_DAMAGE_CALCULATION,
            phase="validating",
            scope={"program_id": program_id, "version": version},
        )

        def _run() -> None:
            self._run_damage_calculation_task(
                task_id=task_id,
                program_id=program_id,
                version=version,
                active_schedule=active_schedule,
                preview=preview,
            )

        threading.Thread(target=_run, daemon=True).start()
        return {
            "task_id": task_id,
            "task_kind": TASK_KIND_DAMAGE_CALCULATION,
            "reused_existing_task": False,
        }

    def _run_damage_calculation_task(
        self,
        *,
        task_id: str,
        program_id: str,
        version: str,
        active_schedule: dict[str, Any],
        preview: dict[str, Any],
    ) -> None:
        self.db.update_upload_task(task_id, status="running", phase="validating")
        validation_report = validate_schedule_for_damage(preview)
        if validation_report is not None:
            self.db.update_upload_task(
                task_id,
                status="failed",
                phase="failed",
                sub_phase=None,
                progress_message=None,
                current_event=None,
                error=validation_report.summary,
                result={"failure_report": validation_report.model_dump()},
            )
            return

        rows = scheduled_event_rows(preview)
        multiplier = float(preview.get("multiplier") or 1.0)
        schedule_id = int(active_schedule["schedule_id"])
        schedule_sha256 = str(active_schedule["schedule_sha256"])
        total_events = len(rows)
        completed = 0

        try:
            self.db.update_upload_task(
                task_id,
                phase="calculating",
                total_events=total_events,
                completed_events=0,
            )
            for row in rows:
                event_id = str(row["event_id"])
                repeats = int(row["repeats"])
                weight = float(row["weight"])
                self.db.update_upload_task(
                    task_id,
                    current_event=event_id,
                    completed_events=completed,
                )
                series_items = self.query_service.get_damage_channel_series([event_id])
                for item in series_items:
                    channel_key = str(item["channel_key"])
                    channel_name = str(item["channel_name"])
                    self.db.update_upload_task(
                        task_id,
                        progress_message=calculating_load_history_damage_message(
                            event_id,
                            channel_name,
                        ),
                    )
                    if item.get("status") == "unavailable":
                        self.db.upsert_event_channel_damage(
                            event_id=event_id,
                            channel_key=channel_key,
                            channel_name=channel_name,
                            channel_unit=item.get("unit"),
                            base_damage=None,
                            scheduled_damage=None,
                            repeats=repeats,
                            weight=weight,
                            multiplier=multiplier,
                            schedule_id=schedule_id,
                            schedule_sha256=schedule_sha256,
                            status="unavailable",
                            error=str(item.get("error") or "Damage channel is unavailable"),
                        )
                        continue

                    result = self.calculator.calculate_channel(
                        ChannelSeries(
                            channel_key=channel_key,
                            channel_name=channel_name,
                            unit=item.get("unit"),
                            values=item["values"],
                        )
                    )
                    if result.status != "ok" or result.damage is None:
                        self.db.upsert_event_channel_damage(
                            event_id=event_id,
                            channel_key=channel_key,
                            channel_name=channel_name,
                            channel_unit=item.get("unit"),
                            base_damage=None,
                            scheduled_damage=None,
                            repeats=repeats,
                            weight=weight,
                            multiplier=multiplier,
                            schedule_id=schedule_id,
                            schedule_sha256=schedule_sha256,
                            status="error",
                            error=result.error or "Damage calculation failed",
                        )
                        continue

                    scheduled_damage = compute_scheduled_damage(
                        result.damage,
                        repeats=repeats,
                        weight=weight,
                        multiplier=multiplier,
                    )
                    self.db.upsert_event_channel_damage(
                        event_id=event_id,
                        channel_key=channel_key,
                        channel_name=channel_name,
                        channel_unit=item.get("unit"),
                        base_damage=result.damage,
                        scheduled_damage=scheduled_damage,
                        repeats=repeats,
                        weight=weight,
                        multiplier=multiplier,
                        schedule_id=schedule_id,
                        schedule_sha256=schedule_sha256,
                        status="current",
                    )
                completed += 1
                self.db.update_upload_task(task_id, completed_events=completed)

            self.db.update_upload_task(
                task_id,
                status="completed",
                phase="completed",
                sub_phase=None,
                progress_message=None,
                current_event=None,
                completed_events=completed,
                total_events=total_events,
                result={"processed_events": completed},
            )
        except Exception as exc:  # pragma: no cover
            logger.exception("Damage calculation task failed unexpectedly: %s", task_id)
            failure_report = {
                "summary": "Damage calculation task failed unexpectedly",
                "issues": [
                    {
                        "field": "event_id",
                        "code": "task_exception",
                        "message": str(exc),
                    }
                ],
            }
            self.db.update_upload_task(
                task_id,
                status="failed",
                phase="failed",
                sub_phase=None,
                progress_message=None,
                current_event=None,
                error=str(exc),
                result={"failure_report": failure_report},
            )
