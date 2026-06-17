"""Runtime data backfills applied after declared schema DDL."""

from __future__ import annotations

import csv
import json
from typing import Any

from server.upload.task_kinds import ACTIVE_UPLOAD_TASK_KINDS, ACTIVE_TASK_STATUSES


def _column_exists(conn: Any, table_name: str, column_name: str) -> bool:
    return (
        conn.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = ? AND column_name = ?
            """,
            [table_name, column_name],
        ).fetchone()[0]
        > 0
    )


def _table_exists(conn: Any, table_name: str) -> bool:
    return (
        conn.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'main' AND table_name = ?
            """,
            [table_name],
        ).fetchone()[0]
        > 0
    )


def _primary_key_columns(conn: Any, table_name: str) -> list[str]:
    rows = conn.execute(
        """
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_name = kcu.table_name
        WHERE tc.table_name = ?
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
        """,
        [table_name],
    ).fetchall()
    return [str(row[0]) for row in rows]


def _generic_col_index(value: Any) -> int | None:
    text = str(value or "").strip()
    if not text.startswith("col_") or not text[4:].isdigit():
        return None
    return int(text[4:])


def _preview_metadata_row(preview_json: Any, marker: str) -> list[str]:
    try:
        preview = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(preview, dict):
        return []
    lines = preview.get("lines", [])
    if not isinstance(lines, list):
        return []
    for index, line in enumerate(lines[:-1]):
        if str(line).strip() == marker:
            return next(csv.reader([str(lines[index + 1])]))
    return []


