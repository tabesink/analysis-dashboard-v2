"""Behavior tests for per-event plot channel resolution from header metadata."""

from server.services.per_event_channel_resolver import (
    PlotChannelMapping,
    resolve_plot_channels_from_headers,
)


def _moog_style_headers() -> list[str]:
    return [
        "Index",
        "Time",
        "001_1 LF LCA OtrBJ P_UG_X Force",
        "002_2 LF LCA OtrBJ P_UG_Y Force",
        "003_3 LF LCA OtrBJ P_UG_Z Force",
    ]


def _abbreviated_dec_2022_headers() -> list[str]:
    return [
        "Index",
        "Time",
        "1 1 LR LBJ - Fx",
        "2 2 LR LBJ - Fy",
        "3 3 LR LBJ - Fz",
    ]


def test_resolve_plot_channels_returns_names_for_valid_indices() -> None:
    mapping = PlotChannelMapping(x_col=2, y_col=3)

    result = resolve_plot_channels_from_headers(
        mapping,
        headers=["Index", "Time", "BJ X", "BJ Y"],
        units=["", "s", "N", "N"],
    )

    assert result.error_code is None
    assert result.x_channel_name == "BJ X"
    assert result.y_channel_name == "BJ Y"
    assert result.x_unit == "N"
    assert result.y_unit == "N"


def test_resolve_plot_channels_reports_missing_headers() -> None:
    mapping = PlotChannelMapping(x_col=2, y_col=3)

    result = resolve_plot_channels_from_headers(mapping, headers=[])

    assert result.x_channel_name is None
    assert result.y_channel_name is None
    assert result.error_code == "missing_headers"
    assert result.error_message is not None


def test_resolve_plot_channels_reports_out_of_range_indices() -> None:
    mapping = PlotChannelMapping(x_col=2, y_col=99)

    result = resolve_plot_channels_from_headers(
        mapping,
        headers=["Index", "Time", "BJ X", "BJ Y"],
    )

    assert result.x_channel_name is None
    assert result.y_channel_name is None
    assert result.error_code == "column_out_of_range"
    assert "y_col=99" in (result.error_message or "")


def test_resolve_plot_channels_uses_moog_style_titles() -> None:
    mapping = PlotChannelMapping(x_col=2, y_col=3)

    result = resolve_plot_channels_from_headers(mapping, headers=_moog_style_headers())

    assert result.error_code is None
    assert result.x_channel_name == "001_1 LF LCA OtrBJ P_UG_X Force"
    assert result.y_channel_name == "002_2 LF LCA OtrBJ P_UG_Y Force"


def test_resolve_plot_channels_uses_abbreviated_dec_2022_titles() -> None:
    mapping = PlotChannelMapping(x_col=2, y_col=3)

    result = resolve_plot_channels_from_headers(
        mapping,
        headers=_abbreviated_dec_2022_headers(),
    )

    assert result.error_code is None
    assert result.x_channel_name == "1 1 LR LBJ - Fx"
    assert result.y_channel_name == "2 2 LR LBJ - Fy"
