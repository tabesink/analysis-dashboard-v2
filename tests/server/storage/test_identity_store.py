from __future__ import annotations

from pathlib import Path

import duckdb

from server.storage.database import UnifiedStore
from server.storage.identity import IdentityStore, migrate_legacy_dashboard_users


def _insert_user_references(store: UnifiedStore, user_id: str) -> None:
    with store.write_connection() as conn:
        conn.execute(
            """
            INSERT INTO sessions (session_id, user_id, created_at, updated_at, expires_at)
            VALUES ('session-1', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day')
            """,
            [user_id],
        )
        conn.execute(
            """
            INSERT INTO saved_filters (name, user_id, data_state)
            VALUES ('filter-1', ?, '{}')
            """,
            [user_id],
        )
        conn.execute(
            """
            INSERT INTO dim_program (program_id, name)
            VALUES ('P1', 'P1')
            """,
        )
        conn.execute(
            """
            INSERT INTO dim_event (
                event_id,
                program_id,
                version,
                uploaded_by_user_id,
                last_updated_by_user_id
            )
            VALUES ('E1', 'P1', 'V1', ?, ?)
            """,
            [user_id, user_id],
        )


def test_migrate_legacy_dashboard_users_prefers_active_db_and_remaps_refs(
    tmp_path: Path,
) -> None:
    data_root = tmp_path / "data"
    data_root.mkdir()
    active_path = data_root / "dashboard.db"
    other_path = data_root / "dashboard-other.db"

    active = UnifiedStore(active_path)
    active_alice = active.create_user(
        "alice",
        role="user",
        password_hash="active-hash",
        can_write=False,
    )
    active.close()

    other = UnifiedStore(other_path)
    other_alice = other.create_user(
        "alice",
        role="admin",
        password_hash="other-hash",
        can_write=True,
    )
    other.create_user(
        "carol",
        role="user",
        password_hash="carol-hash",
        can_write=True,
    )
    _insert_user_references(other, other_alice["id"])
    other.close()

    identity = IdentityStore(data_root / "identity.db")
    try:
        result = migrate_legacy_dashboard_users(
            identity,
            data_root=data_root,
            active_database_path=active_path,
        )

        alice = identity.get_user_by_username("alice")
        carol = identity.get_user_by_username("carol")
        assert alice is not None
        assert carol is not None
        assert alice["id"] == active_alice["id"]
        assert alice["password_hash"] == "active-hash"
        assert alice["role"] == "user"
        assert bool(alice["can_write"]) is False
        assert carol["password_hash"] == "carol-hash"
        assert result == {"users_inserted": 2, "databases_remapped": 1}

        second = migrate_legacy_dashboard_users(
            identity,
            data_root=data_root,
            active_database_path=active_path,
        )
        assert second == {"users_inserted": 0, "databases_remapped": 0}
    finally:
        identity.close()

    conn = duckdb.connect(str(other_path))
    try:
        session_user = conn.execute("SELECT user_id FROM sessions").fetchone()[0]
        filter_user = conn.execute("SELECT user_id FROM saved_filters").fetchone()[0]
        event_users = conn.execute(
            "SELECT uploaded_by_user_id, last_updated_by_user_id FROM dim_event"
        ).fetchone()
    finally:
        conn.close()

    assert session_user == active_alice["id"]
    assert filter_user == active_alice["id"]
    assert event_users == (active_alice["id"], active_alice["id"])
