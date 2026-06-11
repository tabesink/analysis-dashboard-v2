"""Schedule-driven load-history damage calculation helpers."""

from __future__ import annotations

from typing import Any


def compute_scheduled_damage(
    base_damage: float,
    *,
    repeats: int,
    weight: float,
    multiplier: float,
) -> float:
    """Apply schedule scaling to a base load-history damage value."""
    return base_damage * repeats * weight * multiplier


def scheduled_event_rows(preview: dict[str, Any]) -> list[dict[str, Any]]:
    """Return saved event rows that participate in schedule-driven damage."""
    rows: list[dict[str, Any]] = []
    for row in preview.get("event_rows") or []:
        if not str(row.get("pattern") or "").strip():
            continue
        rows.append(row)
    return rows
