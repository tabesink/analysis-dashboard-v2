from pathlib import Path

import pandas as pd
import pytest

from server.services.etl import CSVParser, RSPConverter

REPO_ROOT = Path(__file__).resolve().parents[3]
MISSING_DATA_TYPE_FIXTURE = (
    REPO_ROOT
    / "data/raw/13999/v58_data_processing/mfcs5_400_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr.rsp"
)


def test_rsp_converter_outputs_tagged_csv(monkeypatch) -> None:
    converter = RSPConverter()

    def load_stub(_path):
        return (
            pd.DataFrame([[10.0, 20.0], [11.0, 21.0]]),
            [
                {"Description": "Force_X", "Units": "N"},
                {"Description": "Force_Y", "Units": "N"},
            ],
            {"DELTA_T": "0.25"},
        )

    monkeypatch.setattr(converter, "_load_via_rpc_reader", load_stub)

    result = converter.convert("event_rsp.rsp", b"raw-rsp")
    parsed = CSVParser().parse(result.content, result.filename)

    assert result.filename == "event_rsp.csv"
    assert result.row_count == 2
    assert result.channel_count == 2
    assert parsed.is_valid is True
    assert list(parsed.dataframe.columns) == ["", "", "1 Force_X", "2 Force_Y"]
    assert parsed.dataframe.iloc[0, 1] == 0.0
    assert parsed.dataframe.iloc[1, 1] == 0.25


def test_build_extra_headers_injects_missing_data_type() -> None:
    converter = RSPConverter()
    scanned = {
        "NUM_HEADER_BLOCKS": "56",
        "CHANNELS": "24",
        "PTS_PER_FRAME": "1024",
        "PTS_PER_GROUP": "2048",
        "FRAMES": "15",
        "_file_size": "815104",
    }

    extras = converter._build_extra_headers(scanned)

    assert extras == [["DATA_TYPE", "SHORT_INTEGER"], ["INT_FULL_SCALE", "32768"]]


def test_build_extra_headers_leaves_complete_headers_untouched() -> None:
    converter = RSPConverter()
    scanned = {
        "DATA_TYPE": "FLOATING_POINT",
        "INT_FULL_SCALE": "32752",
    }

    assert converter._build_extra_headers(scanned) == []


@pytest.mark.skipif(
    not MISSING_DATA_TYPE_FIXTURE.is_file(),
    reason="v58 RSP fixture not available in this checkout",
)
def test_convert_rsp_missing_data_type_header() -> None:
    converter = RSPConverter()
    content = MISSING_DATA_TYPE_FIXTURE.read_bytes()

    result = converter.convert(MISSING_DATA_TYPE_FIXTURE.name, content)
    parsed = CSVParser().parse(result.content, result.filename)

    assert result.filename == "mfcs5_400_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr.csv"
    assert result.row_count == 15360
    assert result.channel_count == 24
    assert parsed.is_valid is True
