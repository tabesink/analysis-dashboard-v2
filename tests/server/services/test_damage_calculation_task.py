"""Behavior tests for schedule-driven damage calculation tasks."""

from __future__ import annotations

import io
import json
import time

import pytest
from fastapi.testclient import TestClient

from server.config import Settings
from server.services.damage_calculation_task import DamageCalculationTaskService
from server.services.fatigue_damage import ChannelDamageResult, ChannelSeries
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from server.services.query import QueryService
from server.services.schedule_damage_calculation import compute_scheduled_damage
from tests.server.services.test_channel_map_snapshot import (
    _equivalent_yaml_bytes,
    _fixed_ui_channel_map,
)


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _make_damage_service(
    test_database,
    test_cache,
    test_settings,
    *,
    base_damage: float = 0.01,
) -> DamageCalculationTaskService:
    query = QueryService(test_database, test_cache, test_settings)

    class _FixedCalculator:
        def calculate_channel(self, series: ChannelSeries) -> ChannelDamageResult:
            return ChannelDamageResult(
                channel_key=series.channel_key,
                channel_name=series.channel_name,
                unit=series.unit,
                damage=base_damage,
                status="ok",
            )

    return DamageCalculationTaskService(test_database, query, calculator=_FixedCalculator())


def _csv_with_detected_damage_channels() -> bytes:
    return b"""#HEADER
#TITLES
,,001_1 LF LCA OtrBJ P_UG_X Force,002_2 LF LCA OtrBJ P_UG_Y Force,003_3 LF ShockLwBsh P_UG_X Momt
#UNITS
,,N,N,Nmm
#DATATYPES
Huge,Double,Float,Float,Float
#DATA
1,0.000,100.0,200.0,300.0
2,0.001,101.0,201.0,301.0
3,0.002,102.0,202.0,302.0
4,0.003,103.0,203.0,303.0
5,0.004,104.0,204.0,304.0
6,0.005,105.0,205.0,305.0
7,0.006,106.0,206.0,306.0
8,0.007,107.0,207.0,307.0
9,0.008,108.0,208.0,308.0
10,0.009,109.0,209.0,309.0
"""


def _channel_map_save_entries() -> list[dict[str, int | str]]:
    return [
        {"plot_key": plot_key, "x_col": 2, "y_col": 3 if index % 2 == 0 else 4}
        for index, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    ]


def _sample_sch_bytes() -> bytes:
    return b"""*id damage_task_schedule
*multiplier 2.0
*pattern_a* 5 0.5
"""


def _wait_for_derived_task(client: TestClient, task_id: str, *, timeout_seconds: float = 15.0) -> dict:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/dashboard/derived-data/task/{task_id}")
        if response.status_code == 200:
            payload = response.json()
            if payload["status"] in {"completed", "failed"}:
                return payload
        time.sleep(0.05)
    raise TimeoutError(f"Derived task {task_id} did not finish within {timeout_seconds}s")


def _csv_with_24_damage_channels() -> bytes:
    channel_titles = [
        "001_1 LF LCA OtrBJ P_UG_X Force",
        "002_2 LF LCA OtrBJ P_UG_Y Force",
        "003_3 LF LCA OtrBJ P_UG_Z Force",
        "004_4 LF StabLink LwrBsh P_UG_X Force",
        "005_5 LF StabLink LwrBsh P_UG_Y Force",
        "006_6 LF StabLink LwrBsh P_UG_Z Force",
        "007_7 LF LCABushingF P_UG_X Force",
        "008_8 LF LCABushingF P_UG_Y Force",
        "009_9 LF LCABushingF P_UG_Z Force",
        "010_10 LF LCABushingF P_UG_X Momt",
        "011_11 LF LCABushingF P_UG_Y Momt",
        "012_12 LF LCABushingF P_UG_Z Momt",
        "013_13 LF LCABushingR P_UG_X Force",
        "014_14 LF LCABushingR P_UG_Y Force",
        "015_15 LF LCABushingR P_UG_Z Force",
        "016_16 LF LCABushingR P_UG_X Momt",
        "017_17 LF LCABushingR P_UG_Y Momt",
        "018_18 LF LCABushingR P_UG_Z Momt",
        "019_19 LF ShockLwBsh P_UG_X Force",
        "020_20 LF ShockLwBsh P_UG_Y Force",
        "021_21 LF ShockLwBsh P_UG_Z Force",
        "022_22 LF ShockLwBsh P_UG_X Momt",
        "023_23 LF ShockLwBsh P_UG_Y Momt",
        "024_24 LF ShockLwBsh P_UG_Z Momt",
    ]
    titles = ["Index", "Time", *channel_titles]
    units = ["", "s", *(["N"] * 9), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3)]
    rows = []
    for row_idx in range(10):
        values = [str(row_idx + 1), f"{row_idx * 0.01:.2f}"]
        values.extend(str((channel_idx * 100) + row_idx) for channel_idx in range(1, 25))
        rows.append(",".join(values))
    data_rows = "\n".join(rows)
    return (
        "#HEADER\n"
        "#TITLES\n"
        f"{','.join(titles)}\n"
        "#UNITS\n"
        f"{','.join(units)}\n"
        "#DATA\n"
        f"{data_rows}\n"
    ).encode()


