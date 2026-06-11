"""Resolve plot channel names from per-event header metadata."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ResolverErrorCode = Literal["missing_headers", "column_out_of_range"]


@dataclass(frozen=True)
class PlotChannelMapping:
    """Version-wide plot mapping defined by zero-based column indices."""

    x_col: int
    y_col: int
    x_unit: str | None = None
    y_unit: str | None = None


@dataclass(frozen=True)
class PlotChannelResolution:
    """Resolved lookup channel names for one plot on one event."""

    x_channel_name: str | None = None
    y_channel_name: str | None = None
    x_unit: str | None = None
    y_unit: str | None = None
    error_code: ResolverErrorCode | None = None
    error_message: str | None = None


def resolve_plot_channels_from_headers(
    mapping: PlotChannelMapping,
    headers: list[str],
    units: list[str] | None = None,
) -> PlotChannelResolution:
    """Resolve plot axis channel names from an event header row."""
    if not headers:
        return PlotChannelResolution(
            error_code="missing_headers",
            error_message="Event header metadata is missing",
        )

    if mapping.x_col < 0 or mapping.x_col >= len(headers):
        return PlotChannelResolution(
            error_code="column_out_of_range",
            error_message=(
                f"x_col={mapping.x_col} is outside the header row "
                f"(columns={len(headers)})"
            ),
        )
    if mapping.y_col < 0 or mapping.y_col >= len(headers):
        return PlotChannelResolution(
            error_code="column_out_of_range",
            error_message=(
                f"y_col={mapping.y_col} is outside the header row "
                f"(columns={len(headers)})"
            ),
        )

    resolved_x_unit = mapping.x_unit
    resolved_y_unit = mapping.y_unit
    if units is not None:
        if mapping.x_col < len(units):
            resolved_x_unit = units[mapping.x_col] or mapping.x_unit
        if mapping.y_col < len(units):
            resolved_y_unit = units[mapping.y_col] or mapping.y_unit

    return PlotChannelResolution(
        x_channel_name=headers[mapping.x_col],
        y_channel_name=headers[mapping.y_col],
        x_unit=resolved_x_unit,
        y_unit=resolved_y_unit,
    )
