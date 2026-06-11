"""Cross-flow hardening tests for derived-data task orchestration (UP-24-06)."""

from __future__ import annotations

import json
import time

from server.config import Settings
from server.services.derived_data_task import build_reuse_active_derived_data_task_response
from server.services.ingestion import IngestionService
from tests.server.services.test_channel_reprocess_task import (
    _channel_map_save_entries,
    _csv_with_detected_damage_channels,
    _make_ingestion_service,
)
from tests.server.services.test_damage_calculation_task import (
    _make_damage_service,
    _sample_sch_bytes,
    _seed_program_with_channels,
)


def test_build_reuse_active_derived_data_task_response_returns_existing_kind() -> None:
    response = build_reuse_active_derived_data_task_response(
        {
            "task_id": "task-damage-1",
            "task_kind": "damage_calculation",
        }
    )

    assert response == {
        "task_id": "task-damage-1",
        "task_kind": "damage_calculation",
        "reused_existing_task": True,
    }


def test_damage_calculation_reuses_existing_active_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-DMG-REUSE"
    uploader = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
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
        owner_user_id=uploader,
        actor_user_id=uploader,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    first = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )
    second = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )

    assert second["task_id"] == first["damage_task_id"]
    assert second["reused_existing_task"] is True


def test_cross_kind_active_task_reuse_returns_existing_task_kind(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("derived_cross_kind")
    test_database.create_upload_task(
        task_id="active-channel-task",
        created_by_user_id=uploader["id"],
        total_events=2,
        task_kind="channel_reprocess",
        phase="extracting",
        scope={"program_id": "P-CROSS-KIND", "version": "V1"},
    )
    test_database.update_upload_task("active-channel-task", status="running", phase="extracting")

    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parsed = DurabilityScheduleParser().parse_bytes(_sample_sch_bytes())
    storage.attach_schedule(
        program_id="P-CROSS-KIND",
        version="V1",
        source_filename="route.sch",
        content=_sample_sch_bytes(),
        parsed=parsed,
        owner_user_id=uploader["id"],
        actor_user_id=uploader["id"],
    )
    active = test_database.get_active_durability_schedule("P-CROSS-KIND", "V1")
    assert active is not None
    preview = json.loads(str(active["parse_preview_json"]))

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    damage_start = damage_service._start_damage_calculation_task(
        program_id="P-CROSS-KIND",
        version="V1",
        user_id=uploader["id"],
        active_schedule=active,
        preview=preview,
    )

    assert damage_start["task_id"] == "active-channel-task"
    assert damage_start["task_kind"] == "channel_reprocess"
    assert damage_start["reused_existing_task"] is True


def test_folder_upload_tasks_are_not_returned_as_derived_tasks(
    test_database,
) -> None:
    owner = test_database.create_user("folder_upload_owner")
    task_id = "folder-upload-task-001"
    test_database.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=2,
        task_kind="folder_upload",
        scope={"program_id": "P-FOLDER", "version": "V1"},
    )

    active = test_database.find_active_derived_data_task("P-FOLDER", "V1")

    assert active is None


def test_only_one_active_derived_task_row_per_program_version(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("derived_single_active")
    service.ingest(
        files=[("event_single_active.csv", _csv_with_detected_damage_channels())],
        program_id="P-SINGLE-ACTIVE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SINGLE", "work_order": "WO-SINGLE"},
    )

    first = service.start_channel_reprocess_from_save(
        program_id="P-SINGLE-ACTIVE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )
    second = service.start_channel_reprocess_from_save(
        program_id="P-SINGLE-ACTIVE",
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader["id"],
    )

    active_rows = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind IN ('channel_reprocess', 'damage_calculation')
          AND status IN ('queued', 'running')
          AND json_extract_string(scope_json, '$.program_id') = ?
          AND json_extract_string(scope_json, '$.version') = ?
        """,
        ["P-SINGLE-ACTIVE", "V1"],
    ).fetchone()

    assert int(active_rows[0]) == 1
    assert second["task_id"] == first["task_id"]


def test_end_to_end_schedule_damage_persists_inspectable_results(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-E2E-DMG"
    uploader = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    from server.services.damage_inspect import build_damage_inspect_response
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )
    from server.services.query import QueryService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parsed = DurabilityScheduleParser().parse_bytes(_sample_sch_bytes())
    storage.attach_schedule(
        program_id=program_id,
        version="V1",
        source_filename="route.sch",
        content=_sample_sch_bytes(),
        parsed=parsed,
        owner_user_id=uploader,
        actor_user_id=uploader,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )
    task_id = start["damage_task_id"]
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None
    assert task["status"] == "completed", task.get("error")

    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    query = QueryService(test_database, test_cache, test_settings)
    inspect = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    assert inspect.has_stale_values is False
    assert inspect.rows
    current_cells = [
        cell
        for row in inspect.rows
        for cell in row.damages.values()
        if cell.status == "current"
    ]
    assert current_cells
    assert current_cells[0].base_damage is not None


def test_end_to_end_channel_reprocess_marks_damage_stale_without_deleting_values(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-E2E-STALE"
    uploader = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    from server.services.damage_inspect import build_damage_inspect_response
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )
    from server.services.query import QueryService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    parsed = DurabilityScheduleParser().parse_bytes(_sample_sch_bytes())
    storage.attach_schedule(
        program_id=program_id,
        version="V1",
        source_filename="route.sch",
        content=_sample_sch_bytes(),
        parsed=parsed,
        owner_user_id=uploader,
        actor_user_id=uploader,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )
    task_id = start["damage_task_id"]
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None and task["status"] == "completed"

    service = _make_ingestion_service(test_database, test_cache, test_settings)
    service.start_channel_reprocess_from_save(
        program_id=program_id,
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader,
    )

    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    query = QueryService(test_database, test_cache, test_settings)
    inspect = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    assert inspect.has_stale_values is True
    stale_cells = [
        cell
        for row in inspect.rows
        for cell in row.damages.values()
        if cell.status == "stale"
    ]
    assert stale_cells
    assert stale_cells[0].stale_reason == "channel_reprocess_required"