def _channel_map_yaml() -> bytes:
    return b"""
bj_xy_force_plot:
  x_col: 2
  y_col: 3
bj_xz_force_plot:
  x_col: 2
  y_col: 4
shock_xy_force_plot:
  x_col: 20
  y_col: 21
shock_xz_force_plot:
  x_col: 20
  y_col: 22
bushing_f_xy_force_plot:
  x_col: 8
  y_col: 9
bushing_f_xz_force_plot:
  x_col: 8
  y_col: 10
bushing_r_xy_force_plot:
  x_col: 14
  y_col: 15
bushing_r_xz_force_plot:
  x_col: 14
  y_col: 16
"""


def _seed_program_with_channels(
    test_database,
    test_cache,
    test_settings: Settings,
    *,
    program_id: str,
    event_id: str,
    source_file: str,
) -> str:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user(f"uploader_{program_id}")
    service.ingest(
        files=[(source_file, _csv_with_24_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG", "work_order": "WO-DMG"},
    )
    return uploader["id"]


def test_compute_scheduled_damage_applies_formula() -> None:
    assert compute_scheduled_damage(0.01, repeats=4, weight=0.5, multiplier=2.0) == pytest.approx(0.04)


def test_prerequisite_report_does_not_create_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("damage_prereq_user")
    program_id = "P-DMG-PREREQ"
    event_id = "event-dmg-prereq"
    test_database.insert_event(
        event_id=event_id,
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader,
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
        owner_user_id=uploader,
        actor_user_id=uploader,
    )
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    result = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )

    assert "damage_prerequisite_report" in result
    assert "damage_task_id" not in result
    tasks = test_database.read_connection.execute(
        """
        SELECT COUNT(*) FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
        """,
        [program_id],
    ).fetchone()
    assert int(tasks[0]) == 0


def test_schedule_save_starts_damage_calculation_task(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-DMG-SAVE"
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
    event_id = test_database.get_events(program_id=program_id, version="V1")[0]["event_id"]
    active = test_database.get_active_durability_schedule(program_id, "V1")
    assert active is not None

    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    result = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
    )
    assert result.get("damage_task_id")
    assert "damage_prerequisite_report" not in result


def test_damage_calculation_writes_latest_rows_and_overwrites(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-DMG-PERSIST"
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

    rows = test_database.list_event_channel_damage_for_program_version(program_id, "V1")
    current_rows = [row for row in rows if row["status"] == "current"]
    assert current_rows
    first_count = len(current_rows)
    first_sample = current_rows[0]
    assert first_sample["scheduled_damage"] == pytest.approx(
        float(first_sample["base_damage"]) * 5 * 0.5 * 2.0
    )

    preview = json.loads(str(active["parse_preview_json"]))
    preview["multiplier"] = 3.0
    test_database.update_durability_schedule_parse_preview(
        int(active["schedule_id"]),
        json.dumps(preview, sort_keys=True, separators=(",", ":")),
    )
    refreshed = test_database.get_active_durability_schedule(program_id, "V1")
    assert refreshed is not None
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="schedule_changed",
    )

    second_start = damage_service.maybe_start_after_schedule_change(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=refreshed,
    )
    second_task_id = second_start["damage_task_id"]
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(second_task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None
    assert task["status"] == "completed"

    rows_after = test_database.list_event_channel_damage_for_program_version(program_id, "V1")
    assert len([row for row in rows_after if row["status"] == "current"]) == first_count
    updated = next(row for row in rows_after if row["channel_key"] == first_sample["channel_key"])
    assert updated["multiplier"] == pytest.approx(3.0)
    assert updated["scheduled_damage"] == pytest.approx(
        float(updated["base_damage"]) * 5 * 0.5 * 3.0
    )


def test_validation_failure_preserves_stale_values(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-DMG-STALE"
    uploader = _seed_program_with_channels(
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
    test_database.mark_event_channel_damage_stale(
        program_id=program_id,
        version="V1",
        stale_reason="schedule_changed",
    )

    active = {
        "schedule_id": 1,
        "schedule_sha256": "abc",
        "parse_preview_json": json.dumps(
            {
                "multiplier": 2.0,
                "entries": [{"pattern": "pattern_a", "repeats": 5, "weight": 0.5}],
                "event_rows": [
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
            }
        ),
    }
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service._start_damage_calculation_task(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
        preview=json.loads(str(active["parse_preview_json"])),
    )
    task_id = start["task_id"]
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
    assert row is not None
    assert row["status"] == "stale"
    assert row["scheduled_damage"] == pytest.approx(0.05)


def test_schedule_upload_persists_generated_event_rows_before_damage(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    program_id = "P-DMG-UPLOAD-ROWS"
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
    preview = json.loads(str(active["parse_preview_json"]))
    assert preview["event_rows"]
    assert preview["event_rows"][0]["pattern"] == "pattern_a"


def test_damage_calculation_persists_current_rows_for_mixed_fixture_batch(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    from tests.server.services.test_damage_query_service import (
        _channel_map_yaml,
        _csv_with_24_abbrev_damage_channels,
        _csv_with_24_damage_channels,
    )

    program_id = "P-DMG-MIXED-TASK"
    uploader = test_database.create_user("damage_mixed_task_uploader")
    ingest = _make_ingestion_service(test_database, test_cache, test_settings)
    assert ingest.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    ).success
    assert ingest.ingest(
        files=[("abbrev_event.csv", _csv_with_24_abbrev_damage_channels())],
        program_id=program_id,
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    ).success

    active = {
        "schedule_id": 1,
        "schedule_sha256": "mixed-fixture",
        "parse_preview_json": json.dumps(
            {
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
        ),
    }
    damage_service = _make_damage_service(test_database, test_cache, test_settings)
    start = damage_service._start_damage_calculation_task(
        program_id=program_id,
        version="V1",
        user_id=uploader,
        active_schedule=active,
        preview=json.loads(str(active["parse_preview_json"])),
    )
    task_id = start["task_id"]
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.05)
    assert task is not None
    assert task["status"] == "completed", task.get("error")

    rows = test_database.list_event_channel_damage_for_program_version(program_id, "V1")
    current_rows = [row for row in rows if row["status"] == "current"]
    assert len(current_rows) == 24
    for event_id in ("moog_event", "abbrev_event"):
        event_rows = [row for row in current_rows if row["event_id"] == event_id]
        assert len(event_rows) == 12
        assert all(row["base_damage"] is not None for row in event_rows)
        assert all(row["scheduled_damage"] is not None for row in event_rows)


def test_damage_task_persists_mixed_cell_outcomes_for_one_scope_run(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("damage_mixed_outcomes_uploader")
    event_id = "event-mixed-outcomes"
    test_database.insert_event(
        event_id=event_id,
        program_id="P-DMG-MIXED-OUTCOMES",
        version="V1",
        uploaded_by_user_id=uploader,
        status="Approved",
        source_file="pattern_a_event.csv",
    )

    class _QueryStub:
        def get_damage_channel_series(self, event_ids: list[str]) -> list[dict[str, object]]:
            assert event_ids == [event_id]
            return [
                {
                    "channel_key": "ch_unavailable",
                    "channel_name": "Unavailable Channel",
                    "unit": "N",
                    "status": "unavailable",
                    "error": "Missing channel source data",
                },
                {
                    "channel_key": "ch_current",
                    "channel_name": "Current Channel",
                    "unit": "N",
                    "values": [1.0, 2.0, 3.0],
                },
                {
                    "channel_key": "ch_error",
                    "channel_name": "Error Channel",
                    "unit": "N",
                    "values": [4.0, 5.0, 6.0],
                },
            ]

    class _CalculatorStub:
        def calculate_channel(self, series: ChannelSeries) -> ChannelDamageResult:
            if series.channel_key == "ch_error":
                return ChannelDamageResult(
                    channel_key=series.channel_key,
                    channel_name=series.channel_name,
                    unit=series.unit,
                    damage=None,
                    status="error",
                    error="Numerical overflow",
                )
            return ChannelDamageResult(
                channel_key=series.channel_key,
                channel_name=series.channel_name,
                unit=series.unit,
                damage=0.25,
                status="ok",
            )

    task_id = "damage-mixed-outcomes-task"
    test_database.create_upload_task(
        task_id=task_id,
        created_by_user_id=uploader,
        total_events=1,
        task_kind="damage_calculation",
        phase="validating",
        scope={"program_id": "P-DMG-MIXED-OUTCOMES", "version": "V1"},
    )

    service = DamageCalculationTaskService(
        test_database,
        _QueryStub(),
        calculator=_CalculatorStub(),
    )
    service._run_damage_calculation_task(
        task_id=task_id,
        program_id="P-DMG-MIXED-OUTCOMES",
        version="V1",
        active_schedule={"schedule_id": 1, "schedule_sha256": "sha-mixed"},
        preview={
            "multiplier": 2.0,
            "entries": [{"pattern": "pattern_a", "repeats": 5, "weight": 0.5}],
            "event_rows": [
                {
                    "event_id": event_id,
                    "rsp_file_name": "pattern_a_event.rsp",
                    "rsp_event_name": "pattern_a_event",
                    "pattern": "pattern_a",
                    "repeats": 5,
                    "weight": 0.5,
                    "schedule_sequence": 1,
                }
            ],
        },
    )

    task = test_database.get_upload_task(task_id)
    assert task is not None
    assert task["status"] == "completed"
    assert task["phase"] == "completed"

    unavailable = test_database.get_event_channel_damage(event_id, "ch_unavailable")
    assert unavailable is not None
    assert unavailable["status"] == "unavailable"
    assert unavailable["base_damage"] is None
    assert unavailable["scheduled_damage"] is None
    assert unavailable["error"] == "Missing channel source data"

    current = test_database.get_event_channel_damage(event_id, "ch_current")
    assert current is not None
    assert current["status"] == "current"
    assert current["base_damage"] == pytest.approx(0.25)
    assert current["scheduled_damage"] == pytest.approx(1.25)

    error = test_database.get_event_channel_damage(event_id, "ch_error")
    assert error is not None
    assert error["status"] == "error"
    assert error["base_damage"] is None
    assert error["scheduled_damage"] is None
    assert error["error"] == "Numerical overflow"


def test_damage_task_unexpected_exception_persists_failure_report(
    test_database,
    test_cache,
    test_settings: Settings,
) -> None:
    uploader = test_database.create_user("damage_task_error_uploader")
    event_id = "event-damage-task-error"
    test_database.insert_event(
        event_id=event_id,
        program_id="P-DMG-TASK-ERROR",
        version="V1",
        uploaded_by_user_id=uploader,
        status="Approved",
        source_file="pattern_a_event.csv",
    )

    class _RaisingQueryStub:
        def get_damage_channel_series(self, _event_ids: list[str]) -> list[dict[str, object]]:
            raise RuntimeError("simulated calculation crash")

    service = DamageCalculationTaskService(test_database, _RaisingQueryStub(), calculator=None)
    task_id = "damage-unexpected-failure-task"
    test_database.create_upload_task(
        task_id=task_id,
        created_by_user_id=uploader,
        total_events=1,
        task_kind="damage_calculation",
        phase="validating",
        scope={"program_id": "P-DMG-TASK-ERROR", "version": "V1"},
    )

    service._run_damage_calculation_task(
        task_id=task_id,
        program_id="P-DMG-TASK-ERROR",
        version="V1",
        active_schedule={"schedule_id": 1, "schedule_sha256": "sha-failure"},
        preview={
            "multiplier": 1.0,
            "entries": [{"pattern": "pattern_a", "repeats": 2, "weight": 1.0}],
            "event_rows": [
                {
                    "event_id": event_id,
                    "rsp_file_name": "pattern_a_event.rsp",
                    "rsp_event_name": "pattern_a_event",
                    "pattern": "pattern_a",
                    "repeats": 2,
                    "weight": 1.0,
                    "schedule_sequence": 1,
                }
            ],
        },
    )

    task = test_database.get_upload_task(task_id)
    assert task is not None
    assert task["status"] == "failed"
    assert task["phase"] == "failed"
    assert "simulated calculation crash" in str(task["error"])
    assert task["result_json"]["failure_report"]["summary"] == "Damage calculation task failed unexpectedly"
    assert task["result_json"]["failure_report"]["issues"][0]["field"] == "event_id"
