"""Endpoint tests for admin-only database export/import routes."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from server.dependencies import get_export_service
import server.services.active_presence as active_presence_service
from server.services.operation_admission import exclusive_database_operation
from server.services.export import TaskStatus, _put_task, get_task

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


class StubExportService:
    """Small route-test double that avoids real DuckDB export/import work."""

    def get_database_info(self) -> dict[str, Any]:
        return {
            "path": "/tmp/dashboard-test.db",
            "size_mb": 0.0,
            "event_count": 0,
            "program_count": 0,
        }

    def start_export_task(self) -> str:
        return "export-task-1"

    def mark_export_downloading(self, _task_id: str) -> bool:
        return True

    def cancel_task(self, task_id: str) -> bool:
        return task_id == "running-task"

    def cleanup_export_zip(self, _task_id: str) -> None:
        return None


@pytest.fixture(autouse=True)
def stub_export_service(auth_client: TestClient) -> Iterator[None]:
    auth_client.app.dependency_overrides[get_export_service] = StubExportService
    yield
    auth_client.app.dependency_overrides.pop(get_export_service, None)


def _login_admin(client: TestClient) -> dict[str, Any]:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _create_writer(client: TestClient) -> None:
    _login_admin(client)
    response = client.post(
        "/api/v1/admin/users",
        json={
            "username": "writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert response.status_code == 201, response.text
    _logout(client)


def _create_writer_with_username(client: TestClient, username: str) -> dict[str, Any]:
    _login_admin(client)
    response = client.post(
        "/api/v1/admin/users",
        json={
            "username": username,
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert response.status_code == 201, response.text
    _logout(client)
    return response.json()


def _zip_file() -> dict[str, tuple[str, bytes, str]]:
    return {"file": ("portable.zip", b"stub archive", "application/zip")}


def _seed_active_upload_task(
    auth_client: TestClient,
    *,
    task_id: str,
    task_kind: str,
    owner_user_id: str = "admin-1",
    program_id: str = "P-ADMISSION",
    version: str = "V1",
) -> None:
    auth_client.app.state.db.create_upload_task(
        task_id=task_id,
        created_by_user_id=owner_user_id,
        total_events=1,
        task_kind=task_kind,
        phase="running",
        scope={"program_id": program_id, "version": version},
    )
    auth_client.app.state.db.update_upload_task(
        task_id,
        status="running",
        phase="running",
    )


def _seed_stale_active_upload_task(
    auth_client: TestClient,
    *,
    task_id: str,
    task_kind: str,
    owner_user_id: str = "admin-1",
) -> None:
    _seed_active_upload_task(
        auth_client,
        task_id=task_id,
        task_kind=task_kind,
        owner_user_id=owner_user_id,
    )
    auth_client.app.state.db.read_connection.execute(
        """
        UPDATE upload_tasks
        SET
            started_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes',
            last_heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
        WHERE task_id = ?
        """,
        [task_id],
    ).fetchall()


def test_admin_can_download_completed_export_without_logging_reserved_field_error(
    auth_client: TestClient,
    tmp_path: Path,
) -> None:
    _login_admin(auth_client)
    zip_path = tmp_path / "dashboard_export.zip"
    zip_path.write_bytes(b"zip-bytes")
    _put_task(
        TaskStatus(
            task_id="completed-export",
            kind="export",
            status="completed",
            progress="Ready to download",
            zip_path=zip_path,
        )
    )

    response = auth_client.get(
        "/api/v1/export/database/parquet/download/completed-export"
    )

    assert response.status_code == 200, response.text
    assert response.content == b"zip-bytes"
    assert response.headers["content-disposition"] == "attachment; filename=dashboard_export.zip"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/export/database/list"),
        ("GET", "/api/v1/export/database/info"),
        ("POST", "/api/v1/export/database/parquet/export/start"),
        ("GET", "/api/v1/export/database/parquet/task/unknown-task"),
        ("GET", "/api/v1/export/database/parquet/download/unknown-task"),
        ("DELETE", "/api/v1/export/database/parquet/task/unknown-task"),
        ("DELETE", "/api/v1/export/database/parquet/upload/staged-upload"),
        ("POST", "/api/v1/export/database/parquet/import/staged-upload"),
    ],
)
def test_export_routes_reject_unauthenticated_callers(
    auth_client: TestClient,
    method: str,
    path: str,
) -> None:
    response = auth_client.request(method, path)
    assert response.status_code == 401


def test_database_switch_routes_reject_unauthenticated_callers(auth_client: TestClient) -> None:
    create = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "test"},
    )
    assert create.status_code == 401

    connect = auth_client.post(
        "/api/v1/export/database/connect",
        json={
            "database_name": "dashboard.db",
        },
    )
    assert connect.status_code == 401

    delete_db = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": "dashboard-old.db",
            "confirmation": "DELETE dashboard-old.db",
        },
    )
    assert delete_db.status_code == 401


@pytest.mark.parametrize("username", ["reader", "writer"])
def test_export_database_info_rejects_non_admin_users(
    auth_client: TestClient,
    username: str,
) -> None:
    if username == "writer":
        _create_writer(auth_client)
        response = auth_client.post(
            "/api/v1/auth/login",
            json={"username": "writer", "password": "password1234"},
        )
    else:
        response = auth_client.post(
            "/api/v1/auth/register",
            json={"username": "reader", "password": "password1234"},
        )
    assert response.status_code in {200, 201}, response.text

    forbidden = auth_client.get("/api/v1/export/database/info")
    assert forbidden.status_code == 403


@pytest.mark.parametrize("username", ["reader", "writer"])
def test_database_admin_routes_reject_non_admin_users(
    auth_client: TestClient,
    username: str,
) -> None:
    if username == "writer":
        _create_writer(auth_client)
        response = auth_client.post(
            "/api/v1/auth/login",
            json={"username": "writer", "password": "password1234"},
        )
    else:
        response = auth_client.post(
            "/api/v1/auth/register",
            json={"username": "reader", "password": "password1234"},
        )
    assert response.status_code in {200, 201}, response.text

    assert auth_client.get("/api/v1/export/database/list").status_code == 403
    assert (
        auth_client.post("/api/v1/export/database/parquet/export/start").status_code == 403
    )
    assert (
        auth_client.post(
            "/api/v1/export/database/create-new",
            json={"name": "restricted"},
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            "/api/v1/export/database/connect",
            json={"database_name": "dashboard.db"},
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            "/api/v1/export/database/delete",
            json={
                "database_name": "dashboard-test.db",
                "confirmation": "DELETE dashboard-test.db",
            },
        ).status_code
        == 403
    )


def test_admin_can_reach_export_route_contract(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    info = auth_client.get("/api/v1/export/database/info")
    assert info.status_code == 200, info.text
    assert info.json() == {
        "path": "/tmp/dashboard-test.db",
        "size_mb": 0.0,
        "event_count": 0,
        "program_count": 0,
        "max_upload_size_mb": 500,
    }

    started = auth_client.post("/api/v1/export/database/parquet/export/start")
    assert started.status_code == 200, started.text
    assert started.json() == {"task_id": "export-task-1"}


def test_admin_can_create_new_database_without_switching(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    response = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "test"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["created_database"].startswith("dashboard-test-")
    assert payload["created_database"].endswith(".db")
    assert payload["current_database"] == "dashboard.db"
    assert payload["created_database"] in payload["databases"]
    assert payload["current_database"] in payload["databases"]

    assert auth_client.app.state.db.db_path.name == payload["current_database"]


def test_admin_can_login_after_create_new_database(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "test"},
    )
    assert created.status_code == 200, created.text

    _logout(auth_client)
    relogin = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert relogin.status_code == 200, relogin.text


def test_connect_database_clears_runtime_query_cache(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    cache = auth_client.app.state.cache
    cache.set("program_ids:False:False:none", ["STALE_PROGRAM"], ttl_seconds=300)
    assert cache.get("program_ids:False:False:none") == ["STALE_PROGRAM"]

    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "cache-clear"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]

    connected = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )
    assert connected.status_code == 200, connected.text
    assert cache.get("program_ids:False:False:none") is None


def test_connect_database_is_blocked_by_active_folder_upload(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "switch-block-upload"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    _seed_active_upload_task(
        auth_client,
        task_id="active-folder-upload-for-switch",
        task_kind="folder_upload",
    )

    response = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "database_switch"
    blocker = next(item for item in detail["blocked_by"] if item["reason"] == "active_folder_upload")
    assert blocker["last_heartbeat_at"] is not None
    assert blocker.get("cancel_requested_at") is None


def test_connect_database_is_blocked_by_cancelling_folder_upload(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "switch-block-cancelling-upload"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    _seed_active_upload_task(
        auth_client,
        task_id="active-cancelling-upload-for-switch",
        task_kind="folder_upload",
    )
    auth_client.app.state.db.update_upload_task(
        "active-cancelling-upload-for-switch",
        status="cancelling",
        phase="cancelling",
        cancel_requested_at="2026-01-01T00:00:00",
    )

    response = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "database_switch"
    blocker = next(item for item in detail["blocked_by"] if item["reason"] == "active_folder_upload")
    assert blocker["status"] == "cancelling"
    assert blocker["cancel_requested_at"] == "2026-01-01T00:00:00"


def test_connect_database_is_blocked_by_active_derived_task(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "switch-block-derived"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    _seed_active_upload_task(
        auth_client,
        task_id="active-derived-task-for-switch",
        task_kind="damage_calculation",
    )

    response = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "database_switch"
    assert any(item["reason"] == "active_derived_task" for item in detail["blocked_by"])


def test_delete_database_reconciles_stale_active_upload_before_blocking(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "delete-reconcile-stale-upload"},
    )
    assert created.status_code == 200, created.text
    target_db = created.json()["created_database"]
    _seed_stale_active_upload_task(
        auth_client,
        task_id="stale-upload-for-delete",
        task_kind="folder_upload",
    )

    response = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": target_db,
            "confirmation": f"DELETE {target_db}",
        },
    )

    assert response.status_code == 200, response.text
    stale = auth_client.app.state.db.get_upload_task("stale-upload-for-delete")
    assert stale is not None
    assert stale["status"] == "failed"
    assert stale["phase"] == "failed"
    assert "heartbeat expired" in str(stale["error"]).lower()
    assert stale["finished_at"] is not None


def test_delete_database_reconciles_stale_cancelling_upload_before_blocking(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "delete-reconcile-stale-cancelling-upload"},
    )
    assert created.status_code == 200, created.text
    target_db = created.json()["created_database"]
    _seed_stale_active_upload_task(
        auth_client,
        task_id="stale-cancelling-upload-for-delete",
        task_kind="folder_upload",
    )
    auth_client.app.state.db.update_upload_task(
        "stale-cancelling-upload-for-delete",
        status="cancelling",
        phase="cancelling",
        cancel_requested_at="2026-01-01T00:00:00",
    )
    auth_client.app.state.db.read_connection.execute(
        """
        UPDATE upload_tasks
        SET last_heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
        WHERE task_id = ?
        """,
        ["stale-cancelling-upload-for-delete"],
    ).fetchall()

    response = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": target_db,
            "confirmation": f"DELETE {target_db}",
        },
    )

    assert response.status_code == 200, response.text
    stale = auth_client.app.state.db.get_upload_task("stale-cancelling-upload-for-delete")
    assert stale is not None
    assert stale["status"] == "failed"
    assert stale["phase"] == "failed"
    assert "heartbeat expired" in str(stale["error"]).lower()
    assert stale["finished_at"] is not None


def test_connect_database_is_blocked_by_active_other_user_presence(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "switch-block-active-user"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    _create_writer_with_username(auth_client, "switch_presence_other")
    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "switch_presence_other", "password": "password1234"},
    )
    assert login_response.status_code == 200, login_response.text
    heartbeat = auth_client.post(
        "/api/v1/auth/presence/heartbeat",
        json={"active_area": "/dashboard"},
    )
    assert heartbeat.status_code == 200, heartbeat.text
    _login_admin(auth_client)

    response = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "database_switch"
    blocker = next(
        item
        for item in detail["blocked_by"]
        if item["reason"] == "active_database_users"
    )
    assert blocker["usernames"] == ["switch_presence_other"]


def test_connect_database_ignores_expired_user_presence(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "switch-expired-active-user"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    _create_writer_with_username(auth_client, "switch_presence_expired")
    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "switch_presence_expired", "password": "password1234"},
    )
    assert login_response.status_code == 200, login_response.text
    heartbeat = auth_client.post(
        "/api/v1/auth/presence/heartbeat",
        json={"active_area": "/database"},
    )
    assert heartbeat.status_code == 200, heartbeat.text
    _logout(auth_client)
    _login_admin(auth_client)

    monkeypatch.setattr(active_presence_service, "ACTIVE_PRESENCE_TTL_SECONDS", 0)

    response = auth_client.post(
        "/api/v1/export/database/connect",
        json={"database_name": new_db},
    )
    assert response.status_code == 200, response.text


def test_delete_database_is_blocked_by_active_export(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "delete-block-export"},
    )
    assert created.status_code == 200, created.text
    target_db = created.json()["created_database"]
    blocker_task_id = "running-export-blocker"
    _put_task(
        TaskStatus(
            task_id=blocker_task_id,
            kind="export",
            status="running",
            progress="Exporting",
            phase="exporting",
        )
    )
    try:
        response = auth_client.post(
            "/api/v1/export/database/delete",
            json={
                "database_name": target_db,
                "confirmation": f"DELETE {target_db}",
            },
        )

        assert response.status_code == 409, response.text
        detail = response.json()["detail"]
        assert detail["code"] == "operation_blocked"
        assert detail["operation"] == "database_delete"
        assert any(item["reason"] == "active_database_export" for item in detail["blocked_by"])
    finally:
        _put_task(
            TaskStatus(
                task_id=blocker_task_id,
                kind="export",
                status="completed",
                progress="Ready to download",
                phase="pending_download",
            )
        )


def test_create_database_is_blocked_by_active_exclusive_operation(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    with exclusive_database_operation("database_switch"):
        response = auth_client.post(
            "/api/v1/export/database/create-new",
            json={"name": "blocked-create"},
        )

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "operation_blocked"
    assert detail["operation"] == "database_create"
    assert any(
        item["reason"] == "active_exclusive_database_operation" for item in detail["blocked_by"]
    )


def test_non_admin_users_cannot_list_or_connect_database(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "test"},
    )
    assert created.status_code == 200, created.text
    new_db = created.json()["created_database"]
    switched_back = auth_client.post(
        "/api/v1/export/database/connect",
        json={
            "database_name": "dashboard.db",
        },
    )
    assert switched_back.status_code == 200, switched_back.text
    _create_writer(auth_client)
    login_writer = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "writer", "password": "password1234"},
    )
    assert login_writer.status_code == 200, login_writer.text

    listed = auth_client.get("/api/v1/export/database/list")
    assert listed.status_code == 403

    connected = auth_client.post(
        "/api/v1/export/database/connect",
        json={
            "database_name": new_db,
        },
    )
    assert connected.status_code == 403


def test_admin_can_delete_non_active_database(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "delete-me"},
    )
    assert created.status_code == 200, created.text
    target_db = created.json()["created_database"]

    deleted = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": target_db,
            "confirmation": f"DELETE {target_db}",
        },
    )
    assert deleted.status_code == 200, deleted.text
    payload = deleted.json()
    assert payload["deleted_database"] == target_db
    assert target_db not in payload["databases"]
    assert payload["current_database"] == "dashboard.db"


def test_admin_cannot_delete_active_database(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    forbidden = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": "dashboard.db",
            "confirmation": "DELETE dashboard.db",
        },
    )
    assert forbidden.status_code == 400, forbidden.text
    assert "active" in forbidden.json()["detail"].lower()


def test_delete_database_requires_exact_confirmation(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    created = auth_client.post(
        "/api/v1/export/database/create-new",
        json={"name": "confirm-test"},
    )
    assert created.status_code == 200, created.text
    target_db = created.json()["created_database"]

    rejected = auth_client.post(
        "/api/v1/export/database/delete",
        json={
            "database_name": target_db,
            "confirmation": f"CONNECT {target_db}",
        },
    )
    assert rejected.status_code == 400, rejected.text


def test_parquet_upload_rejects_non_admins_before_validation(
    auth_client: TestClient,
) -> None:
    unauthenticated = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert unauthenticated.status_code == 401

    response = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "reader", "password": "password1234"},
    )
    assert response.status_code == 201, response.text

    forbidden = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert forbidden.status_code == 403


def test_admin_can_reach_upload_route_contract(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    uploaded = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert uploaded.status_code == 410, uploaded.text
    assert "removed" in uploaded.json()["detail"].lower()
    assert "export" in uploaded.json()["detail"].lower()
    assert "connect" in uploaded.json()["detail"].lower()


def test_task_status_includes_export_progress_fields(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    task = TaskStatus(
        task_id="progress-task",
        kind="export",
        phase="exporting",
        sub_phase="",
        progress="Exporting dim_event (12/16)…",
        current=12,
        total=16,
        current_table="dim_event",
    )
    _put_task(task)

    response = auth_client.get("/api/v1/export/database/parquet/task/progress-task")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sub_phase"] == ""
    assert body["updated_at"] > 0
    assert body["current"] == 12
    assert body["total"] == 16


def test_export_task_stall_threshold_remains_two_minutes(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    _put_task(TaskStatus(task_id="slow-export", kind="export", progress="Exporting"))
    task = get_task("slow-export")
    assert task is not None
    task.updated_at = time.time() - 180

    export_response = auth_client.get("/api/v1/export/database/parquet/task/slow-export")

    assert export_response.status_code == 200, export_response.text
    assert export_response.json()["status"] == "failed"
    assert "2 minutes" in export_response.json()["error"]


def test_admin_can_reach_import_and_cleanup_route_contract(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)

    imported = auth_client.post("/api/v1/export/database/parquet/import/staged-upload")
    assert imported.status_code == 410, imported.text
    assert "removed" in imported.json()["detail"].lower()
    assert "export" in imported.json()["detail"].lower()
    assert "connect" in imported.json()["detail"].lower()

    cancelled_upload = auth_client.delete(
        "/api/v1/export/database/parquet/upload/staged-upload"
    )
    assert cancelled_upload.status_code == 410, cancelled_upload.text
    assert "removed" in cancelled_upload.json()["detail"].lower()

    cancelled_task = auth_client.delete(
        "/api/v1/export/database/parquet/task/running-task"
    )
    assert cancelled_task.status_code == 200, cancelled_task.text
    assert cancelled_task.json() == {"ok": True}

