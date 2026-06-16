"""Route tests for durability schedule attachment."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


def _sample_sch_bytes() -> bytes:
    return b"""*id route_test_schedule
*multiplier 2.0
*pattern_a* 5 0.5
"""


def _login_admin(client: TestClient) -> dict:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def test_attach_schedule_forbids_read_only_user(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "schedule_reader", "password": "password1234"},
    )
    assert register.status_code == 201, register.text

    auth_client.app.state.db.insert_event(
        event_id="event-schedule-readonly",
        program_id="P-SCH-READ",
        version="V1",
        uploaded_by_user_id=register.json()["id"],
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-READ", "version": "V1"},
        files={"schedule_file": ("test.sch", io.BytesIO(_sample_sch_bytes()), "text/plain")},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Write access required"


def test_attach_schedule_allows_write_user_for_own_program_version(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login(auth_client, "schedule_writer", "password1234")

    auth_client.app.state.db.insert_event(
        event_id="event-schedule-writer",
        program_id="P-SCH-WRITE",
        version="V1",
        uploaded_by_user_id=writer_id,
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-WRITE", "version": "V1"},
        files={"schedule_file": ("route.sch", io.BytesIO(_sample_sch_bytes()), "text/plain")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["program_id"] == "P-SCH-WRITE"
    assert body["version"] == "V1"
    assert body["replaced_previous"] is False
    assert body["parse_preview"]["schedule_id"] == "route_test_schedule"
    assert body["parse_preview"]["entry_count"] == 1
    _assert_schedule_command_contract(body)


def test_attach_schedule_denies_write_user_for_other_owners_program_version(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    create_writer = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_writer_a",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create_writer.status_code == 201, create_writer.text
    create_other = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_writer_b",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create_other.status_code == 201, create_other.text
    writer_b_id = create_other.json()["id"]
    _logout(auth_client)

    auth_client.app.state.db.insert_event(
        event_id="event-schedule-other-owner",
        program_id="P-SCH-OTHER",
        version="V1",
        uploaded_by_user_id=writer_b_id,
        status="Pending",
    )

    login(auth_client, "schedule_writer_a", "password1234")

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-OTHER", "version": "V1"},
        files={"schedule_file": ("blocked.sch", io.BytesIO(_sample_sch_bytes()), "text/plain")},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "You can only edit uploaded data you own"


def _attach_schedule(
    client: TestClient,
    *,
    program_id: str,
    version: str,
    filename: str = "route.sch",
    content: bytes | None = None,
) -> dict:
    response = client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": program_id, "version": version},
        files={
            "schedule_file": (
                filename,
                io.BytesIO(content if content is not None else _sample_sch_bytes()),
                "text/plain",
            )
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _assert_schedule_command_contract(body: dict) -> None:
    assert body["schedule_command_outcome"] in {
        "calculation_started",
        "reused_active_task",
        "validation_blocked",
        "failed_to_start",
    }
    if body.get("damage_task_id"):
        assert body.get("damage_task_status") == "calculating"
    if body["schedule_command_outcome"] == "validation_blocked":
        assert body.get("damage_prerequisite_report") is not None


def _seed_ready_scope_for_schedule_commands(
    client: TestClient,
    *,
    program_id: str,
    version: str,
    uploader_id: str,
) -> str:
    event_id = f"event-{program_id.lower()}-{version.lower()}-ready"
    client.app.state.db.insert_event(
        event_id=event_id,
        program_id=program_id,
        version=version,
        uploaded_by_user_id=uploader_id,
        status="Approved",
        source_file="pattern_a_event.csv",
    )
    client.app.state.db.upsert_event_derived_data(
        event_id=event_id,
        ingestion_run_id=1,
        derived_artifact_id=1,
        channel_map_snapshot_id=1,
        measurements_status="current",
        lttb_status="current",
        measurements_data_kind="raw",
        lttb_data_kind="lttb",
    )
    return event_id


def _count_scope_damage_tasks(client: TestClient, *, program_id: str, version: str) -> int:
    row = client.app.state.db.read_connection.execute(
        """
        SELECT COUNT(*)
        FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND json_extract_string(scope_json, '$.program_id') = ?
          AND json_extract_string(scope_json, '$.version') = ?
        """,
        [program_id, version],
    ).fetchone()
    return int(row[0] if row else 0)


def test_get_schedule_returns_404_when_none_attached(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    response = auth_client.get(
        "/api/v1/dashboard/program-version/schedule",
        params={"program_id": "P-SCH-NONE", "version": "V1"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "No durability schedule attached for this program/version"


def test_get_schedule_returns_active_schedule_context(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-get",
        program_id="P-SCH-GET",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )

    attached = _attach_schedule(auth_client, program_id="P-SCH-GET", version="V1")

    response = auth_client.get(
        "/api/v1/dashboard/program-version/schedule",
        params={"program_id": "P-SCH-GET", "version": "V1"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["program_id"] == "P-SCH-GET"
    assert body["version"] == "V1"
    assert body["schedule_id"] == attached["schedule_id"]
    assert body["schedule_sha256"] == attached["schedule_sha256"]
    assert body["source_filename"] == attached["source_filename"]
    assert body["parse_preview"]["schedule_id"] == "route_test_schedule"
    assert body["parse_preview"]["entry_count"] == 1


def test_attach_schedule_rejects_empty_file(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-empty",
        program_id="P-SCH-EMPTY",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-EMPTY", "version": "V1"},
        files={"schedule_file": ("empty.sch", io.BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Schedule file is empty"


def test_attach_schedule_rejects_non_sch_extension(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-bad-ext",
        program_id="P-SCH-BAD-EXT",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-BAD-EXT", "version": "V1"},
        files={"schedule_file": ("schedule.txt", io.BytesIO(_sample_sch_bytes()), "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Schedule file must use the .sch extension"


def test_attach_schedule_allows_admin_for_other_owners_program_version(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    create_other = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_other_owner",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create_other.status_code == 201, create_other.text
    other_owner_id = create_other.json()["id"]

    auth_client.app.state.db.insert_event(
        event_id="event-schedule-admin-attach",
        program_id="P-SCH-ADMIN",
        version="V1",
        uploaded_by_user_id=other_owner_id,
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/schedule",
        data={"program_id": "P-SCH-ADMIN", "version": "V1"},
        files={"schedule_file": ("admin.sch", io.BytesIO(_sample_sch_bytes()), "text/plain")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["program_id"] == "P-SCH-ADMIN"
    assert body["replaced_previous"] is False


def test_attach_schedule_starts_damage_calculation_only_when_prerequisites_ready(
    auth_client: TestClient,
) -> None:
    admin_id = _login_admin(auth_client)["id"]
    blocked_program_id = "P-SCH-CMD-BLOCKED"
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-cmd-blocked",
        program_id=blocked_program_id,
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
        source_file="pattern_a_event.csv",
    )

    blocked = _attach_schedule(auth_client, program_id=blocked_program_id, version="V1")
    assert blocked["schedule_command_outcome"] == "validation_blocked"
    assert blocked["damage_task_id"] is None
    assert _count_scope_damage_tasks(
        auth_client,
        program_id=blocked_program_id,
        version="V1",
    ) == 0

    ready_program_id = "P-SCH-CMD-READY"
    _seed_ready_scope_for_schedule_commands(
        auth_client,
        program_id=ready_program_id,
        version="V1",
        uploader_id=admin_id,
    )

    ready = _attach_schedule(auth_client, program_id=ready_program_id, version="V1")
    assert ready["schedule_command_outcome"] == "calculation_started"
    assert ready["damage_task_id"]
    assert ready["damage_task_status"] == "calculating"


def test_attach_identical_schedule_dedupes_without_replacement(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-dedupe",
        program_id="P-SCH-DEDUPE",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )

    first = _attach_schedule(auth_client, program_id="P-SCH-DEDUPE", version="V1")
    second = _attach_schedule(
        auth_client,
        program_id="P-SCH-DEDUPE",
        version="V1",
        filename="repeat.sch",
    )

    assert second["schedule_id"] == first["schedule_id"]
    assert second["schedule_sha256"] == first["schedule_sha256"]
    assert second["replaced_previous"] is False
    assert second["previous_schedule_id"] is None

    rows = auth_client.app.state.db.read_connection.execute(
        """
        SELECT action
        FROM audit_log
        WHERE action IN ('DURABILITY_SCHEDULE_ATTACHED', 'DURABILITY_SCHEDULE_REPLACED')
          AND details LIKE '%P-SCH-DEDUPE%'
        ORDER BY id
        """
    ).fetchall()
    actions = [row[0] for row in rows]
    assert actions == ["DURABILITY_SCHEDULE_ATTACHED"]


def _save_schedule_payload(
    *,
    program_id: str,
    version: str,
    event_id: str = "event-schedule-save",
    multiplier: float = 3.5,
) -> dict:
    return {
        "program_id": program_id,
        "version": version,
        "multiplier": multiplier,
        "event_rows": [
            {
                "event_id": event_id,
                "rsp_file_name": "mf4e3_100_bt1cc_coil.rsp",
                "rsp_event_name": "mf4e3_100",
                "pattern": "mf4e3_100",
                "repeats": 16,
                "weight": 0.15,
                "schedule_sequence": 2,
            }
        ],
        "delimiter_token": "bt1cc",
    }


def test_put_schedule_save_round_trips_event_rows(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    event_id = "event-schedule-save-roundtrip"
    auth_client.app.state.db.insert_event(
        event_id=event_id,
        program_id="P-SCH-SAVE",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
        source_file="mf4e3_100_bt1cc_coil.rsp",
    )
    _attach_schedule(auth_client, program_id="P-SCH-SAVE", version="V1")

    payload = _save_schedule_payload(
        program_id="P-SCH-SAVE",
        version="V1",
        event_id=event_id,
    )
    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=payload,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["parse_preview"]["multiplier"] == 3.5
    assert len(body["parse_preview"]["event_rows"]) == 1
    assert body["parse_preview"]["event_rows"][0]["rsp_event_name"] == "mf4e3_100"
    assert body["parse_preview"]["delimiter_token"] == "bt1cc"
    assert body["parse_preview"]["entry_count"] == 1
    assert body["parse_preview"]["entries"][0]["pattern"] == "pattern_a"
    _assert_schedule_command_contract(body)

    get_response = auth_client.get(
        "/api/v1/dashboard/program-version/schedule",
        params={"program_id": "P-SCH-SAVE", "version": "V1"},
    )
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["parse_preview"]["event_rows"][0]["event_id"] == event_id


def test_put_schedule_save_starts_damage_calculation_when_prerequisites_ready(
    auth_client: TestClient,
) -> None:
    admin_id = _login_admin(auth_client)["id"]
    program_id = "P-SCH-SAVE-READY"
    event_id = _seed_ready_scope_for_schedule_commands(
        auth_client,
        program_id=program_id,
        version="V1",
        uploader_id=admin_id,
    )
    _attach_schedule(auth_client, program_id=program_id, version="V1")

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=_save_schedule_payload(
            program_id=program_id,
            version="V1",
            event_id=event_id,
        ),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_command_outcome"] in {"calculation_started", "reused_active_task"}
    assert body["damage_task_id"]
    assert body["damage_task_status"] == "calculating"


def test_put_schedule_save_returns_404_without_active_schedule(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=_save_schedule_payload(program_id="P-SCH-NO-ACTIVE", version="V1"),
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "No durability schedule attached for this program/version"


def test_put_schedule_save_forbids_non_owner_write_user(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    create_writer = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_save_writer_a",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create_writer.status_code == 201, create_writer.text
    create_other = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "schedule_save_other_owner",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create_other.status_code == 201, create_other.text
    other_owner_id = create_other.json()["id"]

    auth_client.app.state.db.insert_event(
        event_id="event-schedule-save-other",
        program_id="P-SCH-SAVE-OTHER",
        version="V1",
        uploaded_by_user_id=other_owner_id,
        status="Pending",
    )
    _attach_schedule(auth_client, program_id="P-SCH-SAVE-OTHER", version="V1")
    _logout(auth_client)

    login(auth_client, "schedule_save_writer_a", "password1234")

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=_save_schedule_payload(
            program_id="P-SCH-SAVE-OTHER",
            version="V1",
            event_id="event-schedule-save-other",
        ),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "You can only edit uploaded data you own"


def test_put_schedule_save_rejects_invalid_numeric_payload(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    event_id = "event-schedule-save-invalid"
    auth_client.app.state.db.insert_event(
        event_id=event_id,
        program_id="P-SCH-SAVE-INVALID",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )
    _attach_schedule(auth_client, program_id="P-SCH-SAVE-INVALID", version="V1")

    payload = _save_schedule_payload(
        program_id="P-SCH-SAVE-INVALID",
        version="V1",
        event_id=event_id,
    )
    payload["event_rows"][0]["repeats"] = -1

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=payload,
    )
    assert response.status_code in {400, 422}


def test_put_schedule_save_rejects_unknown_event_id(auth_client: TestClient) -> None:
    admin_id = _login_admin(auth_client)["id"]
    auth_client.app.state.db.insert_event(
        event_id="event-schedule-save-known",
        program_id="P-SCH-SAVE-UNKNOWN",
        version="V1",
        uploaded_by_user_id=admin_id,
        status="Pending",
    )
    _attach_schedule(auth_client, program_id="P-SCH-SAVE-UNKNOWN", version="V1")

    payload = _save_schedule_payload(
        program_id="P-SCH-SAVE-UNKNOWN",
        version="V1",
        event_id="event-not-in-program",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=payload,
    )
    assert response.status_code == 400
    assert "event_id" in response.json()["detail"].lower()


def test_put_schedule_save_clears_scope_damage_and_reuses_active_task(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    program_id = "P-SCH-SAVE-CLEANUP"
    uploader = auth_client.app.state.db.create_user("schedule_save_cleanup_owner")
    uploader_id = uploader["id"]
    event_id = "event-schedule-save-cleanup"
    auth_client.app.state.db.insert_event(
        event_id=event_id,
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=uploader_id,
        status="Approved",
        source_file="pattern_a_event.csv",
    )
    _attach_schedule(auth_client, program_id=program_id, version="V1")

    auth_client.app.state.db.upsert_event_derived_data(
        event_id=event_id,
        ingestion_run_id=1,
        derived_artifact_id=1,
        channel_map_snapshot_id=1,
        measurements_status="current",
        lttb_status="current",
        measurements_data_kind="full_resolution_canonical",
        lttb_data_kind="plot_only",
    )

    auth_client.app.state.db.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.08,
        repeats=4,
        weight=0.5,
        multiplier=4.0,
        schedule_id=1,
        schedule_sha256="stale-hash",
        status="stale",
        stale_reason="schedule_changed",
    )
    auth_client.app.state.db.create_upload_task(
        task_id="active-schedule-save-task",
        created_by_user_id=uploader_id,
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": program_id, "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        "active-schedule-save-task",
        status="running",
        phase="calculating",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/schedule",
        json=_save_schedule_payload(
            program_id=program_id,
            version="V1",
            event_id=event_id,
        ),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_command_outcome"] == "reused_active_task"
    assert body["damage_task_id"] == "active-schedule-save-task"
    assert body["damage_task_status"] == "calculating"

    scope_rows = auth_client.app.state.db.list_event_channel_damage_for_program_version(program_id, "V1")
    assert scope_rows == []

    task_rows = auth_client.app.state.db.read_connection.execute(
        """
        SELECT task_id
        FROM upload_tasks
        WHERE task_kind = 'damage_calculation'
          AND status = 'running'
          AND json_extract_string(scope_json, '$.program_id') = ?
          AND json_extract_string(scope_json, '$.version') = ?
        ORDER BY task_id
        """,
        [program_id, "V1"],
    ).fetchall()
    assert task_rows == [("active-schedule-save-task",)]
