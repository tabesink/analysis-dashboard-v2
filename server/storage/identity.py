"""Host-local identity storage for authentication users.

The active dashboard database can be switched at runtime. Auth identity cannot
follow that switch, so this store keeps users in a stable host-local DuckDB file.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import duckdb

from server.storage.repositories.users_repository import UsersRepository

logger = logging.getLogger(__name__)

IDENTITY_MIGRATION_KEY = "legacy_dashboard_users_migrated_v1"
USER_REFERENCE_COLUMNS: tuple[tuple[str, str], ...] = (
    ("sessions", "user_id"),
    ("upload_tasks", "created_by_user_id"),
    ("saved_filters", "user_id"),
    ("dim_event", "uploaded_by_user_id"),
    ("dim_event", "last_updated_by_user_id"),
    ("audit_log", "user_id"),
    ("event_access_log", "user_id"),
    ("custom_field_definitions", "created_by_user_id"),
    ("user_preferences", "user_id"),
)


class _IdentityReadConnection:
    """Serialize read operations against the identity store connection."""

    def __init__(self, store: IdentityStore):
        self._store = store

    def execute(self, query: str, params: list[Any] | None = None) -> "_IdentityQueryResult":
        with self._store._lock:
            self._store._ensure_connection_unlocked()
            conn = self._store._connection
            if conn is None:
                raise RuntimeError("Identity DuckDB connection failed to open")
            result = conn.execute(query, params or [])
            return _IdentityQueryResult(
                rows=result.fetchall(),
                description=tuple(result.description or ()),
            )

    @property
    def description(self) -> Any:
        conn = self._store._connection
        return conn.description if conn is not None else None


class _IdentityQueryResult:
    """Materialized read result so shared identity connection reads stay locked."""

    def __init__(self, rows: list[tuple[Any, ...]], description: tuple[Any, ...]):
        self._rows = rows
        self.description = description

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._rows


class IdentityStore:
    """Small DuckDB-backed source of truth for host-local users."""

    def __init__(self, db_path: Path):
        self.db_path = db_path.resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection: duckdb.DuckDBPyConnection | None = None
        self._lock = threading.RLock()
        self._read_proxy = _IdentityReadConnection(self)
        self._users_repository = UsersRepository(self)
        self._init_schema()
        logger.info("Identity database initialized: %s", self.db_path)

    def _ensure_connection_unlocked(self) -> None:
        if self._connection is None:
            self._connection = duckdb.connect(str(self.db_path))

    @property
    def read_connection(self) -> _IdentityReadConnection:
        return self._read_proxy

    @contextmanager
    def write_connection(self) -> Generator[duckdb.DuckDBPyConnection, None, None]:
        with self._lock:
            self._ensure_connection_unlocked()
            conn = self._connection
            if conn is None:
                raise RuntimeError("Identity DuckDB connection failed to open")
            try:
                conn.begin()
                yield conn
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

    def _init_schema(self) -> None:
        with self.write_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR PRIMARY KEY,
                    username VARCHAR NOT NULL UNIQUE,
                    role VARCHAR NOT NULL,
                    password_hash VARCHAR,
                    can_write BOOLEAN DEFAULT FALSE,
                    token_version INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP,
                    last_settings_visit_at TIMESTAMP
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_identity_users_username ON users(username)"
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS identity_metadata (
                    key VARCHAR PRIMARY KEY,
                    value VARCHAR NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def close(self) -> None:
        with self._lock:
            if self._connection is not None:
                self._connection.execute("CHECKPOINT")
                self._connection.close()
                self._connection = None

    def get_metadata(self, key: str) -> str | None:
        row = self.read_connection.execute(
            "SELECT value FROM identity_metadata WHERE key = ?",
            [key],
        ).fetchone()
        return str(row[0]) if row else None

    def set_metadata(self, key: str, value: str) -> None:
        with self.write_connection() as conn:
            updated = conn.execute(
                """
                UPDATE identity_metadata
                SET value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE key = ?
                RETURNING key
                """,
                [value, key],
            ).fetchone()
            if updated is None:
                conn.execute(
                    """
                    INSERT INTO identity_metadata (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    """,
                    [key, value],
                )

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        return self._users_repository.get_user_by_id(user_id)

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        return self._users_repository.get_user_by_username(username)

    def create_user(
        self,
        username: str,
        role: str = "user",
        password_hash: str | None = None,
        can_write: bool = False,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        return self._users_repository.create_user(
            username=username,
            role=role,
            password_hash=password_hash,
            can_write=can_write,
            user_id=user_id,
        )

    def update_user_last_login(self, user_id: str) -> None:
        self._users_repository.update_user_last_login(user_id)

    def list_users(self) -> list[dict[str, Any]]:
        return self._users_repository.list_users()

    def update_user_role_and_write(
        self,
        user_id: str,
        role: str | None = None,
        can_write: bool | None = None,
    ) -> dict[str, Any] | None:
        return self._users_repository.update_user_role_and_write(
            user_id=user_id,
            role=role,
            can_write=can_write,
        )

    def set_user_password_hash(self, user_id: str, password_hash: str) -> bool:
        return self._users_repository.set_user_password_hash(user_id, password_hash)

    def delete_user(self, user_id: str) -> bool:
        return self._users_repository.delete_user(user_id)

    def count_users_created_after(
        self,
        after: Any | None,
        exclude_user_id: str,
    ) -> int:
        return self._users_repository.count_users_created_after(after, exclude_user_id)

    def mark_user_settings_visited(self, user_id: str) -> None:
        self._users_repository.mark_user_settings_visited(user_id)

    def bump_user_token_version(self, user_id: str) -> int:
        return self._users_repository.bump_token_version(user_id)

    def insert_legacy_user(self, user: dict[str, Any]) -> None:
        """Insert a selected legacy user row while preserving its ID/timestamps."""
        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (
                    id,
                    username,
                    role,
                    password_hash,
                    can_write,
                    token_version,
                    created_at,
                    last_login_at,
                    last_settings_visit_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (username) DO NOTHING
                """,
                [
                    user["id"],
                    user["username"],
                    user["role"],
                    user.get("password_hash"),
                    bool(user.get("can_write")) or user["role"] == "admin",
                    int(user.get("token_version") or 0),
                    user.get("created_at"),
                    user.get("last_login_at"),
                    user.get("last_settings_visit_at"),
                ],
            )


