"""Behavior tests for schedule-driven damage validation."""

from __future__ import annotations

from server.models.damage import DamageFailureReport
from server.services.schedule_damage_validation import validate_schedule_for_damage


def _preview(
    *,
    entries: list[dict] | None = None,
    event_rows: list[dict] | None = None,
) -> dict:
    return {
        "multiplier": 2.0,
        "entries": entries
        or [{"pattern": "pattern_a", "repeats": 5, "weight": 0.5}],
        "event_rows": event_rows or [],
    }


def test_blank_repeats_fails_whole_validation() -> None:
    report = validate_schedule_for_damage(
        _preview(
            event_rows=[
                {
                    "event_id": "event-1",
                    "rsp_file_name": "mf4e3_100_bt1cc.rsp",
                    "rsp_event_name": "mf4e3_100",
                    "pattern": "pattern_a",
                    "repeats": None,
                    "weight": 0.5,
                    "schedule_sequence": 1,
                }
            ]
        )
    )

    assert isinstance(report, DamageFailureReport)
    assert report.issues[0].field == "repeats"
    assert report.issues[0].event_name == "mf4e3_100"


def test_blank_weight_fails_whole_validation() -> None:
    report = validate_schedule_for_damage(
        _preview(
            event_rows=[
                {
                    "event_id": "event-1",
                    "rsp_file_name": "route.rsp",
                    "rsp_event_name": "",
                    "pattern": "pattern_a",
                    "repeats": 5,
                    "weight": None,
                    "schedule_sequence": 1,
                }
            ]
        )
    )

    assert isinstance(report, DamageFailureReport)
    assert report.issues[0].field == "weight"
    assert report.issues[0].event_name == "route.rsp"


def test_blank_pattern_and_sequence_do_not_fail_validation() -> None:
    report = validate_schedule_for_damage(
        _preview(
            event_rows=[
                {
                    "event_id": "event-scheduled",
                    "rsp_file_name": "pattern_a_event.rsp",
                    "rsp_event_name": "pattern_a_event",
                    "pattern": "pattern_a",
                    "repeats": 5,
                    "weight": 0.5,
                    "schedule_sequence": 1,
                },
                {
                    "event_id": "event-unscheduled",
                    "rsp_file_name": "other.rsp",
                    "rsp_event_name": "other",
                    "pattern": "",
                    "repeats": None,
                    "weight": None,
                    "schedule_sequence": None,
                },
            ]
        )
    )

    assert report is None


def test_unmatched_schedule_entry_does_not_fail_validation() -> None:
    report = validate_schedule_for_damage(
        _preview(
            entries=[{"pattern": "missing_pattern", "repeats": 3, "weight": 1.0}],
            event_rows=[
                {
                    "event_id": "event-1",
                    "rsp_file_name": "mf4e3_100.rsp",
                    "rsp_event_name": "mf4e3_100",
                    "pattern": "",
                    "repeats": None,
                    "weight": None,
                    "schedule_sequence": None,
                }
            ],
        )
    )

    assert report is None
