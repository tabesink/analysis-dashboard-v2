from server.services.ingestion import IngestionService
from server.services.query import QueryService


def _channel_map_yaml() -> bytes:
    return b"""
bj_xy_force_plot:
  x_col: 2
  y_col: 3
bj_xz_force_plot:
  x_col: 2
  y_col: 4
shock_xy_force_plot:
  x_col: 20
  y_col: 21
shock_xz_force_plot:
  x_col: 20
  y_col: 22
bushing_f_xy_force_plot:
  x_col: 8
  y_col: 9
bushing_f_xz_force_plot:
  x_col: 8
  y_col: 10
bushing_r_xy_force_plot:
  x_col: 14
  y_col: 15
bushing_r_xz_force_plot:
  x_col: 14
  y_col: 16
"""


def _csv_with_24_damage_channels() -> bytes:
    channel_titles = [
        "001_1 LF LCA OtrBJ P_UG_X Force",
        "002_2 LF LCA OtrBJ P_UG_Y Force",
        "003_3 LF LCA OtrBJ P_UG_Z Force",
        "004_4 LF StabLink LwrBsh P_UG_X Force",
        "005_5 LF StabLink LwrBsh P_UG_Y Force",
        "006_6 LF StabLink LwrBsh P_UG_Z Force",
        "007_7 LF LCABushingF P_UG_X Force",
        "008_8 LF LCABushingF P_UG_Y Force",
        "009_9 LF LCABushingF P_UG_Z Force",
        "010_10 LF LCABushingF P_UG_X Momt",
        "011_11 LF LCABushingF P_UG_Y Momt",
        "012_12 LF LCABushingF P_UG_Z Momt",
        "013_13 LF LCABushingR P_UG_X Force",
        "014_14 LF LCABushingR P_UG_Y Force",
        "015_15 LF LCABushingR P_UG_Z Force",
        "016_16 LF LCABushingR P_UG_X Momt",
        "017_17 LF LCABushingR P_UG_Y Momt",
        "018_18 LF LCABushingR P_UG_Z Momt",
        "019_19 LF ShockLwBsh P_UG_X Force",
        "020_20 LF ShockLwBsh P_UG_Y Force",
        "021_21 LF ShockLwBsh P_UG_Z Force",
        "022_22 LF ShockLwBsh P_UG_X Momt",
        "023_23 LF ShockLwBsh P_UG_Y Momt",
        "024_24 LF ShockLwBsh P_UG_Z Momt",
    ]
    titles = ["Index", "Time", *channel_titles]
    units = ["", "s", *(["N"] * 9), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3)]
    rows = []
    for row_idx in range(4):
        values = [str(row_idx + 1), f"{row_idx * 0.01:.2f}"]
        values.extend(str((channel_idx * 100) + row_idx) for channel_idx in range(1, 25))
        rows.append(",".join(values))
    data_rows = "\n".join(rows)
    return (
        "#HEADER\n"
        "#TITLES\n"
        f"{','.join(titles)}\n"
        "#UNITS\n"
        f"{','.join(units)}\n"
        "#DATA\n"
        f"{data_rows}\n"
    ).encode()


