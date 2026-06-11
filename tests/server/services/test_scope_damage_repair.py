"""Behavior tests for partial damage repair policy (IDM-28-05)."""

from __future__ import annotations

import json
import time

from server.services.post_upload_precompute import decide_after_inspect_damage_access
from server.services.scope_damage_repair import assess_scope_damage_repair_state
from tests.server.services.test_damage_calculation_task import (
    _make_damage_service,
    _sample_sch_bytes,
    _seed_program_with_channels,
)
from tests.server.services.test_post_upload_precompute_hardening import _attach_sample_schedule


def test_assess_scope_damage_repair_state_complete_when_all_scheduled_channels_current(
    test_database,
    test_cache,
    test_settings,
) -> None:
    from server.services.durability_schedule import (
        DurabilityScheduleParser,
        DurabilityScheduleStorageService,
    )
    from server.services.query import QueryService

    program_id = "P-REPAIR-COMPLETE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
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

    query = QueryService(test_database, test_cache, test_settings)
    state = assess_scope_damage_repair_state(
        test_database,
        query,
        program_id=program_id,
        version="V1",
        preview=preview,
    )

    assert state == "complete"


def test_assess_scope_damage_repair_state_needs_recalc_for_mixed_current_and_error(
    test_database,
    test_cache,
    test_settings,
) -> None:
    from server.services.query import QueryService

    program_id = "P-REPAIR-MIXED"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active = _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    preview = json.loads(str(active["parse_preview_json"]))
    event_id = str(preview["event_rows"][0]["event_id"])
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
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_y_force",
        channel_name="BJ Y Force",
        channel_unit="N",
        base_damage=None,
        scheduled_damage=None,
        repeats=5,
        weight=0.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc",
        status="error",
        error="No measurements found for mapped channel",
    )

    query = QueryService(test_database, test_cache, test_settings)
    state = assess_scope_damage_repair_state(
        test_database,
        query,
        program_id=program_id,
        version="V1",
        preview=preview,
    )

    assert state == "needs_recalc"


def test_assess_scope_damage_repair_state_stale_only_without_auto_recalc(
    test_database,
    test_cache,
    test_settings,
) -> None:
    from server.services.query import QueryService

    program_id = "P-REPAIR-STALE"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active = _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    preview = json.loads(str(active["parse_preview_json"]))
    event_id = str(preview["event_rows"][0]["event_id"])
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

    query = QueryService(test_database, test_cache, test_settings)
    state = assess_scope_damage_repair_state(
        test_database,
        query,
        program_id=program_id,
        version="V1",
        preview=preview,
    )

    assert state == "stale_only"


def test_decide_after_inspect_damage_starts_recalc_for_partial_error_population(
    test_database,
    test_cache,
    test_settings,
) -> None:
    program_id = "P-INSPECT-PARTIAL"
    uploader_id = _seed_program_with_channels(
        test_database,
        test_cache,
        test_settings,
        program_id=program_id,
        event_id="ignored",
        source_file="pattern_a_event.csv",
    )
    active = _attach_sample_schedule(
        test_database,
        test_settings,
        program_id=program_id,
        uploader_id=uploader_id,
    )
    preview = json.loads(str(active["parse_preview_json"]))
    event_id = str(preview["event_rows"][0]["event_id"])
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
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_y_force",
        channel_name="BJ Y Force",
        channel_unit="N",
        base_damage=None,
        scheduled_damage=None,
        repeats=5,
        weight=0.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc",
        status="error",
        error="No measurements found for mapped channel",
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
    assert decision["damage_task_id"]
