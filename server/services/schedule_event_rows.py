"""Build editable durability schedule event rows from parsed entries and events."""

from __future__ import annotations

import re
from typing import Any


def _file_stem(source_file: str) -> str:
    base_name = source_file.replace("\\", "/").split("/")[-1]
    return re.sub(r"\.[^/.]+$", "", base_name)


def discover_event_delimiter(source_files: list[str]) -> str | None:
    """Discover the shared filename token used as an event delimiter."""
    token_stats: dict[str, dict[str, int]] = {}

    for source_file in source_files:
        tokens = _file_stem(source_file).split("_")
        seen: set[str] = set()
        for position, token in enumerate(tokens):
            if not token or token in seen:
                continue
            seen.add(token)
            stats = token_stats.setdefault(token, {"file_count": 0, "first_position": position})
            stats["file_count"] += 1
            stats["first_position"] = min(stats["first_position"], position)

    if not token_stats:
        return None

    best_token: str | None = None
    best_score: tuple[int, int] | None = None
    for token, stats in token_stats.items():
        score = (stats["file_count"], -stats["first_position"])
        if best_score is None or score > best_score:
            best_token = token
            best_score = score
    return best_token


def rsp_event_name_from_file(source_file: str, delimiter_token: str | None) -> str:
    stem = _file_stem(source_file)
    tokens = stem.split("_")
    if delimiter_token and delimiter_token in tokens:
        return "_".join(tokens[: tokens.index(delimiter_token)])
    return stem


def match_schedule_pattern(stem: str, patterns: list[str]) -> str | None:
    matches = [pattern for pattern in patterns if pattern in stem]
    if not matches:
        return None
    return max(matches, key=len)


def build_schedule_event_rows(
    events: list[dict[str, Any]],
    entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Hydrate editable event rows from parsed schedule entries and program events."""
    source_files = [
        str(event.get("source_file") or "").strip()
        for event in events
        if str(event.get("source_file") or "").strip()
    ]
    delimiter_token = discover_event_delimiter(source_files)
    patterns = [str(entry.get("pattern") or "") for entry in entries]

    indexed_entries = [
        {
            **entry,
            "schedule_sequence": index + 1,
        }
        for index, entry in enumerate(entries)
    ]

    rows: list[dict[str, Any]] = []
    for event in events:
        source_file = str(event.get("source_file") or "").strip()
        if not source_file:
            continue
        stem = _file_stem(source_file)
        matched_pattern = match_schedule_pattern(stem, patterns)
        match = next(
            (entry for entry in indexed_entries if entry.get("pattern") == matched_pattern),
            None,
        )
        rows.append(
            {
                "event_id": str(event["event_id"]),
                "rsp_file_name": source_file,
                "rsp_event_name": rsp_event_name_from_file(source_file, delimiter_token),
                "pattern": matched_pattern or "",
                "repeats": match.get("repeats") if match else None,
                "weight": match.get("weight") if match else None,
                "schedule_sequence": match.get("schedule_sequence") if match else None,
            }
        )

    rows.sort(
        key=lambda row: (
            row.get("schedule_sequence") if row.get("schedule_sequence") is not None else 10**9,
            str(row.get("rsp_file_name") or ""),
        )
    )
    return rows
