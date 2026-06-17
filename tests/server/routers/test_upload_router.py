"""Endpoint tests for upload write-path ownership boundaries."""

from __future__ import annotations

import hashlib
import time
from typing import Any

from fastapi.testclient import TestClient
from server.services.operation_admission import exclusive_database_operation
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


def _register_reader(client: TestClient, username: str) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": WRITER_PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _count_upload_tasks(client: TestClient) -> int:
    row = client.app.state.db.read_connection.execute(
        "SELECT COUNT(*) AS count FROM upload_tasks"
    ).fetchone()
    return int(row[0]) if row is not None else 0


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


def _seed_failed_folder_upload_task(
    client: TestClient,
    *,
    task_id: str,
    owner_user_id: str,
    event_ids: list[str],
    program_id: str,
    version: str,
    file_hash: str,
    status: str = "failed",
) -> None:
    for event_id in event_ids:
        client.app.state.db.insert_event(
            event_id=event_id,
            program_id=program_id,
            version=version,
            uploaded_by_user_id=owner_user_id,
            status="Pending",
            source_file=f"{event_id}.csv",
            file_hash=file_hash,
        )
    client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner_user_id,
        total_events=max(1, len(event_ids)),
        task_kind="folder_upload",
        phase="failed" if status == "failed" else "cancelled",
        scope={"program_id": program_id, "version": version},
    )
    client.app.state.db.update_upload_task(
        task_id,
        status=status,
        phase="failed" if status == "failed" else "cancelled",
        error="Validation failed after partial commit" if status == "failed" else None,
        result={
            "success": False,
            "files": [],
            "event_ids": event_ids,
            "total_rows": 0,
            "pending_channel_map": False,
        },
    )


