"""Route tests for dashboard metadata updates."""

from __future__ import annotations

import io
import time

import yaml
from fastapi.testclient import TestClient

from server.config import Settings
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from tests.server.services.test_channel_map_snapshot import _fixed_ui_channel_map

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


def _login_admin(client: TestClient) -> dict:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _channel_map_yaml_bytes() -> bytes:
    payload = {
        plot_key: {
            "x_col": mapping["x_col"],
            "y_col": mapping["y_col"],
        }
        for plot_key, mapping in _fixed_ui_channel_map().items()
    }
    return yaml.safe_dump(payload, sort_keys=True).encode("utf-8")


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
"""


def _wait_for_derived_task(client: TestClient, task_id: str, *, timeout_seconds: float = 10.0) -> dict:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/dashboard/derived-data/task/{task_id}")
        if response.status_code == 200:
            payload = response.json()
            if payload["status"] in {"completed", "failed"}:
                return payload
        time.sleep(0.05)
    raise TimeoutError(f"Derived task {task_id} did not finish within {timeout_seconds}s")


from tests.server.routers.test_upload_router import (
    _create_writer,
    _login_admin,
    _login_writer,
    _logout,
)


def test_derived_data_task_poll_is_creator_scoped(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    _login_admin(auth_client)
    owner = _create_writer(auth_client, "derived_task_owner")
    _create_writer(auth_client, "derived_task_other")
    _logout(auth_client)

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_poll_scope.csv", _csv_with_detected_damage_channels())],
        program_id="P-POLL-SCOPE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-POLL", "work_order": "WO-POLL"},
    )
    start = service.start_channel_reprocess_from_save(
        program_id="P-POLL-SCOPE",
        version="V1",
        entries=[
            {"plot_key": plot_key, "x_col": 2, "y_col": 3 if index % 2 == 0 else 4}
            for index, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
        ],
        user_id=owner["id"],
    )

    _login_writer(auth_client, "derived_task_other")
    response = auth_client.get(f"/api/v1/dashboard/derived-data/task/{start['task_id']}")
    assert response.status_code == 404

    _logout(auth_client)
    _login_writer(auth_client, "derived_task_owner")
    allowed = auth_client.get(f"/api/v1/dashboard/derived-data/task/{start['task_id']}")
    assert allowed.status_code == 200, allowed.text
    payload = allowed.json()
    assert payload["task_id"] == start["task_id"]
    assert payload["task_kind"] == "channel_reprocess"


def test_upload_program_version_channel_map_starts_channel_reprocess_task(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "channel_map_yaml_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "channel_map_yaml_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_route.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-YAML",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=writer_id,
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-ROUTE-YAML", "version": "V1"},
        files={
            "channel_map": (
                "channel_map.yml",
                io.BytesIO(_channel_map_yaml_bytes()),
                "application/x-yaml",
            )
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task_kind"] == "channel_reprocess"
    assert body["reused_existing_task"] is False
    assert body["task_id"]

    final_task = _wait_for_derived_task(auth_client, body["task_id"])
    assert final_task["status"] == "completed"
    assert final_task["result"]["processed_count"] == 1
    assert final_task["result"]["failed_count"] == 0

    channel_map = auth_client.app.state.db.get_channel_map("P-ROUTE-YAML", "V1")
    assert len(channel_map) == len(FIXED_CHANNEL_MAP_PLOTS)


def test_save_program_version_channel_map_starts_channel_reprocess_task(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "channel_map_save_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "channel_map_save_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_route_save.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-SAVE",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=writer_id,
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/channel-map",
        json={
            "program_id": "P-ROUTE-SAVE",
            "version": "V1",
            "entries": [
                {"plot_key": plot_key, "x_col": 2, "y_col": 3 if index % 2 == 0 else 4}
                for index, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
            ],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task_kind"] == "channel_reprocess"
    assert body["reused_existing_task"] is False
    assert body["task_id"]


def test_upload_program_version_channel_map_forbids_non_owner_write_user(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    owner = _create_writer(auth_client, "channel_map_owner")
    _create_writer(auth_client, "channel_map_other_writer")

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_non_owner.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-OWNER-ONLY",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    _login_writer(auth_client, "channel_map_other_writer")
    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-ROUTE-OWNER-ONLY", "version": "V1"},
        files={
            "channel_map": (
                "channel_map.yml",
                io.BytesIO(_channel_map_yaml_bytes()),
                "application/x-yaml",
            )
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only edit uploaded data you own"


def test_upload_program_version_channel_map_allows_admin_for_other_owner_scope(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    owner = _create_writer(auth_client, "channel_map_admin_owner")
    _create_writer(auth_client, "channel_map_admin_other")

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_admin.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-ADMIN",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    _login_admin(auth_client)
    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-ROUTE-ADMIN", "version": "V1"},
        files={
            "channel_map": (
                "channel_map.yml",
                io.BytesIO(_channel_map_yaml_bytes()),
                "application/x-yaml",
            )
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task_kind"] == "channel_reprocess"
    assert body["task_id"]


def test_upload_program_version_channel_map_rejects_multiple_files(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "channel_map_multi_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "channel_map_multi_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_route_multi.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-MULTI",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=writer_id,
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-ROUTE-MULTI", "version": "V1"},
        files=[
            (
                "channel_map",
                ("channel_map.yml", io.BytesIO(_channel_map_yaml_bytes()), "application/x-yaml"),
            ),
            (
                "channel_map",
                ("channel_map.yaml", io.BytesIO(_channel_map_yaml_bytes()), "application/x-yaml"),
            ),
        ],
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Upload exactly one channel_map.yml or channel_map.yaml file"


def test_upload_program_version_channel_map_forbids_read_only_user(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "channel_map_reader", "password": "password1234"},
    )
    assert register.status_code == 201, register.text
    reader_id = register.json()["id"]

    auth_client.app.state.db.insert_event(
        event_id="event-pv-map-readonly",
        program_id="P-READONLY-UPLOAD",
        version="V1",
        uploaded_by_user_id=reader_id,
        status="Pending",
    )

    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-READONLY-UPLOAD", "version": "V1"},
        files={
            "channel_map": (
                "channel_map.yml",
                io.BytesIO(_channel_map_yaml_bytes()),
                "application/x-yaml",
            )
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Write access required"


def test_upload_program_version_channel_map_invalid_filename_is_noop(
    auth_client: TestClient,
    auth_settings: Settings,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "channel_map_invalid_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "channel_map_invalid_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    service = IngestionService(
        auth_client.app.state.db,
        auth_client.app.state.cache,
        auth_settings,
    )
    service.ingest(
        files=[("event_pending_route_invalid.csv", _csv_with_detected_damage_channels())],
        program_id="P-ROUTE-INVALID",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=writer_id,
        metadata={"job_number": "JOB-ROUTE", "work_order": "WO-ROUTE"},
    )

    before_channel_map = auth_client.app.state.db.get_channel_map("P-ROUTE-INVALID", "V1")
    before_active_snapshot = auth_client.app.state.db.get_active_channel_map_snapshot(
        "P-ROUTE-INVALID",
        "V1",
    )
    before_artifacts = auth_client.app.state.db.list_ingestion_artifacts(
        program_id="P-ROUTE-INVALID",
        version="V1",
    )
    before_event_ids = {
        event["event_id"]
        for event in auth_client.app.state.db.get_events(
            program_id="P-ROUTE-INVALID",
            version="V1",
        )
    }

    response = auth_client.post(
        "/api/v1/dashboard/program-version/channel-map/upload",
        data={"program_id": "P-ROUTE-INVALID", "version": "V1"},
        files={
            "channel_map": (
                "other_map.yaml",
                io.BytesIO(_channel_map_yaml_bytes()),
                "application/x-yaml",
            )
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Upload exactly one channel_map.yml or channel_map.yaml file"

    after_channel_map = auth_client.app.state.db.get_channel_map("P-ROUTE-INVALID", "V1")
    after_active_snapshot = auth_client.app.state.db.get_active_channel_map_snapshot(
        "P-ROUTE-INVALID",
        "V1",
    )
    after_artifacts = auth_client.app.state.db.list_ingestion_artifacts(
        program_id="P-ROUTE-INVALID",
        version="V1",
    )
    after_event_ids = {
        event["event_id"]
        for event in auth_client.app.state.db.get_events(
            program_id="P-ROUTE-INVALID",
            version="V1",
        )
    }

    assert before_channel_map == after_channel_map == []
    assert before_active_snapshot is None
    assert after_active_snapshot is None
    assert before_event_ids == after_event_ids
    assert [artifact["status"] for artifact in before_artifacts] == ["pending"]
    assert [artifact["status"] for artifact in after_artifacts] == ["pending"]


def test_update_program_version_metadata_forbids_read_only_user(
    auth_client: TestClient,
) -> None:
    """Read-only users cannot bypass the UI route guard via direct API calls."""
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "metadata_reader", "password": "password1234"},
    )
    assert register.status_code == 201, register.text
    reader_id = register.json()["id"]
    assert register.json()["can_write"] is False

    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-readonly",
        program_id="P-READONLY",
        version="V1",
        uploaded_by_user_id=reader_id,
        status="Pending",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/metadata",
        json={
            "program_id": "P-READONLY",
            "version": "V1",
            "updates": {"job_number": "BLOCKED"},
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Write access required"


def test_update_program_version_metadata_allows_write_user_for_own_uploads(
    auth_client: TestClient,
) -> None:
    """Users with can_write can update metadata for program/versions they own."""
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "metadata_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "metadata_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-writer-a",
        program_id="P-WRITER",
        version="V1",
        uploaded_by_user_id=writer_id,
        status="Pending",
    )
    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-writer-b",
        program_id="P-WRITER",
        version="V1",
        uploaded_by_user_id=writer_id,
        status="Pending",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/metadata",
        json={
            "program_id": "P-WRITER",
            "version": "V1",
            "updates": {"job_number": "WRITER-JOB"},
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["program_id"] == "P-WRITER"
    assert body["version"] == "V1"
    assert body["updated_event_count"] == 2

    refreshed = auth_client.app.state.db.get_events(program_id="P-WRITER", version="V1")
    assert all(event.get("job_number") == "WRITER-JOB" for event in refreshed)


def test_update_event_metadata_returns_409_on_optimistic_concurrency_conflict(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "occ_user", "password": "occpassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]

    auth_client.app.state.db.insert_event(
        event_id="event-router-occ-1",
        program_id="P-ROUTER",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Pending",
    )

    first = auth_client.put(
        "/api/v1/dashboard/events/event-router-occ-1/metadata",
        json={
            "job_number": "FIRST",
            "if_unmodified_since": None,
        },
    )
    assert first.status_code == 200, first.text

    stale = auth_client.put(
        "/api/v1/dashboard/events/event-router-occ-1/metadata",
        json={
            "job_number": "SECOND",
            "if_unmodified_since": None,
        },
    )
    assert stale.status_code == 409
    assert "modified by another user" in stale.json()["detail"]
