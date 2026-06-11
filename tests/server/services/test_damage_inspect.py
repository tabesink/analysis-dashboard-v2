"""Behavior tests for persisted damage inspection."""

from __future__ import annotations

import numpy as np
import pandas as pd

from server.services.damage_inspect import build_damage_inspect_response
from server.services.query import QueryService
from tests.server.routers.conftest import login


def _seed_event_with_measurements(db, *, owner_id: str) -> str:
    db.insert_event(
        event_id="event-inspect-1",
        program_id="P-INSPECT",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
        job_number="JOB-1",
        work_order="WO-1",
    )
    signal = 1000.0 * np.sin(np.linspace(0, 8 * np.pi, 200))
    measurements = pd.DataFrame(
        {
            "timestamp": list(range(len(signal))),
            "channel_name": ["BJ X Raw"] * len(signal),
            "value": signal,
        }
    )
    db.insert_measurements("event-inspect-1", measurements)
    return "event-inspect-1"


def test_build_damage_inspect_response_returns_persisted_rows(
    test_database,
    test_cache,
    test_settings,
) -> None:
    owner = test_database.create_user("inspect_persist_user")
    event_id = _seed_event_with_measurements(test_database, owner_id=owner)
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=2,
        weight=1.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc123",
        status="current",
    )

    query = QueryService(test_database, test_cache, test_settings)
    response = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    assert response.has_stale_values is False
    assert response.channels[0].channel_key == "bj_x_force"
    assert response.rows[0].event_id == event_id
    cell = response.rows[0].damages["bj_x_force"]
    assert cell.status == "current"
    assert cell.damage == 0.05
    assert cell.base_damage == 0.01
    assert cell.stale_reason is None


def test_build_damage_inspect_response_does_not_compute_when_persisted_rows_missing(
    test_database,
    test_cache,
    test_settings,
) -> None:
    owner = test_database.create_user("inspect_missing_user")
    event_id = _seed_event_with_measurements(test_database, owner_id=owner)

    query = QueryService(test_database, test_cache, test_settings)
    response = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    assert response.channels == []
    assert response.rows[0].event_id == event_id
    assert response.rows[0].damages == {}


def test_build_damage_inspect_response_marks_stale_rows(
    test_database,
    test_cache,
    test_settings,
) -> None:
    owner = test_database.create_user("inspect_stale_user")
    event_id = _seed_event_with_measurements(test_database, owner_id=owner)
    test_database.upsert_event_channel_damage(
        event_id=event_id,
        channel_key="bj_x_force",
        channel_name="BJ X Force",
        channel_unit="N",
        base_damage=0.01,
        scheduled_damage=0.05,
        repeats=2,
        weight=1.5,
        multiplier=2.0,
        schedule_id=1,
        schedule_sha256="abc123",
        status="stale",
        stale_reason="schedule_changed",
    )

    query = QueryService(test_database, test_cache, test_settings)
    response = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    assert response.has_stale_values is True
    cell = response.rows[0].damages["bj_x_force"]
    assert cell.status == "stale"
    assert cell.stale_reason == "schedule_changed"
    assert cell.damage == 0.05


def test_build_damage_inspect_response_includes_scope_state_for_empty_results(
    test_database,
    test_cache,
    test_settings,
) -> None:
    owner = test_database.create_user("inspect_scope_user")
    event_id = _seed_event_with_measurements(test_database, owner_id=owner)

    query = QueryService(test_database, test_cache, test_settings)
    response = build_damage_inspect_response(
        test_database,
        query,
        event_ids=[event_id],
    )

    scope = response.scopes[0]
    assert scope.program_id == "P-INSPECT"
    assert scope.version == "V1"
    assert scope.has_current_results is False
    assert scope.has_stale_results is False
    assert scope.has_active_schedule is False
    assert scope.can_start_calculation is False
