"""Convert binary RSP uploads into the tagged CSV format used by ingestion."""

from __future__ import annotations

import csv
import importlib
import io
import struct
import tempfile
from dataclasses import dataclass
from math import ceil
from pathlib import Path
from typing import Any

import pandas as pd

MANDATORY_RPC_HEADERS = (
    "NUM_HEADER_BLOCKS",
    "CHANNELS",
    "DELTA_T",
    "PTS_PER_FRAME",
    "PTS_PER_GROUP",
    "FRAMES",
    "DATA_TYPE",
)
DATA_TYPE_BYTES = {
    "SHORT_INTEGER": 2,
    "FLOATING_POINT": 4,
}
DEFAULT_INT_FULL_SCALE = "32768"


@dataclass(frozen=True)
class RSPConversionResult:
    """Tagged CSV bytes generated from one RSP file."""

    filename: str
    content: bytes
    row_count: int
    channel_count: int


class RSPConverter:
    """Convert RSP files with rpc-reader and emit ingestion-compatible CSV."""

    def convert(self, filename: str, content: bytes) -> RSPConversionResult:
        """Convert an uploaded RSP file to tagged CSV bytes."""
        with tempfile.NamedTemporaryFile(suffix=".rsp") as tmp:
            tmp.write(content)
            tmp.flush()
            try:
                df, channels, headers = self._load_via_rpc_reader(Path(tmp.name))
            except SystemExit as exc:
                message = exc.args[0] if exc.args else str(exc)
                raise RuntimeError(self._format_rpc_reader_error(Path(tmp.name), message)) from exc

        channel_names = self._extract_channel_names(channels, df.shape[1])
        df.columns = channel_names
        units = self._extract_channel_units(channels, len(channel_names))
        dt = self._resolve_dt(headers)

        csv_name = f"{Path(filename).stem}.csv"
        csv_content = self._to_tagged_csv_bytes(df, channel_names, units, dt)
        return RSPConversionResult(
            filename=csv_name,
            content=csv_content,
            row_count=len(df),
            channel_count=len(channel_names),
        )

    def _load_via_rpc_reader(self, rsp_path: Path) -> tuple[pd.DataFrame, list[Any], dict[str, Any]]:
        scanned = self._scan_rsp_headers(rsp_path)
        extra_headers = self._build_extra_headers(scanned)

        ctor = self._resolve_rpc_reader_ctor()
        try:
            reader = ctor(rsp_path, extra_headers=extra_headers)
        except TypeError:
            reader = ctor(rsp_path)

        for load_method in ("import_rpc_data_from_file", "read", "load", "parse"):
            fn = getattr(reader, load_method, None)
            if callable(fn):
                fn()
                break

        data = None
        get_data = getattr(reader, "get_data", None)
        if callable(get_data):
            data = get_data()
        elif hasattr(reader, "data"):
            data = reader.data

        if data is None:
            raise RuntimeError("rpc-reader could not extract numeric channel data")

        channels = []
        get_channels = getattr(reader, "get_channels", None)
        if callable(get_channels):
            channels = get_channels() or []
        elif hasattr(reader, "channels"):
            channels = reader.channels or []

        headers = None
        get_headers = getattr(reader, "get_headers", None)
        if callable(get_headers):
            headers = get_headers()
        elif hasattr(reader, "headers"):
            headers = reader.headers

        header_dict = self._to_header_dict(headers)
        if extra_headers:
            header_dict["injected_headers"] = extra_headers
        return pd.DataFrame(data), channels, header_dict

    def _scan_rsp_headers(self, rsp_path: Path) -> dict[str, str]:
        """Read raw RPC III header key/value pairs without decoding channel data."""
        headers: dict[str, str] = {}
        with rsp_path.open("rb") as file_handle:
            for _ in range(3):
                head_name, head_value = struct.unpack("<32s96s", file_handle.read(128))
                head_name = head_name.replace(b"\0", b"").decode("windows-1252").strip()
                head_value = head_value.replace(b"\0", b"").decode("windows-1252").strip()
                headers[head_name] = head_value

            num_params = int(headers["NUM_PARAMS"])
            for _ in range(3, num_params):
                head_name, head_value = struct.unpack("<32s96s", file_handle.read(128))
                head_name = head_name.replace(b"\0", b"").decode("windows-1252").strip()
                if head_name:
                    headers[head_name] = head_value.replace(b"\0", b"").decode("windows-1252").strip()

        headers["_file_size"] = str(rsp_path.stat().st_size)
        return headers

    def _infer_data_type(self, scanned: dict[str, str]) -> str | None:
        """Infer DATA_TYPE by matching payload size to the expected byte count."""
        required = ("NUM_HEADER_BLOCKS", "CHANNELS", "PTS_PER_FRAME", "PTS_PER_GROUP", "FRAMES")
        if not all(key in scanned for key in required):
            return None

        try:
            num_header_blocks = int(scanned["NUM_HEADER_BLOCKS"])
            channels = int(scanned["CHANNELS"])
            pts_per_frame = int(scanned["PTS_PER_FRAME"])
            pts_per_group = int(scanned["PTS_PER_GROUP"])
            frames = int(scanned["FRAMES"])
            file_size = int(scanned["_file_size"])
        except (TypeError, ValueError):
            return None

        frames_per_group = int(pts_per_group / pts_per_frame)
        if frames_per_group <= 0:
            return None

        number_of_groups = int(ceil(frames / frames_per_group))
        actual_size = file_size - num_header_blocks * 512
        matches: list[str] = []

        for data_type, bytes_per_value in DATA_TYPE_BYTES.items():
            expected_size = (
                pts_per_frame * bytes_per_value * frames_per_group * number_of_groups * channels
            )
            if actual_size == expected_size:
                matches.append(data_type)

        if len(matches) == 1:
            return matches[0]
        if "SHORT_INTEGER" in matches:
            return "SHORT_INTEGER"
        return matches[0] if matches else None

    def _build_extra_headers(self, scanned: dict[str, str]) -> list[list[str]]:
        """Return rpc_reader extra_headers for missing mandatory RSP header fields."""
        extras: list[list[str]] = []
        data_type = scanned.get("DATA_TYPE", "").strip()

        if not data_type:
            inferred = self._infer_data_type(scanned)
            data_type = inferred or "SHORT_INTEGER"
            extras.append(["DATA_TYPE", data_type])

        if data_type == "SHORT_INTEGER" and not str(scanned.get("INT_FULL_SCALE", "")).strip():
            extras.append(["INT_FULL_SCALE", DEFAULT_INT_FULL_SCALE])

        return extras

    def _missing_mandatory_headers(self, scanned: dict[str, str]) -> list[str]:
        return [
            header
            for header in MANDATORY_RPC_HEADERS
            if header not in scanned or not str(scanned[header]).strip()
        ]

    def _format_rpc_reader_error(self, rsp_path: Path, message: str) -> str:
        scanned = self._scan_rsp_headers(rsp_path)
        missing = self._missing_mandatory_headers(scanned)
        if missing:
            return (
                f"rpc-reader failed: {message} "
                f"(missing RSP headers: {', '.join(missing)})"
            )
        return f"rpc-reader failed: {message}"

    def _resolve_rpc_reader_ctor(self) -> Any:
        try:
            rpc_reader = importlib.import_module("rpc_reader")
        except ImportError as exc:
            raise RuntimeError("RSP conversion requires the rpc-reader package") from exc

        reader_names = ("ReadRPC", "RPCReader")
        for name in reader_names:
            ctor = getattr(rpc_reader, name, None)
            if callable(ctor):
                return ctor

        for submodule in ("rpc_reader", "reader", "core"):
            try:
                module = importlib.import_module(f"rpc_reader.{submodule}")
            except ImportError:
                continue
            for name in reader_names:
                ctor = getattr(module, name, None)
                if callable(ctor):
                    return ctor

        raise RuntimeError("Installed rpc-reader package has no supported reader class")

    def _to_tagged_csv_bytes(
        self,
        df: pd.DataFrame,
        channel_names: list[str],
        units: list[str],
        dt: float,
    ) -> bytes:
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)

        writer.writerow(["#HEADER"])
        writer.writerow(["#TITLES"])
        writer.writerow(["", ""] + [f"{i + 1} {name}" for i, name in enumerate(channel_names)])
        writer.writerow(["#UNITS"])
        writer.writerow(["", ""] + units)
        writer.writerow(["#DATATYPES"])
        writer.writerow(["Huge", "Double"] + ["Float"] * len(channel_names))
        writer.writerow(["#DATA"])

        for row_idx, values in enumerate(df.itertuples(index=False, name=None), start=1):
            time_value = f"{(row_idx - 1) * dt:.6f}"
            writer.writerow([row_idx, time_value, *values])

        return buffer.getvalue().encode("utf-8")

    def _to_header_dict(self, obj: Any) -> dict[str, Any]:
        if obj is None:
            return {}
        if isinstance(obj, dict):
            return {str(k): v for k, v in obj.items()}
        if isinstance(obj, list):
            return {f"item_{i}": item for i, item in enumerate(obj)}
        return {"raw_header": obj}

    def _extract_channel_names(self, channels: list[Any], width: int) -> list[str]:
        names = []
        for i in range(width):
            channel = channels[i] if i < len(channels) else None
            name = self._get_channel_value(
                channel,
                (
                    "Description",
                    "description",
                    "DESC",
                    "title",
                    "Title",
                    "name",
                    "Name",
                    "channel_name",
                ),
            )
            names.append(str(name).strip() if name else f"channel_{i + 1}")

        seen: dict[str, int] = {}
        unique_names = []
        for name in names:
            count = seen.get(name, 0)
            seen[name] = count + 1
            unique_names.append(name if count == 0 else f"{name}_{count + 1}")
        return unique_names

    def _extract_channel_units(self, channels: list[Any], width: int) -> list[str]:
        units = []
        for i in range(width):
            channel = channels[i] if i < len(channels) else None
            unit = self._get_channel_value(channel, ("units", "Units", "unit"))
            units.append(str(unit).strip() if unit else "")
        return units

    def _get_channel_value(self, channel: Any, names: tuple[str, ...]) -> Any:
        if channel is None:
            return None
        if isinstance(channel, str):
            return channel if "name" in names else None
        if isinstance(channel, dict):
            for name in names:
                if channel.get(name):
                    return channel[name]
            return None
        for name in names:
            value = getattr(channel, name, None)
            if value:
                return value
        return None

    def _resolve_dt(self, header_dict: dict[str, Any]) -> float:
        for key in (
            "DELTA_T",
            "DELTA T",
            "DELTAT",
            "delta_t",
            "sample_interval",
            "x_increment",
        ):
            if key not in header_dict:
                continue
            try:
                return float(header_dict[key])
            except (TypeError, ValueError):
                continue
        return 1.0
