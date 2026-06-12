from __future__ import annotations

import json

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from tests.server.routers.conftest import login


def test_damage_inspect_is_query_only_and_skips_repair_prerequisite_checks(
    auth_client: TestClient,
    monkeypatch,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_query_only_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_query_only_user", "damagepassword123")
    db = auth_client.app.state.db

    db.insert_event(
        event_id="event-query-only",
        program_id="P-QUERY",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-QUERY",
        version="V1",
        source_filename="query-only.sch",
        artifact_uri="schedules/query-only.sch",
        schedule_sha256="sha-query-only",
        parse_preview_json=json.dumps({"multiplier": 1.0, "event_rows": []}),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-QUERY", "V1", schedule_id)

    def _unexpected_call(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise AssertionError("inspect query path must not call mutation/repair checks")

    monkeypatch.setattr(
        "server.services.damage_inspect.assess_scope_damage_repair_state",
        _unexpected_call,
        raising=False,
    )
    monkeypatch.setattr(
        "server.services.damage_inspect.check_damage_prerequisites",
        _unexpected_call,
        raising=False,
    )

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-query-only"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["rows"][0]["event_id"] == "event-query-only"
    assert body["rows"][0]["damages"] == {}


def test_damage_inspect_returns_persisted_rows_without_compute(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_user", "damagepassword123")
    db = auth_client.app.state.db

    db.insert_event(
        event_id="event-damage-1",
        program_id="P-DMG",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
        job_number="JOB-1",
        work_order="WO-1",
    )
    signal = 1000.0 * np.sin(np.linspace(0, 8 * np.pi, 200))
    measurements = pd.DataFrame(
        {
            "timestamp": list(range(len(signal))),
            "channel_name": ["BJ X Raw"] * len(signal),
            "value": signal,
        }
    )
    db.insert_measurements("event-damage-1", measurements)
    db.upsert_event_channel_damage(
        event_id="event-damage-1",
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=2,
        weight=1.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc123",
        status="current",
    )

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-damage-1"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["channels"][0] == {
        "channel_key": "bj_x_force",
        "channel_name": "BJ X Force",
        "unit": "N",
    }
    assert body["rows"][0]["event_id"] == "event-damage-1"
    result = body["rows"][0]["damages"]["bj_x_force"]
    assert result["status"] == "current"
    assert result["damage"] == 0.05
    assert result["base_damage"] == 0.01


def test_damage_inspect_does_not_compute_when_persisted_rows_missing(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_missing_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_missing_user", "damagepassword123")
    db = auth_client.app.state.db

    db.insert_event(
        event_id="event-missing-damage",
        program_id="P-MISS",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    signal = 1000.0 * np.sin(np.linspace(0, 8 * np.pi, 200))
    measurements = pd.DataFrame(
        {
            "timestamp": list(range(len(signal))),
            "channel_name": ["BJ X Raw"] * len(signal),
            "value": signal,
        }
    )
    db.insert_measurements("event-missing-damage", measurements)

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-missing-damage"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["channels"] == []
    assert body["rows"][0]["damages"] == {}


def test_damage_inspect_reports_stale_values(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_stale_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_stale_user", "damagepassword123")
    db = auth_client.app.state.db

    db.insert_event(
        event_id="event-stale-damage",
        program_id="P-STALE",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.upsert_event_channel_damage(
        event_id="event-stale-damage",
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=2,
        weight=1.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc123",
        status="stale",
        stale_reason="schedule_changed",
    )

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-stale-damage"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["has_stale_values"] is True
    cell = body["rows"][0]["damages"]["bj_x_force"]
    assert cell["status"] == "stale"
    assert cell["stale_reason"] == "schedule_changed"
    assert body["scopes"][0]["has_stale_results"] is True
    assert body["scopes"][0]["has_current_results"] is False


def test_damage_inspect_surfaces_running_and_failed_task_context(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_scope_meta_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_scope_meta_user", "damagepassword123")
    db = auth_client.app.state.db

    db.insert_event(
        event_id="event-running-scope",
        program_id="P-RUN-SCOPE",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.insert_event(
        event_id="event-failed-scope",
        program_id="P-FAIL-SCOPE",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.create_upload_task(
        task_id="running-damage-task",
        created_by_user_id=owner_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": "P-RUN-SCOPE", "version": "V1"},
    )
    db.update_upload_task(
        "running-damage-task",
        status="running",
        phase="calculating",
    )
    db.create_upload_task(
        task_id="failed-damage-task",
        created_by_user_id=owner_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": "P-FAIL-SCOPE", "version": "V1"},
    )
    db.update_upload_task(
        "failed-damage-task",
        status="failed",
        phase="calculating",
        result={
            "failure_report": {
                "summary": "Damage calculation failed for selected scope",
                "issues": [
                    {
                        "field": "event_id",
                        "code": "task_exception",
                        "message": "Task failed",
                    }
                ],
            }
        },
    )

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-running-scope", "event-failed-scope"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    scopes_by_program = {scope["program_id"]: scope for scope in body["scopes"]}
    assert scopes_by_program["P-RUN-SCOPE"]["active_damage_task_id"] == "running-damage-task"
    assert scopes_by_program["P-RUN-SCOPE"]["failure_report"] is None
    assert (
        scopes_by_program["P-FAIL-SCOPE"]["failure_report"]["summary"]
        == "Damage calculation failed for selected scope"
    )
    assert scopes_by_program["P-FAIL-SCOPE"]["active_damage_task_id"] is None


def test_damage_calculate_starts_task_when_prerequisites_are_current(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_calc_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=True)
    login(auth_client, "damage_calc_user", "damagepassword123")

    db.insert_event(
        event_id="event-calc-damage",
        program_id="P-CALC",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.upsert_event_derived_data(
        event_id="event-calc-damage",
        ingestion_run_id=1,
        derived_artifact_id=1,
        channel_map_snapshot_id=1,
        measurements_status="current",
        lttb_status="current",
        measurements_data_kind="raw",
        lttb_data_kind="lttb",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-CALC",
        version="V1",
        source_filename="calc.sch",
        artifact_uri="schedules/calc.sch",
        schedule_sha256="sha-calc",
        parse_preview_json=json.dumps(
            {
                "multiplier": 1.0,
                "event_rows": [
                    {
                        "event_id": "event-calc-damage",
                        "pattern": "pattern_a",
                        "repeats": 1,
                        "weight": 1.0,
                        "rsp_event_name": "Event A",
                    }
                ],
            }
        ),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-CALC", "V1", schedule_id)

    response = auth_client.post(
        "/api/v1/damage/calculate",
        json={"program_id": "P-CALC", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["damage_task_id"]
    assert body["task_kind"] == "damage_calculation"


def test_damage_calculate_returns_prerequisite_report_when_derived_data_missing(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_prereq_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=True)
    login(auth_client, "damage_prereq_user", "damagepassword123")

    db.insert_event(
        event_id="event-prereq-damage",
        program_id="P-PREQ",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-PREQ",
        version="V1",
        source_filename="prereq.sch",
        artifact_uri="schedules/prereq.sch",
        schedule_sha256="sha-prereq",
        parse_preview_json=json.dumps(
            {
                "multiplier": 1.0,
                "event_rows": [
                    {
                        "event_id": "event-prereq-damage",
                        "pattern": "pattern_a",
                        "repeats": 1,
                        "weight": 1.0,
                        "rsp_event_name": "Event A",
                    }
                ],
            }
        ),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-PREQ", "V1", schedule_id)

    response = auth_client.post(
        "/api/v1/damage/calculate",
        json={"program_id": "P-PREQ", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["damage_task_id"] is None
    assert body["damage_prerequisite_report"]["summary"]
    assert body["damage_prerequisite_report"]["issues"]


def test_damage_backfill_starts_task_when_persisted_damage_missing(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_backfill_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=True)
    login(auth_client, "damage_backfill_user", "damagepassword123")

    db.insert_event(
        event_id="event-backfill-damage",
        program_id="P-BACKFILL",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.upsert_event_derived_data(
        event_id="event-backfill-damage",
        ingestion_run_id=1,
        derived_artifact_id=1,
        channel_map_snapshot_id=1,
        measurements_status="current",
        lttb_status="current",
        measurements_data_kind="raw",
        lttb_data_kind="lttb",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-BACKFILL",
        version="V1",
        source_filename="backfill.sch",
        artifact_uri="schedules/backfill.sch",
        schedule_sha256="sha-backfill",
        parse_preview_json=json.dumps(
            {
                "multiplier": 1.0,
                "event_rows": [
                    {
                        "event_id": "event-backfill-damage",
                        "pattern": "pattern_a",
                        "repeats": 1,
                        "weight": 1.0,
                        "rsp_event_name": "Event A",
                    }
                ],
            }
        ),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-BACKFILL", "V1", schedule_id)

    response = auth_client.post(
        "/api/v1/damage/backfill",
        json={"program_id": "P-BACKFILL", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["damage_task_id"]
    assert body["task_kind"] == "damage_calculation"


def test_damage_backfill_returns_prerequisite_report_when_blocked(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_backfill_blocked", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=True)
    login(auth_client, "damage_backfill_blocked", "damagepassword123")

    db.insert_event(
        event_id="event-backfill-blocked",
        program_id="P-BACKFILL-BLOCKED",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-BACKFILL-BLOCKED",
        version="V1",
        source_filename="backfill-blocked.sch",
        artifact_uri="schedules/backfill-blocked.sch",
        schedule_sha256="sha-backfill-blocked",
        parse_preview_json=json.dumps(
            {
                "multiplier": 1.0,
                "event_rows": [
                    {
                        "event_id": "event-backfill-blocked",
                        "pattern": "pattern_a",
                        "repeats": 1,
                        "weight": 1.0,
                        "rsp_event_name": "Event A",
                    }
                ],
            }
        ),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-BACKFILL-BLOCKED", "V1", schedule_id)

    response = auth_client.post(
        "/api/v1/damage/backfill",
        json={"program_id": "P-BACKFILL-BLOCKED", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["damage_task_id"] is None
    assert body["damage_prerequisite_report"]["summary"]


def test_damage_backfill_reuses_active_task_on_repeated_calls(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_backfill_idem", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=True)
    login(auth_client, "damage_backfill_idem", "damagepassword123")

    db.insert_event(
        event_id="event-backfill-idem",
        program_id="P-BACKFILL-IDEM",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
    )
    db.upsert_event_derived_data(
        event_id="event-backfill-idem",
        ingestion_run_id=1,
        derived_artifact_id=1,
        channel_map_snapshot_id=1,
        measurements_status="current",
        lttb_status="current",
        measurements_data_kind="raw",
        lttb_data_kind="lttb",
    )
    schedule_id = db.upsert_durability_schedule_artifact(
        program_id="P-BACKFILL-IDEM",
        version="V1",
        source_filename="backfill-idem.sch",
        artifact_uri="schedules/backfill-idem.sch",
        schedule_sha256="sha-backfill-idem",
        parse_preview_json=json.dumps(
            {
                "multiplier": 1.0,
                "event_rows": [
                    {
                        "event_id": "event-backfill-idem",
                        "pattern": "pattern_a",
                        "repeats": 1,
                        "weight": 1.0,
                        "rsp_event_name": "Event A",
                    }
                ],
            }
        ),
        owner_user_id=owner_id,
    )
    db.set_active_durability_schedule("P-BACKFILL-IDEM", "V1", schedule_id)

    first = auth_client.post(
        "/api/v1/damage/backfill",
        json={"program_id": "P-BACKFILL-IDEM", "version": "V1"},
    )
    second = auth_client.post(
        "/api/v1/damage/backfill",
        json={"program_id": "P-BACKFILL-IDEM", "version": "V1"},
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    first_body = first.json()
    second_body = second.json()
    assert first_body["damage_task_id"]
    assert second_body["damage_task_id"] == first_body["damage_task_id"]
    assert second_body["reused_existing_task"] is True


def test_damage_backfill_requires_write_access(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_backfill_readonly", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=False)
    login(auth_client, "damage_backfill_readonly", "damagepassword123")

    response = auth_client.post(
        "/api/v1/damage/backfill",
        json={"program_id": "P-READ", "version": "V1"},
    )

    assert response.status_code == 403, response.text


def test_damage_calculate_requires_write_access(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_readonly_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    db = auth_client.app.state.db
    auth_client.app.state.identity_db.update_user_role_and_write(owner_id, can_write=False)
    login(auth_client, "damage_readonly_user", "damagepassword123")

    response = auth_client.post(
        "/api/v1/damage/calculate",
        json={"program_id": "P-READ", "version": "V1"},
    )

    assert response.status_code == 403, response.text
