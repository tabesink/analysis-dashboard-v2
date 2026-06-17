import time
import zipfile
from pathlib import Path

import pandas as pd
import pytest
from server.services.export import (
    ExportService,
    TaskStatus,
    _is_managed_artifact_member,
    _tasks,
    _tasks_lock,
    get_task,
    reconcile_persisted_parquet_tasks,
)
from server.services.transfer_package import MANIFEST_FILENAME


def _insert_program(store, program_id: str) -> None:
    with store.write_connection() as conn:
        conn.execute(
            "INSERT INTO dim_program (program_id, name) VALUES (?, ?)",
            [program_id, program_id],
        )


def _insert_measurements(store, event_id: str) -> None:
    store.insert_measurements(
        event_id,
        pd.DataFrame(
            [
                {"timestamp": 0.0, "channel_name": "Force_X", "value": 1.0},
                {"timestamp": 0.1, "channel_name": "Force_X", "value": 2.0},
            ]
        ),
    )
    with store.write_connection() as conn:
        conn.execute(
            """
            INSERT INTO measurements_lttb (event_id, plot_key, x, y)
            VALUES (?, ?, ?, ?)
            """,
            [event_id, "plot_1", 0.0, 1.0],
        )


def _insert_event_with_load_data(store, *, event_id: str, program_id: str, user_id: str) -> None:
    _insert_program(store, program_id)
    store.insert_event(
        event_id=event_id,
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=user_id,
        status="Approved",
        source_file=f"{event_id}.csv",
        file_hash=event_id[:16],
    )
    store.upsert_channel_map(
        program_id=program_id,
        version="V1",
        plot_key="plot_1",
        x_channel="Time",
        y_channel="Force_X",
        x_col=0,
        y_col=1,
        x_unit="s",
        y_unit="N",
    )
    _insert_measurements(store, event_id)
    store.upsert_event_custom_field_values(event_id, {"source_field": "source value"})


def test_export_task_produces_transfer_package_without_legacy_managed_artifacts(
    test_database,
    test_settings,
) -> None:
    service = ExportService(test_database, test_settings)
    owner = test_database.create_user("export_artifact_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="export-artifact-event",
        program_id="P-EXPORT-ARTIFACT",
        user_id=owner["id"],
    )
    retained_file = (
        test_settings.data_root
        / "artifacts"
        / "channel-map"
        / "P-EXPORT-ARTIFACT"
        / "V1"
        / "retained.csv"
    )
    retained_file.parent.mkdir(parents=True)
    retained_file.write_text("raw,retained,data", encoding="utf-8")

    task_id = service.start_export_task()
    deadline = time.monotonic() + 3
    task = get_task(task_id)
    while task and task.status == "running" and time.monotonic() < deadline:
        time.sleep(0.01)
        task = get_task(task_id)

    try:
        assert task is not None
        assert task.status == "completed"
        assert task.zip_path is not None
        with zipfile.ZipFile(task.zip_path) as archive:
            names = set(archive.namelist())
        assert MANIFEST_FILENAME in names
        assert "source_artifacts.parquet" in names
        assert all(not _is_managed_artifact_member(name) for name in names)
    finally:
        service.cleanup_export_zip(task_id)


def test_reconcile_marks_orphaned_running_tasks_failed(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import server.services.export as export_module
    from server.services.export import _put_task

    task_dir = tmp_path / "scratch-reconcile" / "parquet-tasks"
    monkeypatch.setattr(export_module, "_parquet_task_state_dir", lambda: task_dir)
    with _tasks_lock:
        _tasks.clear()

    _put_task(TaskStatus(task_id="orphan-export", kind="export", status="running", phase="exporting"))
    with _tasks_lock:
        _tasks.clear()

    reconcile_persisted_parquet_tasks()
    reloaded = get_task("orphan-export")
    assert reloaded is not None
    assert reloaded.status == "failed"
    assert "restarted" in (reloaded.error or "").lower()
