"""Channel-map upload filename helpers."""

from __future__ import annotations

import os

ALLOWED_CHANNEL_MAP_BASENAMES = frozenset({"channel_map.yml", "channel_map.yaml"})


def channel_map_basename(filename: str) -> str:
    """Return the lowercased basename after stripping any directory path."""
    normalized = filename.replace("\\", "/")
    return os.path.basename(normalized).lower()


def is_valid_channel_map_filename(filename: str) -> bool:
    """Return True when the basename is an allowed channel-map filename."""
    return channel_map_basename(filename) in ALLOWED_CHANNEL_MAP_BASENAMES