def _csv_with_24_abbrev_damage_channels() -> bytes:
    """Dec-2022-style titles at the same column layout as the Moog fixture."""
    channel_titles = [
        "1 1 LR LBJ - Fx",
        "2 2 LR LBJ - Fy",
        "3 3 LR LBJ - Fz",
        "4 4 LF Stab - Fx",
        "5 5 LF Stab - Fy",
        "6 6 LF Stab - Fz",
        "7 7 LF Front Bush - Fx",
        "8 8 LF Front Bush - Fy",
        "9 9 LF Front Bush - Fz",
        "10 10 LF Front Bush - Mx",
        "11 11 LF Front Bush - My",
        "12 12 LF Front Bush - Mz",
        "13 13 LF Rear Bush - Fx",
        "14 14 LF Rear Bush - Fy",
        "15 15 LF Rear Bush - Fz",
        "16 16 LF Rear Bush - Mx",
        "17 17 LF Rear Bush - My",
        "18 18 LF Rear Bush - Mz",
        "19 19 LR Shk - Fx",
        "20 20 LR Shk - Fy",
        "21 21 LR Shk - Fz",
        "22 22 LR Shk - Mx",
        "23 23 LR Shk - My",
        "24 24 LR Shk - Mz",
    ]
    titles = ["Index", "Time", *channel_titles]
    units = ["", "s", *(["N"] * 9), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3), *(["N"] * 3), *(["Nmm"] * 3)]
    rows = []
    for row_idx in range(4):
        values = [str(row_idx + 1), f"{row_idx * 0.01:.2f}"]
        values.extend(str((channel_idx * 100) + row_idx) for channel_idx in range(1, 25))
        rows.append(",".join(values))
    data_rows = "\n".join(rows)
    return (
        "#HEADER\n"
        "#TITLES\n"
        f"{','.join(titles)}\n"
        "#UNITS\n"
        f"{','.join(units)}\n"
        "#DATA\n"
        f"{data_rows}\n"
    ).encode()


def test_query_service_returns_plot_channel_damage_series(
    test_database,
    test_cache,
    test_settings,
) -> None:
    uploader = test_database.create_user("damage_query_uploader")
    ingest = IngestionService(test_database, test_cache, test_settings)
    result = ingest.ingest(
        files=[("damage_event.csv", _csv_with_24_damage_channels())],
        program_id="P-DAMAGE",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG", "work_order": "WO-DMG"},
    )
    assert result.success is True

    query = QueryService(test_database, test_cache, test_settings)
    series = query.get_damage_channel_series(result.event_ids)

    assert len(series) == 12
    assert series[0] == {
        "event_id": "damage_event",
        "channel_key": "bj_x_force",
        "channel_name": "BJ X Force",
        "unit": "N",
        "values": [100.0, 101.0, 102.0, 103.0],
    }
    assert series[2]["channel_key"] == "bj_z_force"
    assert series[2]["values"] == [300.0, 301.0, 302.0, 303.0]
    assert series[-1]["channel_key"] == "bushing_r_z_momt"
    assert series[-1]["channel_name"] == "Bushing R Z Momt"
    assert series[-1]["unit"] == "N"
    assert series[-1]["values"] == [1500.0, 1501.0, 1502.0, 1503.0]


def test_query_service_resolves_legacy_generic_channel_map_names(
    test_database,
    test_cache,
    test_settings,
) -> None:
    uploader = test_database.create_user("damage_query_legacy_uploader")
    ingest = IngestionService(test_database, test_cache, test_settings)
    result = ingest.ingest(
        files=[("legacy_damage_event.csv", _csv_with_24_damage_channels())],
        program_id="P-DAMAGE-LEGACY",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG-LEGACY", "work_order": "WO-DMG-LEGACY"},
    )
    assert result.success is True

    with test_database.write_connection() as conn:
        conn.execute(
            """
            UPDATE dim_channel_map
            SET
                x_channel = 'col_' || CAST(x_col AS VARCHAR),
                y_channel = 'col_' || CAST(y_col AS VARCHAR),
                x_unit = NULL,
                y_unit = NULL
            WHERE program_id = ? AND version = ?
            """,
            ["P-DAMAGE-LEGACY", "V1"],
        )

    query = QueryService(test_database, test_cache, test_settings)
    series = query.get_damage_channel_series(result.event_ids)

    assert len(series) == 12
    assert all(item.get("status") is None for item in series)
    assert series[0] == {
        "event_id": "legacy_damage_event",
        "channel_key": "bj_x_force",
        "channel_name": "BJ X Force",
        "unit": "N",
        "values": [100.0, 101.0, 102.0, 103.0],
    }
    assert series[2]["channel_key"] == "bj_z_force"
    assert series[2]["values"] == [300.0, 301.0, 302.0, 303.0]
    assert series[5]["channel_key"] == "shock_z_force"
    assert series[5]["values"] == [2100.0, 2101.0, 2102.0, 2103.0]
    assert series[-1]["channel_key"] == "bushing_r_z_momt"
    assert series[-1]["values"] == [1500.0, 1501.0, 1502.0, 1503.0]


