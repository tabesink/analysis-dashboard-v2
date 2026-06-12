"""Endpoint tests for upload write-path ownership boundaries."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from server.utils.cache import CacheKeys

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"
WRITER_PASSWORD = "password1234"


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _login_admin(client: TestClient) -> dict[str, Any]:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _create_writer(client: TestClient, username: str) -> dict[str, Any]:
    _login_admin(client)
    response = client.post(
        "/api/v1/admin/users",
        json={
            "username": username,
            "password": WRITER_PASSWORD,
            "role": "user",
            "can_write": True,
        },
    )
    assert response.status_code == 201, response.text
    _logout(client)
    return response.json()


def _login_writer(client: TestClient, username: str) -> dict[str, Any]:
    return login(client, username, WRITER_PASSWORD)


def _insert_event(
    client: TestClient,
    *,
    event_id: str,
    owner_user_id: str,
    program_id: str = "P-ROUTE-SCOPE",
    version: str = "V1",
) -> None:
    client.app.state.db.insert_event(
        event_id=event_id,
        program_id=program_id,
        version=version,
        uploaded_by_user_id=owner_user_id,
        status="Pending",
        source_file=f"{event_id}.csv",
    )


def _seed_event_cache_groups(client: TestClient) -> dict[str, str]:
    keys = {
        "events": f"{CacheKeys.EVENTS}:scope",
        "event_count": f"{CacheKeys.EVENT_COUNT}:scope",
        "program_ids": f"{CacheKeys.PROGRAM_IDS}:scope",
        "versions": f"{CacheKeys.VERSIONS}:scope",
        "filter_options": f"{CacheKeys.FILTER_OPTIONS}:scope",
    }
    for key in keys.values():
        client.app.state.cache.set(key, "stale")
    return keys


def _assert_event_cache_groups_invalidated(
    client: TestClient,
    keys: dict[str, str],
) -> None:
    assert client.app.state.cache.get(keys["events"]) is None
    assert client.app.state.cache.get(keys["event_count"]) is None
    assert client.app.state.cache.get(keys["program_ids"]) is None
    assert client.app.state.cache.get(keys["versions"]) is None
    assert client.app.state.cache.get(keys["filter_options"]) == "stale"


def test_writer_can_delete_scope_owned_entirely_by_self(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "scope_owner")
    _insert_event(
        auth_client,
        event_id="owner-event",
        owner_user_id=owner["id"],
    )
    cache_keys = _seed_event_cache_groups(auth_client)

    _login_writer(auth_client, "scope_owner")
    response = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-SCOPE", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["event_count"] == 1
    assert auth_client.app.state.db.get_event("owner-event") is None
    _assert_event_cache_groups_invalidated(auth_client, cache_keys)


def test_writer_cannot_delete_mixed_ownership_scope_and_admin_can(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "mixed_owner")
    other_owner = _create_writer(auth_client, "mixed_other_owner")
    _insert_event(
        auth_client,
        event_id="mixed-owner-event",
        owner_user_id=owner["id"],
        program_id="P-ROUTE-MIXED",
    )
    _insert_event(
        auth_client,
        event_id="mixed-other-event",
        owner_user_id=other_owner["id"],
        program_id="P-ROUTE-MIXED",
    )

    _login_writer(auth_client, "mixed_owner")
    cache_keys = _seed_event_cache_groups(auth_client)
    forbidden = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-MIXED", "version": "V1"},
    )

    assert forbidden.status_code == 403
    assert auth_client.app.state.db.get_event("mixed-owner-event") is not None
    assert auth_client.app.state.db.get_event("mixed-other-event") is not None
    assert auth_client.app.state.cache.get(cache_keys["events"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["event_count"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["program_ids"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["versions"]) == "stale"

    _logout(auth_client)
    _login_admin(auth_client)
    allowed = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-MIXED", "version": "V1"},
    )

    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["event_count"] == 2
    assert auth_client.app.state.db.get_event("mixed-owner-event") is None
    assert auth_client.app.state.db.get_event("mixed-other-event") is None
    _assert_event_cache_groups_invalidated(auth_client, cache_keys)


def test_scope_delete_cleans_damage_schedule_and_scoped_damage_tasks(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "scope_cleanup_owner")
    program_id = "P-ROUTE-SCOPE-CLEANUP"
    version = "V1"
    event_id = "scope-cleanup-event"
    _insert_event(
        auth_client,
        event_id=event_id,
        owner_user_id=owner["id"],
        program_id=program_id,
        version=version,
    )

    schedule_id = auth_client.app.state.db.upsert_durability_schedule_artifact(
        program_id=program_id,
        version=version,
        source_filename="cleanup.sch",
        artifact_uri="schedules/cleanup.sch",
        schedule_sha256="cleanup-sha",
        parse_preview_json='{"multiplier": 1.0, "event_rows": []}',
        owner_user_id=owner["id"],
    )
    auth_client.app.state.db.set_active_durability_schedule(program_id, version, schedule_id)
    auth_client.app.state.db.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=1,
        weight=1.0,
        multiplier=1.0,
        schedule_id=schedule_id,
        schedule_sha256="cleanup-sha",
        status="current",
    )
    auth_client.app.state.db.create_upload_task(
        task_id="scope-cleanup-damage-task",
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="damage_calculation",
        phase="calculating",
        scope={"program_id": program_id, "version": version},
    )
    auth_client.app.state.db.update_upload_task(
        "scope-cleanup-damage-task",
        status="running",
        phase="calculating",
    )

    _login_writer(auth_client, "scope_cleanup_owner")
    response = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": program_id, "version": version},
    )

    assert response.status_code == 200, response.text
    assert (
        auth_client.app.state.db.list_event_channel_damage_for_program_version(program_id, version)
        == []
    )
    assert auth_client.app.state.db.get_active_durability_schedule(program_id, version) is None
    assert (
        auth_client.app.state.db.list_durability_schedule_artifacts(program_id=program_id, version=version)
        == []
    )
    scoped_tasks = auth_client.app.state.db.read_connection.execute(
        """
        SELECT task_id
        FROM upload_tasks
        WHERE task_kind IN ('damage_calculation', 'channel_reprocess')
          AND json_extract_string(scope_json, '$.program_id') = ?
          AND json_extract_string(scope_json, '$.version') = ?
        """,
        [program_id, version],
    ).fetchall()
    assert scoped_tasks == []


def test_get_upload_folder_task_returns_completed_result_for_creator(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_owner")
    task_id = "upload-task-completed-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=2,
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="completed",
        phase="completed",
        completed_events=2,
        total_events=2,
        progress_message="Processed 2/2: event_b",
        result={
            "success": True,
            "files": [
                {
                    "filename": "event_a.csv",
                    "success": True,
                    "event_id": "event_a",
                    "row_count": 10,
                    "validation_issues": [],
                }
            ],
            "event_ids": ["event_a"],
            "total_rows": 10,
            "pending_channel_map": False,
        },
    )

    _login_writer(auth_client, "upload_task_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["task_id"] == task_id
    assert payload["status"] == "completed"
    assert payload["progress_message"] == "Processed 2/2: event_b"
    assert payload["result"]["success"] is True
    assert payload["result"]["event_ids"] == ["event_a"]


def test_get_upload_folder_task_is_creator_scoped(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_scope_owner")
    other = _create_writer(auth_client, "upload_task_scope_other")
    task_id = "upload-task-scope-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
    )

    _login_writer(auth_client, "upload_task_scope_other")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 404
    assert other["id"] != owner["id"]