def _backfill_channel_map_headers(conn: Any) -> None:
    required = (
        _column_exists(conn, "dim_channel_map", "x_channel")
        and _column_exists(conn, "dim_channel_map", "y_channel")
        and _column_exists(conn, "ingestion_artifacts", "preview_json")
    )
    if not required:
        return

    rows = conn.execute(
        """
        SELECT
            cm.id,
            cm.x_channel,
            cm.y_channel,
            ia.preview_json
        FROM dim_channel_map cm
        JOIN ingestion_artifacts ia
          ON ia.program_id = cm.program_id
         AND ia.version = cm.version
        WHERE cm.x_channel LIKE 'col_%'
           OR cm.y_channel LIKE 'col_%'
        ORDER BY cm.id, ia.status = 'processed' DESC, ia.created_at, ia.artifact_id
        """
    ).fetchall()

    repaired_ids: set[int] = set()
    for row_id, x_channel, y_channel, preview_json in rows:
        row_id = int(row_id)
        if row_id in repaired_ids:
            continue
        headers = _preview_metadata_row(preview_json, "#TITLES")
        units = _preview_metadata_row(preview_json, "#UNITS")
        if not headers:
            continue

        updates: list[str] = []
        params: list[Any] = []
        x_index = _generic_col_index(x_channel)
        y_index = _generic_col_index(y_channel)
        if x_index is not None and x_index < len(headers):
            updates.append("x_channel = ?")
            params.append(headers[x_index])
            if x_index < len(units):
                updates.append("x_unit = ?")
                params.append(units[x_index] or None)
        if y_index is not None and y_index < len(headers):
            updates.append("y_channel = ?")
            params.append(headers[y_index])
            if y_index < len(units):
                updates.append("y_unit = ?")
                params.append(units[y_index] or None)

        if not updates:
            continue
        params.append(row_id)
        conn.execute(
            f"UPDATE dim_channel_map SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        repaired_ids.add(row_id)


def _repair_event_channel_damage_primary_key(conn: Any) -> None:
    if not _table_exists(conn, "event_channel_damage"):
        return
    if _primary_key_columns(conn, "event_channel_damage") == ["event_id", "channel_key"]:
        return

    legacy_table = "event_channel_damage__legacy_pk_repair"
    conn.execute(f"DROP TABLE IF EXISTS {legacy_table}")
    conn.execute("DROP INDEX IF EXISTS idx_event_channel_damage_event")
    conn.execute(f"ALTER TABLE event_channel_damage RENAME TO {legacy_table}")
    conn.execute(
        """
        CREATE TABLE event_channel_damage (
            event_id VARCHAR NOT NULL,
            channel_key VARCHAR NOT NULL,
            channel_name VARCHAR NOT NULL,
            channel_unit VARCHAR,
            base_damage DOUBLE,
            scheduled_damage DOUBLE,
            repeats INTEGER,
            weight DOUBLE,
            multiplier DOUBLE,
            schedule_id BIGINT,
            schedule_sha256 VARCHAR,
            status VARCHAR NOT NULL,
            stale_reason VARCHAR,
            error VARCHAR,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (event_id, channel_key)
        )
        """
    )
    conn.execute(
        f"""
        INSERT INTO event_channel_damage (
            event_id, channel_key, channel_name, channel_unit,
            base_damage, scheduled_damage, repeats, weight, multiplier,
            schedule_id, schedule_sha256, status, stale_reason, error, updated_at
        )
        SELECT
            event_id, channel_key, channel_name, channel_unit,
            base_damage, scheduled_damage, repeats, weight, multiplier,
            schedule_id, schedule_sha256, status, stale_reason, error, updated_at
        FROM (
            SELECT
                *,
                ROW_NUMBER() OVER (
                    PARTITION BY event_id, channel_key
                    ORDER BY updated_at DESC, schedule_sha256 DESC
                ) AS damage_row_rank
            FROM {legacy_table}
        )
        WHERE damage_row_rank = 1
        """
    )
    conn.execute(f"DROP TABLE {legacy_table}")
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_channel_damage_event
        ON event_channel_damage(event_id)
        """
    )


def _reconcile_stale_active_upload_tasks(conn: Any) -> None:
    """Mark startup-stale queued/running task rows as terminal failures."""
    required = (
        _table_exists(conn, "upload_tasks")
        and _column_exists(conn, "upload_tasks", "task_kind")
        and _column_exists(conn, "upload_tasks", "status")
        and _column_exists(conn, "upload_tasks", "phase")
    )
    if not required:
        return

    status_placeholders = ", ".join("?" for _ in ACTIVE_TASK_STATUSES)
    stale_count_query = f"""
        SELECT COUNT(*)
        FROM upload_tasks
        WHERE task_kind IN (?, ?, ?)
          AND status IN ({status_placeholders})
    """
    stale_count = conn.execute(
        stale_count_query,
        [*ACTIVE_UPLOAD_TASK_KINDS, *ACTIVE_TASK_STATUSES],
    ).fetchone()
    if stale_count is None or int(stale_count[0]) == 0:
        return

    finished_at_assignment = (
        ", finished_at = CURRENT_TIMESTAMP"
        if _column_exists(conn, "upload_tasks", "finished_at")
        else ""
    )
    stale_update_query = (
        """
        UPDATE upload_tasks
        SET
            status = 'failed',
            phase = 'failed',
            sub_phase = NULL,
            progress_message = NULL,
            current_event = NULL,
            error = CASE
                WHEN error IS NULL OR TRIM(error) = '' THEN 'Task interrupted by server restart'
                ELSE error
            END,
            updated_at = CURRENT_TIMESTAMP
        """
        + finished_at_assignment
        + f"""
        WHERE task_kind IN (?, ?, ?)
          AND status IN ({status_placeholders})
        """
    )
    conn.execute(
        stale_update_query,
        [*ACTIVE_UPLOAD_TASK_KINDS, *ACTIVE_TASK_STATUSES],
    )


def apply_startup_backfills(conn: Any) -> None:
    """Apply idempotent row backfills needed for legacy data compatibility."""
    users_can_write_exists = _column_exists(conn, "users", "can_write")
    if users_can_write_exists:
        conn.execute(
            "UPDATE users SET can_write = TRUE WHERE role = 'admin' AND can_write IS NOT TRUE"
        )

    users_token_version_exists = _column_exists(conn, "users", "token_version")
    if users_token_version_exists:
        conn.execute(
            "UPDATE users SET token_version = 0 WHERE token_version IS NULL"
        )

    maturity_column_exists = _column_exists(conn, "dim_event", "maturity")
    if maturity_column_exists:
        conn.execute(
            """
            UPDATE dim_event
            SET status = maturity
            WHERE status IS NULL AND maturity IS NOT NULL
            """
        )

    conn.execute(
        """
        UPDATE dim_event
        SET
            rfq = COALESCE(rfq, FALSE),
            dv = COALESCE(dv, FALSE),
            pv = COALESCE(pv, FALSE),
            post_prod = COALESCE(post_prod, FALSE)
        WHERE
            rfq IS NULL
            OR dv IS NULL
            OR pv IS NULL
            OR post_prod IS NULL
        """
    )

    _backfill_channel_map_headers(conn)
    _repair_event_channel_damage_primary_key(conn)
    _reconcile_stale_active_upload_tasks(conn)
