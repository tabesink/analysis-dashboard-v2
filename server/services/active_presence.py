"""Lightweight in-memory active-user presence tracker."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import threading
import time
from typing import Any

ACTIVE_PRESENCE_TTL_SECONDS = 60


@dataclass(frozen=True)
class ActivePresenceRecord:
    user_id: str
    username: str
    active_database: str
    active_area: str | None
    last_seen_at: datetime
    last_seen_epoch_seconds: float

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["last_seen_at"] = self.last_seen_at.isoformat()
        return payload


_PRESENCE_LOCK = threading.Lock()
_presence_by_user_id: dict[str, ActivePresenceRecord] = {}


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _prune_expired_presence(*, now_epoch_seconds: float) -> None:
    expired_user_ids = [
        user_id
        for user_id, record in _presence_by_user_id.items()
        if now_epoch_seconds - record.last_seen_epoch_seconds > ACTIVE_PRESENCE_TTL_SECONDS
    ]
    for user_id in expired_user_ids:
        _presence_by_user_id.pop(user_id, None)


def heartbeat_user_presence(
    *,
    user_id: str,
    username: str,
    active_database: str,
    active_area: str | None = None,
) -> ActivePresenceRecord:
    now = _now_utc()
    now_epoch_seconds = time.time()
    record = ActivePresenceRecord(
        user_id=user_id,
        username=username,
        active_database=active_database,
        active_area=active_area.strip() if isinstance(active_area, str) and active_area.strip() else None,
        last_seen_at=now,
        last_seen_epoch_seconds=now_epoch_seconds,
    )
    with _PRESENCE_LOCK:
        _presence_by_user_id[user_id] = record
        _prune_expired_presence(now_epoch_seconds=now_epoch_seconds)
    return record


def get_active_users_for_database(
    *,
    active_database: str,
    exclude_user_id: str | None = None,
) -> list[ActivePresenceRecord]:
    now_epoch_seconds = time.time()
    with _PRESENCE_LOCK:
        _prune_expired_presence(now_epoch_seconds=now_epoch_seconds)
        records = list(_presence_by_user_id.values())

    return [
        record
        for record in records
        if record.active_database == active_database
        and (exclude_user_id is None or record.user_id != exclude_user_id)
    ]


def remove_user_presence(user_id: str) -> None:
    with _PRESENCE_LOCK:
        _presence_by_user_id.pop(user_id, None)


def reset_presence_state() -> None:
    with _PRESENCE_LOCK:
        _presence_by_user_id.clear()
