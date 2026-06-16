"""Behavior tests for post-upload precompute orchestration (PPU-27-01, PPU-27-02)."""

from __future__ import annotations

import json
import time

from server.config import Settings
from server.services.post_upload_precompute import (
    channel_reprocess_precompute_to_result,
    decide_after_channel_reprocess_completion,
    decide_after_inspect_damage_access,
    decide_after_schedule_save,
    schedule_precompute_decision_to_extension,
)
from tests.server.services.test_channel_reprocess_task import (
    _channel_map_save_entries,
    _make_ingestion_service,
)
from tests.server.services.test_damage_calculation_task import (
    _csv_with_24_damage_channels,
    _make_damage_service,
    _sample_sch_bytes,
)


def test_decide_after_channel_reprocess_with_no_schedule_returns_no_op(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("precompute_no_schedule")
    test_database.insert_event(
        event_id="event-no-schedule",
        program_id="P-NO-SCHED",
        version="V1",
        uploaded_by_user_id=uploader["id"],
        status="Pending",
        source_file="event.csv",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_channel_reprocess_completion(
        test_database,
        program_id="P-NO-SCHED",
        version="V1",
        user_id=uploader["id"],
        damage_service=damage_service,
    )

    assert decision["action"] == "no_op"
    assert decision["reason"] == "no_active_schedule"


def test_decide_after_channel_reprocess_with_ready_prerequisites_starts_damage(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-PRECOMPUTE-READY"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="channel_reprocess_required",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["task_kind"] == "damage_calculation"
    assert decision["reused_existing_task"] is False
    assert decision["damage_task_id"]


def test_decide_after_channel_reprocess_with_missing_prerequisites_is_blocked(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("precompute_blocked")
    uploader_id = uploader["id"]
    program_id = "P-PRECOMPUTE-BLOCKED"
    event_id = "event-blocked"
    test_database.insert_event(
        event_id=event_id,
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader_id,
        status="Pending",
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "blocked"
    assert "damage_prerequisite_report" in decision
    assert "damage_task_id" not in decision
    tasks = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    assert int(tasks[0]) == 0


def test_channel_reprocess_precompute_to_result_exposes_follow_up_fields() -> None:
    started = channel_reprocess_precompute_to_result(
        {
            "action": "start_damage_calculation",
            "damage_task_id": "damage-task-1",
        }
    )
    assert started == {
        "precompute_follow_up": {"damage_task_id": "damage-task-1"},
    }

    blocked = channel_reprocess_precompute_to_result(
        {
            "action": "blocked",
            "damage_prerequisite_report": {
                "summary": "Damage calculation prerequisites are not met",
                "issues": [],
            },
        }
    )
    assert blocked["precompute_follow_up"]["damage_prerequisite_report"]["summary"] == (
        "Damage calculation prerequisites are not met"
    )

    assert channel_reprocess_precompute_to_result({"action": "no_op", "reason": "damage_current"}) == {}


def test_schedule_precompute_decision_to_extension_maps_started_outcome() -> None:
    extension = schedule_precompute_decision_to_extension(
        {
            "action": "start_damage_calculation",
            "damage_task_id": "damage-task-1",
        }
    )
    assert extension == {
        "schedule_command_outcome": "calculation_started",
        "damage_task_id": "damage-task-1",
        "damage_task_status": "calculating",
    }


def test_schedule_precompute_decision_to_extension_maps_blocked_outcome() -> None:
    extension = schedule_precompute_decision_to_extension(
        {
            "action": "blocked",
            "damage_prerequisite_report": {
                "summary": "Damage calculation prerequisites are not met",
                "issues": [],
            },
        }
    )
    assert extension["schedule_command_outcome"] == "validation_blocked"
    assert extension["damage_prerequisite_report"]["summary"] == (
        "Damage calculation prerequisites are not met"
    )


def test_schedule_precompute_decision_to_extension_maps_rescale_outcome() -> None:
    extension = schedule_precompute_decision_to_extension(
        {
            "action": "rescale_scheduled_damage",
            "updated_rows": 24,
        }
    )

    assert extension == {
        "schedule_command_outcome": "rescaled_scheduled_damage",
        "updated_damage_rows": 24,
    }


def test_decide_after_channel_reprocess_reuses_active_damage_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-PRECOMPUTE-REUSE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    test_database.create_upload_task(
        task_id="active-damage-task",
        created_by_user_id=uploader_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": program_id, "version": "V1"},
    )
    test_database.update_upload_task("active-damage-task", status="running", phase="calculating")
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="channel_reprocess_required",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "reuse_active_task"
    assert decision["task_id"] == "active-damage-task"
    assert decision["reused_existing_task"] is True


def test_decide_after_channel_reprocess_no_ops_when_damage_is_current(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-PRECOMPUTE-CURRENT"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
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

    decision = decide_after_channel_reprocess_completion(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "no_op"
    assert decision["reason"] == "damage_current"


def test_channel_reprocess_completion_auto_starts_damage_when_schedule_exists(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("precompute_e2e")
    uploader_id = uploader["id"]
    program_id = "P-PRECOMPUTE-E2E"
    service.ingest(
        files=[("pattern_a_event.csv", _csv_with_24_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader_id,
        metadata={"job_number": "JOB-E2E", "work_order": "WO-E2E"},
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )

    start = service.start_channel_reprocess_from_save(
        program_id=program_id,
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader_id,
    )
    channel_task_id = start["task_id"]
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(channel_task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None and task["status"] == "completed", task.get("error")
    follow_up = task["result_json"]["precompute_follow_up"]
    assert follow_up["damage_task_id"]

    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    derived = test_database.get_event_derived_data(event_id)
    assert derived is not None
    assert derived["lttb_status"] == "current"

    deadline = time.monotonic() + 5.0
    damage_tasks: list[tuple] = []
    while time.monotonic() < deadline:
        damage_tasks = test_database.read_connection.execute(
            """
            SELECT task_id, task_kind, status FROM upload_tasks
            WHERE task_kind = 'damage_calculation'
            """
        ).fetchall()
        if damage_tasks:
            break
        time.sleep(0.05)
    assert len(damage_tasks) == 1, damage_tasks


def test_channel_reprocess_preserves_stale_damage_rows_until_recalculation(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-PRECOMPUTE-STALE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    first = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=active,
    )
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(first["damage_task_id"])
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None and task["status"] == "completed"

    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    before = test_database.get_event_channel_damage(event_id, "bj_x_force")
    assert before is not None
    assert before["status"] == "current"
    preserved_scheduled_damage = before["scheduled_damage"]

    service = _make_ingestion_service(test_database, test_cache, test_settings)
    service.start_channel_reprocess_from_save(
        program_id=program_id,
        version="V1",
        entries=_channel_map_save_entries(),
        user_id=uploader_id,
    )

    stale = test_database.get_event_channel_damage(event_id, "bj_x_force")
    assert stale is not None
    assert stale["status"] == "stale"
    assert stale["stale_reason"] == "channel_reprocess_required"
    assert stale["scheduled_damage"] == preserved_scheduled_damage


def test_decide_after_schedule_save_starts_damage_when_prerequisites_ready(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-SCHED-SAVE-READY"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
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
    assert decision["task_kind"] == "damage_calculation"
    assert decision["reused_existing_task"] is False
    assert decision["damage_task_id"]


def test_decide_after_schedule_save_blocked_when_channel_prerequisites_missing(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("schedule_save_blocked")
    uploader_id = uploader["id"]
    program_id = "P-SCHED-SAVE-BLOCKED"
    test_database.insert_event(
        event_id="event-schedule-blocked",
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader_id,
        status="Pending",
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=active,
        damage_service=damage_service,
    )

    assert decision["action"] == "blocked"
    assert "damage_prerequisite_report" in decision
    assert "damage_task_id" not in decision
    tasks = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    assert int(tasks[0]) == 0


def test_decide_after_schedule_save_reuses_active_damage_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-SCHED-SAVE-REUSE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    test_database.create_upload_task(
        task_id="active-schedule-damage-task",
        created_by_user_id=uploader_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": program_id, "version": "V1"},
    )
    test_database.update_upload_task(
        "active-schedule-damage-task",
        status="running",
        phase="calculating",
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=active,
        damage_service=damage_service,
    )

    assert decision["action"] == "reuse_active_task"
    assert decision["task_id"] == "active-schedule-damage-task"
    assert decision["reused_existing_task"] is True


def test_schedule_row_save_persists_edits_before_precompute_decision(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-SCHED-ROW-SAVE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    active = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=4.0,
        event_rows=[
            {
                "event_id": event_id,
                "rsp_file_name": "pattern_a_event.rsp",
                "rsp_event_name": "pattern_a_event",
                "pattern": "pattern_a",
                "repeats": 12,
                "weight": 0.25,
                "schedule_sequence": 1,
            }
        ],
        delimiter_token=None,
        actor_user_id=uploader_id,
    )
    preview = json.loads(str(active["parse_preview_json"]))
    assert preview["multiplier"] == 4.0
    assert preview["event_rows"][0]["repeats"] == 12
    assert preview["event_rows"][0]["weight"] == 0.25

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
    persisted = test_database.get_active_durability_schedule(program_id, "V1")
    assert persisted is not None
    persisted_preview = json.loads(str(persisted["parse_preview_json"]))
    assert persisted_preview["multiplier"] == 4.0
    assert persisted_preview["event_rows"][0]["repeats"] == 12


def test_schedule_upload_persists_rows_before_precompute_decision(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-SCHED-UPLOAD"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    preview = json.loads(str(active["parse_preview_json"]))
    assert preview["event_rows"]
    assert preview["event_rows"][0]["pattern"] == "pattern_a"

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
    assert preview["event_rows"] == json.loads(
        str(test_database.get_active_durability_schedule(program_id, "V1")["parse_preview_json"])
    )["event_rows"]


def test_decide_after_inspect_damage_with_ready_prerequisites_starts_damage(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-INSPECT-BACKFILL"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["task_kind"] == "damage_calculation"
    assert decision["reused_existing_task"] is False
    assert decision["damage_task_id"]


def test_decide_after_inspect_damage_blocked_when_prerequisites_missing(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("inspect_backfill_blocked")
    uploader_id = uploader["id"]
    program_id = "P-INSPECT-BLOCKED"
    test_database.insert_event(
        event_id="event-inspect-blocked",
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader_id,
        status="Pending",
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "blocked"
    assert "damage_prerequisite_report" in decision
    assert "damage_task_id" not in decision


def test_decide_after_inspect_damage_reuses_active_damage_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-INSPECT-REUSE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    test_database.create_upload_task(
        task_id="active-inspect-damage-task",
        created_by_user_id=uploader_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": program_id, "version": "V1"},
    )
    test_database.update_upload_task(
        "active-inspect-damage-task",
        status="running",
        phase="calculating",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "reuse_active_task"
    assert decision["task_id"] == "active-inspect-damage-task"
    assert decision["reused_existing_task"] is True


def test_decide_after_inspect_damage_no_ops_when_damage_is_current(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-INSPECT-CURRENT"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
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

    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "no_op"
    assert decision["reason"] == "damage_current"


def test_decide_after_inspect_damage_no_ops_when_stale_rows_exist(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-INSPECT-STALE"
    uploader_id = _seed_program_with_channels(
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=5,
        weight=0.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc",
        status="stale",
        stale_reason="schedule_changed",
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_inspect_damage_access(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        damage_service=damage_service,
    )

    assert decision["action"] == "no_op"
    assert decision["reason"] == "persisted_damage_exists"


def test_decide_after_schedule_save_invalid_rows_fail_validation_without_partial_results(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_calculation_task import _seed_program_with_channels

    program_id = "P-SCHED-INVALID"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=5,
        weight=0.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc",
        status="current",
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
        owner_user_id=uploader_id,
        actor_user_id=uploader_id,
    )
    active = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=2.0,
        event_rows=[
            {
                "event_id": event_id,
                "rsp_file_name": "pattern_a_event.rsp",
                "rsp_event_name": "pattern_a_event",
                "pattern": "pattern_a",
                "repeats": None,
                "weight": 0.5,
                "schedule_sequence": 1,
            }
        ],
        delimiter_token=None,
        actor_user_id=uploader_id,
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
    task_id = decision["damage_task_id"]
    deadline = time.monotonic() + 10.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None
    assert task["status"] == "failed"
    assert task["result_json"]["failure_report"]["issues"][0]["field"] == "repeats"

    row = test_database.get_event_channel_damage(event_id, "bj_x_force")
    assert row is None