def _wait_for_upload_task_terminal_state(
    client: TestClient,
    *,
    task_id: str,
    timeout_seconds: float = 10.0,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/upload/folder/task/{task_id}")
        assert response.status_code == 200, response.text
        payload = response.json()
        if payload["status"] in {"completed", "failed", "cancelled"}:
            return payload
        time.sleep(0.05)
    raise TimeoutError(f"Upload task {task_id} did not reach terminal state")


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
        scope={"program_id": "P-OBS", "version": "V1"},
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
    assert payload["terminal_state"] == "completed"
    assert payload["task_owner_user_id"] == owner["id"]
    assert payload["task_kind"] == "folder_upload"
    assert payload["scope"] == {"program_id": "P-OBS", "version": "V1"}
    assert payload["progress_message"] == "Processed 2/2: event_b"
    assert payload["result_summary"] == "Succeeded: 1 events across 1 files"
    assert payload["result"]["success"] is True
    assert payload["result"]["event_ids"] == ["event_a"]


def test_get_upload_folder_task_includes_error_details_for_failed_task(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_error_owner")
    task_id = "upload-task-failed-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        scope={"program_id": "P-OBS-ERR", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="failed",
        phase="failed",
        error='{"code":"upload_validation_failed","reason":"Bad source row"}',
    )

    _login_writer(auth_client, "upload_task_error_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["terminal_state"] == "failed"
    assert payload["task_owner_user_id"] == owner["id"]
    assert payload["task_kind"] == "folder_upload"
    assert payload["scope"] == {"program_id": "P-OBS-ERR", "version": "V1"}
    assert payload["error"] == '{"code":"upload_validation_failed","reason":"Bad source row"}'
    assert payload["error_details"]["code"] == "upload_validation_failed"
    assert payload["error_details"]["reason"] == "Bad source row"
    assert payload["error_details"]["cleanup_required"] is False
    assert payload["error_details"]["cleanup_candidate_event_count"] == 0
    assert payload["result_summary"] is None


def test_get_upload_folder_task_includes_lifecycle_timestamps_and_runner(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_lifecycle_owner")
    task_id = "upload-task-lifecycle-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=2,
        scope={"program_id": "P-LIFECYCLE", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="running",
        phase="writing",
        runner_id="worker-lifecycle",
        cancel_requested_at="2026-01-01T00:05:00",
    )

    _login_writer(auth_client, "upload_task_lifecycle_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "running"
    assert payload["started_at"] is not None
    assert payload["cancel_requested_at"] is not None
    assert payload["last_heartbeat_at"] is not None
    assert payload["finished_at"] is None
    assert payload["runner_id"] == "worker-lifecycle"


def test_get_upload_folder_task_reconciles_stale_running_rows_to_failed(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_stale_owner")
    task_id = "upload-task-stale-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        scope={"program_id": "P-STALE", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="running",
        phase="writing",
    )
    auth_client.app.state.db.read_connection.execute(
        """
        UPDATE upload_tasks
        SET
            started_at = CURRENT_TIMESTAMP - INTERVAL '15 minutes',
            last_heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        WHERE task_id = ?
        """,
        [task_id],
    ).fetchall()

    _login_writer(auth_client, "upload_task_stale_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["phase"] == "failed"
    assert payload["finished_at"] is not None
    assert "heartbeat expired" in (payload["error"] or "").lower()


def test_get_upload_folder_task_failed_event_reports_cleanup_guidance(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_cleanup_guidance_owner")
    task_id = "upload-task-failed-cleanup-001"
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cleanup_guidance_event"],
        program_id="P-CLEANUP-GUIDE",
        version="V1",
        file_hash="cleanup-guidance-hash",
    )

    _login_writer(auth_client, "upload_task_cleanup_guidance_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["error_details"]["cleanup_required"] is True
    assert payload["error_details"]["cleanup_candidate_event_count"] == 1
    assert payload["error_details"]["retry_guidance"] == (
        "This upload failed after partially committing data. "
        "Run failed-upload cleanup before retrying the same files."
    )


def test_get_upload_folder_task_startup_reconciled_failure_reports_retry_guidance(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_restart_guidance_owner")
    task_id = "upload-task-failed-restart-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=2,
        task_kind="folder_upload",
        phase="failed",
        scope={"program_id": "P-CLEANUP-RESTART", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="failed",
        phase="failed",
        error="Task interrupted by server restart",
    )

    _login_writer(auth_client, "upload_task_restart_guidance_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["error_details"]["cleanup_required"] is False
    assert payload["error_details"]["cleanup_candidate_event_count"] == 0
    assert payload["error_details"]["retry_guidance"] == (
        "This upload failed or was interrupted. "
        "Run failed-upload cleanup before retrying if duplicate hash errors appear."
    )


def test_get_upload_folder_task_cancelled_partial_commit_reports_cleanup_guidance(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_task_cancelled_cleanup_owner")
    task_id = "upload-task-cancelled-cleanup-001"
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cancelled_cleanup_event"],
        program_id="P-CANCELLED-CLEANUP",
        version="V1",
        file_hash="cancelled-cleanup-hash",
        status="cancelled",
    )

    _login_writer(auth_client, "upload_task_cancelled_cleanup_owner")
    response = auth_client.get(f"/api/v1/upload/folder/task/{task_id}")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "cancelled"
    assert payload["error_details"]["cleanup_required"] is True
    assert payload["error_details"]["cleanup_candidate_event_count"] == 1
    assert payload["error_details"]["retry_guidance"] == (
        "This upload was cancelled after partially committing data. "
        "Run failed-upload cleanup before retrying the same files."
    )


def test_cancelled_folder_upload_cleanup_allows_retry_for_same_file_hash(
    auth_client: TestClient,
) -> None:
    owner_username = "upload_cancelled_cleanup_retry_owner"
    owner = _create_writer(auth_client, owner_username)
    task_id = "upload-cancelled-cleanup-task-retry"
    duplicate_content = b"time,accel\n0,1\n1,2\n"
    duplicate_hash = hashlib.sha256(duplicate_content).hexdigest()[:16]
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cancelled-cleanup-retry-event"],
        program_id="P-CANCELLED-CLEANUP-RETRY",
        version="V1",
        file_hash=duplicate_hash,
        status="cancelled",
    )

    _login_writer(auth_client, owner_username)
    blocked_start = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-CANCELLED-CLEANUP-RETRY",
            "version": "V1",
            "job_number": "JOB-CANCELLED-RETRY",
            "work_order": "WO-CANCELLED-RETRY",
        },
        files=[
            ("files", ("retry.csv", duplicate_content, "text/csv")),
        ],
    )
    assert blocked_start.status_code == 200, blocked_start.text
    blocked_payload = _wait_for_upload_task_terminal_state(
        auth_client,
        task_id=blocked_start.json()["task_id"],
    )
    assert blocked_payload["status"] == "failed"
    assert "already been uploaded" in (blocked_payload["error"] or "")

    cleanup = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cleanup")
    assert cleanup.status_code == 200, cleanup.text
    assert cleanup.json()["deleted_event_ids"] == ["cancelled-cleanup-retry-event"]

    retry_start = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-CANCELLED-CLEANUP-RETRY",
            "version": "V1",
            "job_number": "JOB-CANCELLED-RETRY",
            "work_order": "WO-CANCELLED-RETRY",
        },
        files=[
            ("files", ("retry.csv", duplicate_content, "text/csv")),
        ],
    )
    assert retry_start.status_code == 200, retry_start.text
    retry_payload = _wait_for_upload_task_terminal_state(
        auth_client,
        task_id=retry_start.json()["task_id"],
    )
    assert retry_payload["status"] == "completed"
    assert retry_payload["result"]["success"] is True


def test_failed_folder_upload_cleanup_is_owner_or_admin_only(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cleanup_owner")
    other = _create_writer(auth_client, "upload_cleanup_other")
    task_id = "upload-cleanup-task-owner-only"
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cleanup-owner-event"],
        program_id="P-CLEANUP-AUTH",
        version="V1",
        file_hash="cleanup-auth-hash",
    )

    _login_writer(auth_client, "upload_cleanup_other")
    forbidden = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cleanup")
    assert forbidden.status_code == 403
    assert other["id"] != owner["id"]
    assert auth_client.app.state.db.get_event("cleanup-owner-event") is not None

    _logout(auth_client)
    _login_admin(auth_client)
    allowed = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cleanup")
    assert allowed.status_code == 200, allowed.text
    payload = allowed.json()
    assert payload["deleted"] is True
    assert payload["task_id"] == task_id
    assert payload["deleted_event_ids"] == ["cleanup-owner-event"]
    assert auth_client.app.state.db.get_event("cleanup-owner-event") is None


def test_failed_folder_upload_cleanup_deletes_only_failed_task_events(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cleanup_scope_owner")
    task_id = "upload-cleanup-task-scope"
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cleanup-target-event"],
        program_id="P-CLEANUP-SCOPE",
        version="V1",
        file_hash="cleanup-shared-hash",
    )
    auth_client.app.state.db.insert_event(
        event_id="cleanup-unrelated-success",
        program_id="P-CLEANUP-SCOPE",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Approved",
        source_file="cleanup-unrelated-success.csv",
        file_hash="cleanup-unrelated-hash",
    )

    _login_writer(auth_client, "upload_cleanup_scope_owner")
    response = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cleanup")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["deleted_event_ids"] == ["cleanup-target-event"]

    assert auth_client.app.state.db.get_event("cleanup-target-event") is None
    assert auth_client.app.state.db.get_event("cleanup-unrelated-success") is not None
    remaining_hashes = auth_client.app.state.db.get_file_hashes("P-CLEANUP-SCOPE", "V1")
    assert "cleanup-shared-hash" not in remaining_hashes
    assert "cleanup-unrelated-hash" in remaining_hashes


def test_failed_folder_upload_cleanup_allows_reuploading_same_file_hash(
    auth_client: TestClient,
) -> None:
    owner_username = "upload_cleanup_retry_owner"
    owner = _create_writer(auth_client, owner_username)
    task_id = "upload-cleanup-task-retry"
    duplicate_content = b"time,accel\n0,1\n1,2\n"
    duplicate_hash = hashlib.sha256(duplicate_content).hexdigest()[:16]
    _seed_failed_folder_upload_task(
        auth_client,
        task_id=task_id,
        owner_user_id=owner["id"],
        event_ids=["cleanup-retry-event"],
        program_id="P-CLEANUP-RETRY",
        version="V1",
        file_hash=duplicate_hash,
    )

    _login_writer(auth_client, owner_username)
    blocked_start = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-CLEANUP-RETRY",
            "version": "V1",
            "job_number": "JOB-RETRY",
            "work_order": "WO-RETRY",
        },
        files=[
            ("files", ("retry.csv", duplicate_content, "text/csv")),
        ],
    )
    assert blocked_start.status_code == 200, blocked_start.text
    blocked_payload = _wait_for_upload_task_terminal_state(
        auth_client,
        task_id=blocked_start.json()["task_id"],
    )
    assert blocked_payload["status"] == "failed"
    assert "already been uploaded" in (blocked_payload["error"] or "")

    cleanup = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cleanup")
    assert cleanup.status_code == 200, cleanup.text
    cleanup_payload = cleanup.json()
    assert cleanup_payload["deleted_event_ids"] == ["cleanup-retry-event"]

    retry_start = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-CLEANUP-RETRY",
            "version": "V1",
            "job_number": "JOB-RETRY",
            "work_order": "WO-RETRY",
        },
        files=[
            ("files", ("retry.csv", duplicate_content, "text/csv")),
        ],
    )
    assert retry_start.status_code == 200, retry_start.text
    retry_payload = _wait_for_upload_task_terminal_state(
        auth_client,
        task_id=retry_start.json()["task_id"],
    )
    assert retry_payload["status"] == "completed"
    assert retry_payload["result"]["success"] is True
    assert retry_payload["result"]["event_ids"] == ["retry"]


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


