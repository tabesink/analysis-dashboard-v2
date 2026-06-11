"""Progress message formatting for channel reprocess derived-data tasks."""

from __future__ import annotations


def validating_artifact_message(index: int, total: int, source_file: str) -> str:
    """Build the validating-artifact live progress message."""
    return f"Validating artifact {index}/{total}: {source_file}"


def generating_cross_plot_message(event_id: str, plot_key: str, point_count: int) -> str:
    """Build the cross-plot LTTB generation live progress message."""
    return f"Generating cross-plot data: {event_id} - {plot_key} ({point_count:,} points)"
