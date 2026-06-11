"""End-to-end hardening tests for post-upload precompute idempotency (PPU-27-06)."""

from __future__ import annotations

import json
import time

from server.config import Settings
from server.services.post_upload_precompute import (
    decide_after_channel_reprocess_completion,
    decide_after_inspect_damage_access,
    decide_after_schedule_save,
)
from tests.server.services.test_channel_reprocess_task import (
    _channel_map_save_entries,
    _make_ingestion_service,
)
from tests.server.services.test_damage_calculation_task import (
    _csv_with_24_damage_channels,
    _make_damage_service,
    _sample_sch_bytes,
    _seed_program_with_channels,
)


def _count_damage_tasks(test_database, program_id: str) -> int:
    row = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    return int(row[0])


def _wait_for_task(test_database, task_id: str, *, timeout_seconds: float = 20.0) -> dict:
    deadline = time.monotonic() + timeout_seconds
    task = None
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            return task
        time.sleep(0.05)
    raise TimeoutError(f"Task {task_id} did not finish within {timeout_seconds}s")


def _attach_sample_schedule(
    test_database,
    test_settings: Settings,
    *,
    program_id: str,
    uploader_id: str,
) -> dict:
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parsed = DurabilityScheduleParser().parse_bytes(_sample_sch_bytes())
    storage.attach_schedule(
        program_id=program_id,
        version="V1",
        source_filename="route.sch",
        content=_sample_sch_bytes(),
        parsed=parsed,
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    return active


def test_repeated_channel_reprocess_completion_decisions_do_not_duplicate_damage_tasks(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-PPU-06-CHANNEL-IDEM"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="channel_reprocess_required",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    first = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )
    second = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert first["action"] == "start_damage_calculation"
    assert second["action"] == "reuse_active_task"
    assert second["task_id"] == first["damage_task_id"]
    assert _count_damage_tasks(test_database, program_id) == 1


def test_repeated_inspect_damage_access_decisions_do_not_duplicate_damage_tasks(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-PPU-06-INSPECT-IDEM"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    first = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )
    second = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert first["action"] == "start_damage_calculation"
    assert second["action"] == "reuse_active_task"
    assert second["task_id"] == first["damage_task_id"]
    assert _count_damage_tasks(test_database, program_id) == 1


def test_channel_assignment_before_schedule_starts_damage_after_schedule_save(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("ppu06_channel_first")
    uploader_id = uploader["id"]
    program_id = "P-PPU-06-CHANNEL-FIRST"
    service.ingest(
        files=[("pattern_a_event.csv", _csv_with_24_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader_id,
        metadata={"job_number": "JOB-CF", "work_order": "WO-CF"},
    )

    start = service.start_channel_reprocess_from_save(
        program_id=program_id,
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader_id,
    )
    channel_task = _wait_for_task(test_database, start["task_id"])
    assert channel_task["status"] == "completed", channel_task.get("error")
    assert channel_task["result_json"].get("precompute_follow_up") in (None, {})
    assert _count_damage_tasks(test_database, program_id) == 0

    active = _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    decision = decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=active,
        damage_service=damage_service,
    )

    assert decision["action"] == "start_damage_calculation"
    assert _count_damage_tasks(test_database, program_id) == 1
    damage_task = _wait_for_task(test_database, decision["damage_task_id"])
    assert damage_task["status"] == "completed", damage_task.get("error")


def test_inspect_damage_repair_workflow_converges_to_current_damage(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from server.services.damage_inspect import build_damage_inspect_response
    from server.services.query import QueryService

    program_id = "P-PPU-06-INSPECT-REPAIR"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    start = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )
    assert start["action"] == "start_damage_calculation"
    damage_task = _wait_for_task(test_database, start["damage_task_id"])
    assert damage_task["status"] == "completed", damage_task.get("error")

    follow_up = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )
    assert follow_up["action"] == "no_op"
    assert follow_up["reason"] == "damage_current"
    assert _count_damage_tasks(test_database, program_id) == 1

    query = QueryService(test_database, test_cache, test_settings)
    inspect = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )
    assert inspect.has_stale_values is False
    current_cells = [
        cell
        for row in inspect.rows
        for cell in row.damages.values()
        if cell.status == "current"
    ]
    assert current_cells


def test_unscheduled_uploaded_events_do_not_receive_damage_rows(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-PPU-06-UNSCHEDULED"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    scheduled_event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    test_database.insert_event(
        event_id="event-unscheduled-extra",
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader_id,
        status="Approved",
        source_file="other_event.csv",
    )
    active = _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    preview = json.loads(str(active["parse_preview_json"]))
    assert any(row["event_id"] == scheduled_event_id for row in preview["event_rows"])
    unscheduled_rows = [
        row for row in preview["event_rows"] if row["event_id"] == "event-unscheduled-extra"
    ]
    assert unscheduled_rows
    assert not str(unscheduled_rows[0].get("pattern") or "").strip()

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=active,
        damage_service=damage_service,
    )
    damage_task = _wait_for_task(test_database, start["damage_task_id"])
    assert damage_task["status"] == "completed", damage_task.get("error")

    scheduled_damage = test_database.list_event_channel_damage_for_program_version(
        program_id,
        "V1",
    )
    scheduled_event_ids = {row["event_id"] for row in scheduled_damage}
    assert scheduled_event_id in scheduled_event_ids
    assert "event-unscheduled-extra" not in scheduled_event_ids