def test_query_service_resolves_damage_channels_from_per_event_headers(
    test_database,
    test_cache,
    test_settings,
) -> None:
    uploader = test_database.create_user("damage_query_mixed_uploader")
    ingest = IngestionService(test_database, test_cache, test_settings)
    moog_result = ingest.ingest(
        files=[("moog_event.csv", _csv_with_24_damage_channels())],
        program_id="P-DAMAGE-MIXED",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG-MIXED", "work_order": "WO-DMG-MIXED"},
    )
    assert moog_result.success is True

    abbrev_result = ingest.ingest(
        files=[("abbrev_event.csv", _csv_with_24_abbrev_damage_channels())],
        program_id="P-DAMAGE-MIXED",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG-MIXED", "work_order": "WO-DMG-MIXED"},
    )
    assert abbrev_result.success is True

    query = QueryService(test_database, test_cache, test_settings)
    series = query.get_damage_channel_series(
        ["moog_event", "abbrev_event"],
    )

    assert len(series) == 24
    for event_id in ("moog_event", "abbrev_event"):
        event_series = [item for item in series if item["event_id"] == event_id]
        assert len(event_series) == 12
        assert all(item.get("status") is None for item in event_series)
        assert all(item["values"] for item in event_series)
        assert event_series[0]["values"] == [100.0, 101.0, 102.0, 103.0]
        assert event_series[2]["values"] == [300.0, 301.0, 302.0, 303.0]
        assert event_series[-1]["values"] == [1500.0, 1501.0, 1502.0, 1503.0]


def test_query_service_reports_header_resolution_errors(
    test_database,
    test_cache,
    test_settings,
) -> None:
    uploader = test_database.create_user("damage_query_header_error_uploader")
    ingest = IngestionService(test_database, test_cache, test_settings)
    result = ingest.ingest(
        files=[("header_error_event.csv", _csv_with_24_damage_channels())],
        program_id="P-DAMAGE-HEADER-ERR",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG-HEADER", "work_order": "WO-DMG-HEADER"},
    )
    assert result.success is True

    with test_database.write_connection() as conn:
        conn.execute(
            """
            UPDATE dim_channel_map
            SET y_col = 999
            WHERE program_id = ? AND version = ? AND plot_key = 'bj_xy_force_plot'
            """,
            ["P-DAMAGE-HEADER-ERR", "V1"],
        )

    query = QueryService(test_database, test_cache, test_settings)
    series = query.get_damage_channel_series(result.event_ids)

    bj_y = next(item for item in series if item["channel_key"] == "bj_y_force")
    assert bj_y["status"] == "unavailable"
    assert "outside the header row" in str(bj_y["error"])
    assert "No measurements found" not in str(bj_y["error"])


def test_query_service_reports_empty_measurement_series_separately(
    test_database,
    test_cache,
    test_settings,
) -> None:
    uploader = test_database.create_user("damage_query_empty_series_uploader")
    ingest = IngestionService(test_database, test_cache, test_settings)
    result = ingest.ingest(
        files=[("empty_series_event.csv", _csv_with_24_damage_channels())],
        program_id="P-DAMAGE-EMPTY",
        version="V1",
        channel_map_content=_channel_map_yaml(),
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DMG-EMPTY", "work_order": "WO-DMG-EMPTY"},
    )
    assert result.success is True

    with test_database.write_connection() as conn:
        conn.execute(
            """
            DELETE FROM measurements_raw
            WHERE event_id = ?
              AND channel_name = '002_2 LF LCA OtrBJ P_UG_Y Force'
            """,
            [result.event_ids[0]],
        )

    query = QueryService(test_database, test_cache, test_settings)
    series = query.get_damage_channel_series(result.event_ids)

    bj_y = next(item for item in series if item["channel_key"] == "bj_y_force")
    assert bj_y["status"] == "unavailable"
    assert "No measurements found for mapped channel" in str(bj_y["error"])
    assert "outside the header row" not in str(bj_y["error"])
