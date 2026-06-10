"""Behavior tests for version-scoped durability schedule attachment."""

from __future__ import annotations

import hashlib
import json

from server.services.durability_schedule import (
    DurabilityScheduleParser,
    DurabilityScheduleStorageService,
)


def _sample_sch_content() -> bytes:
    return b"""# autodam schedule fixture
*id test_schedule_v1
*multiplier 1.5
*run_a* 10 0.25
*run_b* 20 0.75
*summary
ignored after summary
"""


def _make_parser() -> DurabilityScheduleParser:
    return DurabilityScheduleParser()


def _make_storage(test_database, test_settings) -> DurabilityScheduleStorageService:
    return DurabilityScheduleStorageService(test_settings.data_root, test_database)


def test_parse_stops_at_summary_boundary() -> None:
    content = b"""*id summary_boundary
*multiplier 1.0
*before* 1 1.0
*summary
*after* 99 9.9
"""
    parsed = _make_parser().parse_bytes(content)

    assert parsed.schedule_id == "summary_boundary"
    assert len(parsed.entries) == 1
    assert parsed.entries[0] == {"pattern": "before", "repeats": 1, "weight": 1.0}


def test_parse_defaults_missing_id_and_multiplier() -> None:
    content = b"""*run_only* 3 0.5
"""
    parsed = _make_parser().parse_bytes(content)

    assert parsed.schedule_id is None
    assert parsed.multiplier == 1.0
    assert parsed.entries == [{"pattern": "run_only", "repeats": 3, "weight": 0.5}]
    preview = json.loads(parsed.parse_preview_json)
    assert preview["schedule_id"] is None
    assert preview["multiplier"] == 1.0


def test_parse_accepts_zero_repeat_entries() -> None:
    content = b"""*id zero_repeat
*zero* 0 0.0
"""
    parsed = _make_parser().parse_bytes(content)

    assert parsed.entries == [{"pattern": "zero", "repeats": 0, "weight": 0.0}]


def test_parse_autodam_schedule_extracts_metadata_and_entries() -> None:
    parsed = _make_parser().parse_bytes(_sample_sch_content())

    assert parsed.schedule_id == "test_schedule_v1"
    assert parsed.multiplier == 1.5
    assert len(parsed.entries) == 2
    assert parsed.entries[0] == {"pattern": "run_a", "repeats": 10, "weight": 0.25}
    assert parsed.entries[1] == {"pattern": "run_b", "repeats": 20, "weight": 0.75}
    preview = __import__("json").loads(parsed.parse_preview_json)
    assert preview["entries"] == parsed.entries
    assert preview["entries_preview"] == parsed.entries[:5]


def test_attach_schedule_sets_one_active_per_program_version(
    test_database, test_settings
) -> None:
    storage = _make_storage(test_database, test_settings)
    parser = _make_parser()
    owner = test_database.create_user("schedule_owner")
    content = _sample_sch_content()
    parsed = parser.parse_bytes(content)

    first = storage.attach_schedule(
        program_id="P-SCH",
        version="V1",
        source_filename="first.sch",
        content=content,
        parsed=parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )
    assert first.replaced_previous is False

    second_content = content.replace(b"test_schedule_v1", b"test_schedule_v2")
    second_parsed = parser.parse_bytes(second_content)
    second = storage.attach_schedule(
        program_id="P-SCH",
        version="V1",
        source_filename="second.sch",
        content=second_content,
        parsed=second_parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )
    assert second.replaced_previous is True
    assert second.previous_schedule_id == first.schedule_id

    active = test_database.get_active_durability_schedule("P-SCH", "V1")
    assert active is not None
    assert active["schedule_id"] == second.schedule_id
    assert active["schedule_sha256"] == hashlib.sha256(second_content).hexdigest()

    schedules = test_database.list_durability_schedule_artifacts("P-SCH", "V1")
    assert len(schedules) == 2
    assert {row["schedule_id"] for row in schedules} == {first.schedule_id, second.schedule_id}

    resolved = storage.resolve_uri(first.artifact_uri)
    assert resolved.read_bytes() == content


