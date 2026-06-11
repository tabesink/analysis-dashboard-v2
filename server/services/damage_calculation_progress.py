"""Progress message formatting for damage calculation derived-data tasks."""

from __future__ import annotations


def calculating_load_history_damage_message(event_id: str, channel_name: str) -> str:
    """Build the load-history damage calculation live progress message."""
    return f"Calculating load history damage: {event_id} - {channel_name}"
