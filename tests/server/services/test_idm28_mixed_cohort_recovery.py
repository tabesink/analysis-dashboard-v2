"""End-to-end recovery tests for mixed cohort Inspect Damage repair (IDM-28-05)."""

from __future__ import annotations

import json
import time

from server.services.damage_inspect import build_damage_inspect_response
from server.services.ingestion import IngestionService
from server.services.post_upload_precompute import decide_after_inspect_damage_access
from server.services.query import QueryService
from tests.server.services.test_channel_reprocess_per_event_headers import (
    _channel_map_save_entries,
)
from tests.server.services.test_damage_calculation_task import (
    _make_damage_service,
    _sample_sch_bytes,
)
from tests.server.services.test_damage_query_service import (
    _channel_map_yaml,
    _csv_with_24_abbrev_damage_channels,
    _csv_with_24_damage_channels,
)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _mixed_schedule_preview() -> dict:
    return {
        "multiplier": 2.0,
        "entries": [
            {"pattern": "moog", "repeats": 5, "weight": 0.5},
            {"pattern": "abbrev", "repeats": 5, "weight": 0.5},
        ],
        "event_rows": [
            {
                "event_id": "moog_event",
                "rsp_file_name": "moog_event.rsp",
                "rsp_event_name": "moog_event",
                "pattern": "moog",
                "repeats": 5,
                "weight": 0.5,
                "schedule_sequence": 1,
            },
            {
                "event_id": "abbrev_event",
                "rsp_file_name": "abbrev_event.rsp",
                "rsp_event_name": "abbrev_event",
                "pattern": "abbrev",
                "repeats": 5,
                "weight": 0.5,
                "schedule_sequence": 2,
            },
        ],
    }


def _attach_mixed_schedule(test_database, test_settings, *, program_id: str, uploader_id: str) -> None:
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parsed = DurabilityScheduleParser().parse_bytes(_sample_sch_bytes())
    storage.attach_schedule(
        program_id=program_id,
        version="V1",
        source_filename="recovery.sch",
        content=_sample_sch_bytes(),
        parsed=parsed,
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    test_database.update_durability_schedule_parse_preview(
        int(active["schedule_id"]),
        json.dumps(_mixed_schedule_preview()),
    )


def _seed_partial_error_damage(test_database) -> None:
    for event_id, status, error in (
        ("moog_event", "current", None),
        ("abbrev_event", "error", "No measurements found for mapped channel"),
    ):
        test_database.upsert_event_channel_damage(
            event_id=event_id,
            channel_key="bj_x_force",
            channel_name="BJ X Force",
            channel_unit="N",
            base_damage=0.01 if status == "current" else None,
            scheduled_damage=0.05 if status == "current" else None,
            repeats=5,
            weight=0.5,
            multiplier=2.0,
            schedule_id=1,
            schedule_sha256="mixed-recovery",
            status=status,
            error=error,
        )


def test_mixed_cohort_recovery_reprocess_damage_and_inspect(
    test_database,
    test_cache,
    test_settings,
) -> None:
    """Recovery: index map save → reprocess → damage recalc → displayable inspect rows."""
    program_id = "P-IDM28-RECOVERY"
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("idm28_recovery")
    uploader_id = uploader["id"]

    assert service.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader_id,
        metadata={"job_number": "JOB-RECOVERY", "work_order": "WO-RECOVERY"},
    ).success
    assert service.ingest(
        files=[("abbrev_event.csv", _csv_with_24_abbrev_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader_id,
        metadata={"job_number": "JOB-RECOVERY", "work_order": "WO-RECOVERY"},
    ).success

    reprocess = service.save_channel_map_and_process_artifacts(
        program_id=program_id,
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader_id,
    )
    assert reprocess["failed_count"] == 0

    _attach_mixed_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    _seed_partial_error_damage(test_database)

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )
    assert decision["action"] == "start_damage_calculation"

    task_id = decision["damage_task_id"]
    deadline = time.monotonic() + 30.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None
    assert task["status"] == "completed", task.get("error")

    query = QueryService(test_database, test_cache, test_settings)
    inspect = build_damage_inspect_response(
        test_database,
        query,
        event_ids=["moog_event", "abbrev_event"],
    )
    assert inspect.scopes[0].needs_damage_repair is False
    for event_id in ("moog_event", "abbrev_event"):
        row = next(item for item in inspect.rows if item.event_id == event_id)
        current_cells = [cell for cell in row.damages.values() if cell.status == "current"]
        assert len(current_cells) == 12
        assert all(cell.damage is not None for cell in current_cells)
