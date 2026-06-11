"""Behavior tests for schedule-only scheduled damage rescaling (PPU-27-03)."""

from __future__ import annotations

import json
import time

import pytest

from server.config import Settings
from server.services.post_upload_precompute import decide_after_schedule_save
from tests.server.services.test_damage_calculation_task import (
    _make_damage_service,
    _sample_sch_bytes,
    _seed_program_with_channels,
)


def _attach_schedule_and_run_damage(
    test_database,
    test_cache,
    test_settings: Settings,
    *,
    program_id: str,
    uploader_id: str,
) -> tuple[dict, str]:
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
    assert task is not None
    assert task["status"] == "completed", task.get("error")
    return active, uploader_id


def test_scaling_only_schedule_save_rescales_without_damage_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-ELIGIBLE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    rows_before = test_database.list_event_channel_damage_for_program_version(program_id, "V1")
    sample = next(row for row in rows_before if row["status"] == "current")
    base_damage = float(sample["base_damage"])

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=4.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "repeats": 10,
                "weight": 0.25,
            }
        ],
        delimiter_token=None,
        actor_user_id=uploader_id,
    )
    tasks_before = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decision = decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    assert decision["action"] == "rescale_scheduled_damage"
    tasks_after = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    assert int(tasks_after[0]) == int(tasks_before[0])

    row = test_database.get_event_channel_damage(event_id, sample["channel_key"])
    assert row is not None
    assert row["status"] == "current"
    assert row["stale_reason"] is None
    assert row["base_damage"] == pytest.approx(base_damage)
    assert row["repeats"] == 10
    assert row["weight"] == pytest.approx(0.25)
    assert row["multiplier"] == pytest.approx(4.0)
    assert row["scheduled_damage"] == pytest.approx(base_damage * 10 * 0.25 * 4.0)
    assert row["schedule_id"] == int(updated["schedule_id"])
    assert row["schedule_sha256"] == str(updated["schedule_sha256"])


def test_missing_base_damage_falls_back_to_damage_calculation(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-MISSING-BASE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    with test_database.write_connection() as conn:
        conn.execute(
            "DELETE FROM event_channel_damage WHERE event_id = ?",
            [event_id],
        )

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=3.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "repeats": 6,
                "weight": 0.5,
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
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["damage_task_id"]


def test_stale_base_damage_falls_back_to_damage_calculation(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-STALE-BASE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="channel_reprocess_required",
    )

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=3.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "repeats": 6,
                "weight": 0.5,
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
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["damage_task_id"]


def test_error_base_damage_falls_back_to_damage_calculation(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-ERROR-BASE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    sample = test_database.list_event_channel_damage_for_program_version(program_id, "V1")[0]
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key=str(sample["channel_key"]),
        channel_name=str(sample["channel_name"]),
        channel_unit=sample.get("channel_unit"),
        base_damage=None,
        scheduled_damage=None,
        repeats=5,
        weight=0.5,
        multiplier=2.0,
        schedule_id=int(active["schedule_id"]),
        schedule_sha256=str(active["schedule_sha256"]),
        status="error",
        error="Damage calculation failed",
    )

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=3.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "repeats": 6,
                "weight": 0.5,
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
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["damage_task_id"]


def test_event_match_change_falls_back_to_damage_calculation(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-EVENT-MATCH"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=2.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "pattern": "pattern_b",
                "repeats": 6,
                "weight": 0.5,
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
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    assert decision["action"] == "start_damage_calculation"
    assert decision["damage_task_id"]


def test_blocked_rescale_preserves_stale_damage_values(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-RESCALE-PRESERVE-STALE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active, uploader_id = _attach_schedule_and_run_damage(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    previous_preview = json.loads(str(active["parse_preview_json"]))
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    sample = test_database.list_event_channel_damage_for_program_version(program_id, "V1")[0]
    preserved_scheduled_damage = float(sample["scheduled_damage"])
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="channel_reprocess_required",
    )

    from server.services.durability_schedule import DurabilityScheduleStorageService

    storage = DurabilityScheduleStorageService(test_settings.data_root, test_database)
    updated = storage.save_schedule_edits(
        program_id=program_id,
        version="V1",
        multiplier=3.0,
        event_rows=[
            {
                **previous_preview["event_rows"][0],
                "event_id": event_id,
                "repeats": 6,
                "weight": 0.5,
            }
        ],
        delimiter_token=None,
        actor_user_id=uploader_id,
    )
    damage_service = _make_damage_service(test_database, test_cache, test_settings)

    decide_after_schedule_save(
        test_database,
        program_id=program_id,
        version="V1",
        user_id=uploader_id,
        active_schedule=updated,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )

    row = test_database.get_event_channel_damage(event_id, sample["channel_key"])
    assert row is not None
    assert row["status"] == "stale"
    assert row["scheduled_damage"] == pytest.approx(preserved_scheduled_damage)