def test_get_active_upload_tasks_returns_creator_scoped_folder_and_recent_terminal(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_discovery_owner")
    other = _create_writer(auth_client, "upload_discovery_other")

    auth_client.app.state.db.create_upload_task(
        task_id="upload-discovery-active-owner",
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="writing",
        scope={"program_id": "P-DISCOVERY", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        "upload-discovery-active-owner",
        status="running",
        phase="writing",
    )
    auth_client.app.state.db.create_upload_task(
        task_id="upload-discovery-active-other",
        created_by_user_id=other["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="writing",
        scope={"program_id": "P-DISCOVERY", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        "upload-discovery-active-other",
        status="running",
        phase="writing",
    )
    _seed_failed_folder_upload_task(
        auth_client,
        task_id="upload-discovery-terminal-owner",
        owner_user_id=owner["id"],
        event_ids=["discovery-failed-event"],
        program_id="P-DISCOVERY",
        version="V1",
        file_hash="discovery-terminal-hash",
    )

    _login_writer(auth_client, "upload_discovery_owner")
    response = auth_client.get("/api/v1/upload/tasks/active")

    assert response.status_code == 200, response.text
    payload = response.json()
    active_ids = {task["task_id"] for task in payload["active_tasks"]}
    recent_ids = {task["task_id"] for task in payload["recent_terminal_tasks"]}
    assert "upload-discovery-active-owner" in active_ids
    assert "upload-discovery-active-other" not in active_ids
    assert "upload-discovery-terminal-owner" in recent_ids


def test_get_active_upload_tasks_returns_derived_only_for_scope_owner_or_admin(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_discovery_scope_owner")
    creator = _create_writer(auth_client, "upload_discovery_scope_creator")
    _create_writer(auth_client, "upload_discovery_scope_other")

    auth_client.app.state.db.insert_event(
        event_id="derived-discovery-event",
        program_id="P-DERIVED-DISCOVERY",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Approved",
    )
    auth_client.app.state.db.create_upload_task(
        task_id="derived-discovery-task",
        created_by_user_id=creator["id"],
        total_events=1,
        task_kind="channel_reprocess",
        phase="processing",
        scope={"program_id": "P-DERIVED-DISCOVERY", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        "derived-discovery-task",
        status="running",
        phase="processing",
    )

    _login_writer(auth_client, "upload_discovery_scope_owner")
    owner_response = auth_client.get("/api/v1/upload/tasks/active")
    assert owner_response.status_code == 200, owner_response.text
    owner_ids = {task["task_id"] for task in owner_response.json()["active_tasks"]}
    assert "derived-discovery-task" in owner_ids

    _logout(auth_client)
    _login_writer(auth_client, "upload_discovery_scope_other")
    other_response = auth_client.get("/api/v1/upload/tasks/active")
    assert other_response.status_code == 200, other_response.text
    other_ids = {task["task_id"] for task in other_response.json()["active_tasks"]}
    assert "derived-discovery-task" not in other_ids

    _logout(auth_client)
    _login_admin(auth_client)
    admin_response = auth_client.get("/api/v1/upload/tasks/active")
    assert admin_response.status_code == 200, admin_response.text
    admin_ids = {task["task_id"] for task in admin_response.json()["active_tasks"]}
    assert "derived-discovery-task" in admin_ids


def test_get_active_upload_tasks_reconciles_stale_heartbeats_before_response(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_discovery_stale_owner")
    task_id = "upload-discovery-stale-task"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="writing",
        scope={"program_id": "P-DISCOVERY-STALE", "version": "V1"},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="running",
        phase="writing",
    )
    auth_client.app.state.db.read_connection.execute(
        """
        UPDATE upload_tasks
        SET
            started_at = CURRENT_TIMESTAMP - INTERVAL '15 minutes',
            last_heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        WHERE task_id = ?
        """,
        [task_id],
    ).fetchall()

    _login_writer(auth_client, "upload_discovery_stale_owner")
    response = auth_client.get("/api/v1/upload/tasks/active")

    assert response.status_code == 200, response.text
    payload = response.json()
    active_ids = {task["task_id"] for task in payload["active_tasks"]}
    recent_ids = {task["task_id"] for task in payload["recent_terminal_tasks"]}
    assert task_id not in active_ids
    assert task_id in recent_ids

    refreshed = auth_client.app.state.db.get_upload_task(task_id)
    assert refreshed is not None
    assert refreshed["status"] == "failed"


def test_cancel_upload_task_owner_can_mark_folder_upload_cancelling(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_owner")
    task_id = "upload-cancel-owner-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=3,
        task_kind="folder_upload",
        phase="upload_received",
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="running",
        phase="writing",
    )

    _login_writer(auth_client, "upload_cancel_owner")
    response = auth_client.post(f"/api/v1/upload/tasks/{task_id}/cancel")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["task_id"] == task_id
    assert payload["task_kind"] == "folder_upload"
    assert payload["status"] == "cancelling"
    assert payload["cancel_requested_at"] is not None

    refreshed = auth_client.app.state.db.get_upload_task(task_id)
    assert refreshed is not None
    assert refreshed["status"] == "cancelling"
    assert refreshed["cancel_requested_at"] is not None


def test_cancel_upload_task_admin_can_cancel_other_users_folder_upload(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_admin_owner")
    task_id = "upload-cancel-admin-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="upload_received",
    )
    auth_client.app.state.db.update_upload_task(task_id, status="running", phase="writing")

    _login_admin(auth_client)
    response = auth_client.post(f"/api/v1/upload/tasks/{task_id}/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "cancelling"


def test_cancel_upload_task_forbidden_for_unrelated_folder_upload_user(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_forbidden_owner")
    _create_writer(auth_client, "upload_cancel_forbidden_other")
    task_id = "upload-cancel-forbidden-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=2,
        task_kind="folder_upload",
        phase="upload_received",
    )
    auth_client.app.state.db.update_upload_task(task_id, status="running", phase="writing")

    _login_writer(auth_client, "upload_cancel_forbidden_other")
    response = auth_client.post(f"/api/v1/upload/tasks/{task_id}/cancel")

    assert response.status_code == 403
    refreshed = auth_client.app.state.db.get_upload_task(task_id)
    assert refreshed is not None
    assert refreshed["status"] == "running"
    assert refreshed["cancel_requested_at"] is None


def test_cancel_upload_task_is_idempotent_for_already_cancelling_task(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_idempotent_owner")
    task_id = "upload-cancel-idempotent-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="upload_received",
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="cancelling",
        phase="writing",
        cancel_requested_at="2026-01-01T01:02:03",
    )

    _login_writer(auth_client, "upload_cancel_idempotent_owner")
    response = auth_client.post(f"/api/v1/upload/tasks/{task_id}/cancel")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "cancelling"
    assert payload["cancel_requested_at"] == "2026-01-01T01:02:03"


def test_cancel_upload_task_terminal_rows_return_without_mutation(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_terminal_owner")
    task_id = "upload-cancel-terminal-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="completed",
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="completed",
        phase="completed",
    )

    _login_writer(auth_client, "upload_cancel_terminal_owner")
    response = auth_client.post(f"/api/v1/upload/tasks/{task_id}/cancel")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["terminal_state"] == "completed"
    assert payload["cancel_requested_at"] is None

    refreshed = auth_client.app.state.db.get_upload_task(task_id)
    assert refreshed is not None
    assert refreshed["status"] == "completed"
    assert refreshed["cancel_requested_at"] is None


def test_cancel_upload_task_folder_alias_routes_to_same_contract(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "upload_cancel_alias_owner")
    task_id = "upload-cancel-folder-alias-001"
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner["id"],
        total_events=1,
        task_kind="folder_upload",
        phase="upload_received",
    )

    _login_writer(auth_client, "upload_cancel_alias_owner")
    response = auth_client.post(f"/api/v1/upload/folder/task/{task_id}/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "cancelling"


def test_folder_upload_start_forbids_read_only_user_before_parsing_or_task_creation(
    auth_client: TestClient,
    monkeypatch: Any,
) -> None:
    _register_reader(auth_client, "folder_read_only")
    login(auth_client, "folder_read_only", WRITER_PASSWORD)

    parse_called = False

    async def _parse_upload_payload_should_not_run(**_: Any) -> Any:
        nonlocal parse_called
        parse_called = True
        raise AssertionError("_parse_upload_payload should not run for read-only users")

    from server.routers import upload as upload_router_module

    monkeypatch.setattr(
        upload_router_module,
        "_parse_upload_payload",
        _parse_upload_payload_should_not_run,
    )

    before_tasks = _count_upload_tasks(auth_client)
    response = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-READ-ONLY",
            "version": "V1",
            "job_number": "JOB-1",
            "work_order": "WO-1",
        },
        files=[
            ("files", ("event.csv", b"time,accel\n0,1\n", "text/csv")),
        ],
    )

    assert response.status_code == 403
    assert parse_called is False
    assert _count_upload_tasks(auth_client) == before_tasks


def test_folder_upload_start_allows_write_user_with_existing_response_shape(
    auth_client: TestClient,
) -> None:
    _create_writer(auth_client, "folder_writer")
    _login_writer(auth_client, "folder_writer")

    response = auth_client.post(
        "/api/v1/upload/folder/start",
        data={
            "program_id": "P-WRITER",
            "version": "V1",
            "job_number": "JOB-2",
            "work_order": "WO-2",
        },
        files=[
            ("files", ("event.csv", b"time,accel\n0,1\n", "text/csv")),
        ],
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert isinstance(payload.get("task_id"), str)
    assert payload["task_id"]


def test_folder_upload_start_is_blocked_by_exclusive_database_operation(
    auth_client: TestClient,
) -> None:
    _create_writer(auth_client, "folder_writer_blocked")
    _login_writer(auth_client, "folder_writer_blocked")

    with exclusive_database_operation("database_switch"):
        response = auth_client.post(
            "/api/v1/upload/folder/start",
            data={
                "program_id": "P-WRITER-BLOCKED",
                "version": "V1",
                "job_number": "JOB-3",
                "work_order": "WO-3",
            },
            files=[
                ("files", ("event.csv", b"time,accel\n0,1\n", "text/csv")),
            ],
        )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "folder_upload"
    assert any(
        item["reason"] == "active_exclusive_database_operation" for item in detail["blocked_by"]
    )