def test_event_inherits_active_schedule_from_program_version(
    test_database, test_settings
) -> None:
    storage = _make_storage(test_database, test_settings)
    parser = _make_parser()
    owner = test_database.create_user("schedule_inherit_owner")
    content = _sample_sch_content()
    parsed = parser.parse_bytes(content)

    stored = storage.attach_schedule(
        program_id="P-SCH-INHERIT",
        version="V1",
        source_filename="inherit.sch",
        content=content,
        parsed=parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )

    test_database.insert_event(
        event_id="event-schedule-inherit",
        program_id="P-SCH-INHERIT",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )

    inherited = test_database.get_durability_schedule_for_event("event-schedule-inherit")
    assert inherited is not None
    assert inherited["schedule_id"] == stored.schedule_id
    assert inherited["artifact_uri"] == stored.artifact_uri

    preview = json.loads(inherited["parse_preview_json"])
    assert preview["schedule_id"] == "test_schedule_v1"
    assert preview["entry_count"] == 2


def test_attach_schedule_records_audit_on_replacement(test_database, test_settings) -> None:
    storage = _make_storage(test_database, test_settings)
    parser = _make_parser()
    owner = test_database.create_user("schedule_audit_owner")
    first_content = _sample_sch_content()
    second_content = first_content.replace(b"test_schedule_v1", b"test_schedule_v2")

    first = storage.attach_schedule(
        program_id="P-SCH-AUDIT",
        version="V1",
        source_filename="first.sch",
        content=first_content,
        parsed=parser.parse_bytes(first_content),
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )
    storage.attach_schedule(
        program_id="P-SCH-AUDIT",
        version="V1",
        source_filename="second.sch",
        content=second_content,
        parsed=parser.parse_bytes(second_content),
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )

    rows = test_database.read_connection.execute(
        """
        SELECT action, user_id, details
        FROM audit_log
        WHERE action IN ('DURABILITY_SCHEDULE_ATTACHED', 'DURABILITY_SCHEDULE_REPLACED')
        ORDER BY id
        """
    ).fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "DURABILITY_SCHEDULE_ATTACHED"
    assert rows[1][0] == "DURABILITY_SCHEDULE_REPLACED"
    replacement_details = json.loads(rows[1][2])
    assert replacement_details["program_id"] == "P-SCH-AUDIT"
    assert replacement_details["previous_schedule_id"] == first.schedule_id
    assert replacement_details["schedule_id"] != first.schedule_id


def test_attach_identical_checksum_reuses_schedule_without_replacement(
    test_database, test_settings
) -> None:
    storage = _make_storage(test_database, test_settings)
    parser = _make_parser()
    owner = test_database.create_user("schedule_dedupe_owner")
    content = _sample_sch_content()
    parsed = parser.parse_bytes(content)

    first = storage.attach_schedule(
        program_id="P-SCH-DEDUPE",
        version="V1",
        source_filename="first.sch",
        content=content,
        parsed=parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )
    second = storage.attach_schedule(
        program_id="P-SCH-DEDUPE",
        version="V1",
        source_filename="repeat.sch",
        content=content,
        parsed=parsed,
        owner_user_id=owner["id"],
        actor_user_id=owner["id"],
    )

    assert second.schedule_id == first.schedule_id
    assert second.schedule_sha256 == first.schedule_sha256
    assert second.replaced_previous is False
    assert second.previous_schedule_id is None

    rows = test_database.read_connection.execute(
        """
        SELECT action
        FROM audit_log
        WHERE action IN ('DURABILITY_SCHEDULE_ATTACHED', 'DURABILITY_SCHEDULE_REPLACED')
          AND details LIKE '%P-SCH-DEDUPE%'
        ORDER BY id
        """
    ).fetchall()
    actions = [row[0] for row in rows]
    assert actions == ["DURABILITY_SCHEDULE_ATTACHED"]

    schedules = test_database.list_durability_schedule_artifacts("P-SCH-DEDUPE", "V1")
    assert len(schedules) == 1