def migrate_legacy_dashboard_users(
    identity_store: IdentityStore,
    *,
    data_root: Path,
    active_database_path: Path,
) -> dict[str, int]:
    """Merge legacy per-dashboard users into identity.db and remap references."""
    if identity_store.get_metadata(IDENTITY_MIGRATION_KEY) == "done":
        return {"users_inserted": 0, "databases_remapped": 0}

    paths = _managed_dashboard_paths(data_root, active_database_path)
    selected_by_username: dict[str, dict[str, Any]] = {
        user["username"]: user for user in identity_store.list_users()
    }
    legacy_rows_by_path: dict[Path, list[dict[str, Any]]] = {}

    for path in paths:
        rows = _read_legacy_users(path)
        legacy_rows_by_path[path] = rows
        for row in rows:
            username = row.get("username")
            if not isinstance(username, str) or not username.strip():
                continue
            username = username.strip()
            row["username"] = username
            selected_by_username.setdefault(username, row)

    existing_usernames = {user["username"] for user in identity_store.list_users()}
    inserted = 0
    for username, row in selected_by_username.items():
        if username in existing_usernames:
            continue
        identity_store.insert_legacy_user(row)
        inserted += 1

    global_users = {user["username"]: user["id"] for user in identity_store.list_users()}
    remapped = 0
    for path, rows in legacy_rows_by_path.items():
        id_map = {
            row["id"]: global_users[row["username"]]
            for row in rows
            if row.get("id") and row.get("username") in global_users
        }
        if id_map and _remap_dashboard_user_references(path, id_map):
            remapped += 1

    identity_store.set_metadata(IDENTITY_MIGRATION_KEY, "done")
    logger.info(
        "legacy dashboard users migrated",
        extra={
            "event": "identity_legacy_users_migrated",
            "users_inserted": inserted,
            "databases_remapped": remapped,
        },
    )
    return {"users_inserted": inserted, "databases_remapped": remapped}


def _managed_dashboard_paths(data_root: Path, active_database_path: Path) -> list[Path]:
    active = active_database_path.resolve()
    paths = sorted(
        path.resolve()
        for path in data_root.glob("dashboard*.db")
        if path.is_file() and path.suffix == ".db"
    )
    return [active, *[path for path in paths if path != active]] if active.exists() else paths


def _read_legacy_users(db_path: Path) -> list[dict[str, Any]]:
    conn = duckdb.connect(str(db_path))
    try:
        if not _table_exists(conn, "users"):
            return []
        columns = _table_columns(conn, "users")
        select_parts = []
        for column, default_sql in (
            ("id", "NULL"),
            ("username", "NULL"),
            ("role", "'user'"),
            ("password_hash", "NULL"),
            ("can_write", "FALSE"),
            ("token_version", "0"),
            ("created_at", "CURRENT_TIMESTAMP"),
            ("last_login_at", "NULL"),
            ("last_settings_visit_at", "NULL"),
        ):
            if column in columns:
                select_parts.append(column)
            else:
                select_parts.append(f"{default_sql} AS {column}")
        rows = conn.execute(f"SELECT {', '.join(select_parts)} FROM users").fetchall()
        output_columns = [
            "id",
            "username",
            "role",
            "password_hash",
            "can_write",
            "token_version",
            "created_at",
            "last_login_at",
            "last_settings_visit_at",
        ]
        return [dict(zip(output_columns, row)) for row in rows if row[0] and row[1]]
    finally:
        conn.close()


def _remap_dashboard_user_references(db_path: Path, id_map: dict[str, str]) -> bool:
    changed = False
    conn = duckdb.connect(str(db_path))
    try:
        conn.begin()
        for table, column in USER_REFERENCE_COLUMNS:
            if not _table_exists(conn, table) or not _column_exists(conn, table, column):
                continue
            for old_id, new_id in id_map.items():
                if old_id == new_id:
                    continue
                conn.execute(
                    f"UPDATE {table} SET {column} = ? WHERE {column} = ?",
                    [new_id, old_id],
                )
                changed = True
        conn.commit()
        return changed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _table_exists(conn: duckdb.DuckDBPyConnection, table_name: str) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = ?
        """,
        [table_name],
    ).fetchone()
    return row is not None


def _table_columns(conn: duckdb.DuckDBPyConnection, table_name: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = ?
        """,
        [table_name],
    ).fetchall()
    return {str(row[0]) for row in rows}


def _column_exists(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
) -> bool:
    return column_name in _table_columns(conn, table_name)
