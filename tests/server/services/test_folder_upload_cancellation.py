from __future__ import annotations

import threading
import time

from server.services.ingestion import IngestionService


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _wait_for_terminal_task(test_database, task_id: str, *, timeout_seconds: float = 10.0) -> dict:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        task = test_database.get_upload_task(task_id)
        if task and str(task.get("status") or "") in {"completed", "failed", "cancelled"}:
            return task
        time.sleep(0.05)
    raise TimeoutError(f"Upload task {task_id} did not finish within {timeout_seconds}s")


def test_folder_upload_cancelled_before_first_commit_marks_task_cancelled_without_cleanup(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("cancel_before_commit_owner")
    parse_started = threading.Event()
    release_parse = threading.Event()
    original_parse = service.parser.parse

    def blocking_parse(content: bytes, filename: str):
        parse_started.set()
        assert release_parse.wait(timeout=5), "timed out waiting to release parse"
        return original_parse(content, filename)

    service.parser.parse = blocking_parse

    task_id = service.start_upload_task(
        files=[("cancel_before_commit.csv", sample_csv_content)],
        program_id="P-CANCEL-PRECOMMIT",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-CANCEL-1", "work_order": "WO-CANCEL-1"},
        custom_field_values={},
    )
    assert parse_started.wait(timeout=2), "worker did not begin parsing"

    test_database.request_upload_task_cancel(task_id)
    release_parse.set()
    terminal = _wait_for_terminal_task(test_database, task_id)

    assert terminal["status"] == "cancelled"
    result = terminal["result_json"]
    assert result["cleanup_required"] is False
    assert result["cleanup_candidate_event_count"] == 0
    assert result["event_ids"] == []
    assert test_database.get_events(program_id="P-CANCEL-PRECOMMIT", version="V1") == []


def test_folder_upload_cancelled_after_partial_commit_marks_cleanup_required(
    test_database,
    test_cache,
    test_settings,
    sample_csv_content,
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("cancel_partial_commit_owner")
    second_parse_started = threading.Event()
    release_second_parse = threading.Event()
    original_parse = service.parser.parse
    parse_count = {"count": 0}

    def blocking_second_parse(content: bytes, filename: str):
        parse_count["count"] += 1
        if parse_count["count"] == 2:
            second_parse_started.set()
            assert release_second_parse.wait(timeout=5), "timed out waiting to release second parse"
        return original_parse(content, filename)

    service.parser.parse = blocking_second_parse

    task_id = service.start_upload_task(
        files=[
            ("event_first.csv", sample_csv_content),
            ("event_second.csv", sample_csv_content + b"\n"),
        ],
        program_id="P-CANCEL-PARTIAL",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-CANCEL-2", "work_order": "WO-CANCEL-2"},
        custom_field_values={},
    )
    assert second_parse_started.wait(timeout=3), "second parse checkpoint was not reached"

    test_database.request_upload_task_cancel(task_id)
    release_second_parse.set()
    terminal = _wait_for_terminal_task(test_database, task_id)

    assert terminal["status"] == "cancelled"
    result = terminal["result_json"]
    assert result["cleanup_required"] is True
    assert result["cleanup_candidate_event_count"] == 1
    assert len(result["event_ids"]) == 1
    remaining_events = test_database.get_events(program_id="P-CANCEL-PARTIAL", version="V1")
    assert len(remaining_events) == 1
    assert remaining_events[0]["event_id"] == result["event_ids"][0]
