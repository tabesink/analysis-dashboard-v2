"""Version-scoped durability schedule parsing and artifact storage."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from server.services.source_artifact_storage import ARTIFACT_SCHEME, UNSAFE_PATH_PATTERN

SCHEDULE_PREFIX = "schedules/"
SCHEDULE_BASENAME = "schedule.sch"
PREVIEW_ENTRY_LIMIT = 5

ENTRY_RE = re.compile(r"^\*([^*]+)\*\s+(\d+)\s+([\d.]+)\s*$")
ID_RE = re.compile(r"^\*id\s+(.+)$", re.IGNORECASE)
MULT_RE = re.compile(r"^\*multiplier\s+([\d.]+)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class ParsedDurabilitySchedule:
    """Parsed autodam schedule metadata and pattern entries."""

    schedule_id: str | None
    multiplier: float
    entries: list[dict[str, Any]]
    parse_preview_json: str


@dataclass(frozen=True)
class StoredDurabilitySchedule:
    """Public result of persisting a durability schedule artifact."""

    schedule_id: int
    artifact_uri: str
    schedule_sha256: str
    source_filename: str
    parse_preview_json: str
    replaced_previous: bool
    previous_schedule_id: int | None


class DurabilityScheduleParser:
    """Parse autodam `.sch` durability schedule files."""

    def parse_bytes(self, content: bytes) -> ParsedDurabilitySchedule:
        schedule_id: str | None = None
        multiplier = 1.0
        entries: list[dict[str, Any]] = []

        for raw_line in content.decode("utf-8", errors="replace").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower().startswith("*summary"):
                break
            if match := ID_RE.match(line):
                schedule_id = match.group(1).strip()
                continue
            if match := MULT_RE.match(line):
                multiplier = float(match.group(1))
                continue
            if match := ENTRY_RE.match(line):
                entries.append(
                    {
                        "pattern": match.group(1),
                        "repeats": int(match.group(2)),
                        "weight": float(match.group(3)),
                    }
                )

        preview = {
            "schedule_id": schedule_id,
            "multiplier": multiplier,
            "entry_count": len(entries),
            "entries": entries,
            "entries_preview": entries[:PREVIEW_ENTRY_LIMIT],
        }
        return ParsedDurabilitySchedule(
            schedule_id=schedule_id,
            multiplier=multiplier,
            entries=entries,
            parse_preview_json=json.dumps(preview, sort_keys=True, separators=(",", ":")),
        )


class DurabilityScheduleStorageService:
    """Writes durability schedule bytes and tracks the active attachment."""

    REL_ROOT = Path("artifacts") / "schedules"

    def __init__(self, data_root: Path, db: Any):
        self.data_root = data_root.resolve()
        self.db = db

    def attach_schedule(
        self,
        *,
        program_id: str,
        version: str,
        source_filename: str,
        content: bytes,
        parsed: ParsedDurabilitySchedule,
        owner_user_id: str | None,
        actor_user_id: str | None,
    ) -> StoredDurabilitySchedule:
        """Persist schedule bytes, upsert ledger row, and set active attachment."""
        schedule_sha256 = hashlib.sha256(content).hexdigest()
        artifact_uri = self.build_artifact_uri(schedule_sha256)
        target = self.resolve_uri(artifact_uri)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if target.read_bytes() != content:
                raise ValueError("Existing schedule content does not match checksum")
        else:
            target.write_bytes(content)

        previous = self.db.get_active_durability_schedule(program_id, version)
        schedule_id = self.db.upsert_durability_schedule_artifact(
            program_id=program_id,
            version=version,
            source_filename=source_filename,
            schedule_sha256=schedule_sha256,
            artifact_uri=artifact_uri,
            parse_preview_json=parsed.parse_preview_json,
            owner_user_id=owner_user_id,
        )
        self.db.set_active_durability_schedule(
            program_id=program_id,
            version=version,
            schedule_id=schedule_id,
        )

        replaced_previous = previous is not None and int(previous["schedule_id"]) != schedule_id
        previous_schedule_id = int(previous["schedule_id"]) if replaced_previous else None
        identical_reupload = (
            previous is not None and int(previous["schedule_id"]) == schedule_id
        )
        if not identical_reupload:
            action = (
                "DURABILITY_SCHEDULE_REPLACED"
                if replaced_previous
                else "DURABILITY_SCHEDULE_ATTACHED"
            )
            self.db.log_audit(
                action=action,
                user_id=actor_user_id,
                details={
                    "program_id": program_id,
                    "version": version,
                    "schedule_id": schedule_id,
                    "previous_schedule_id": previous_schedule_id,
                    "schedule_sha256": schedule_sha256,
                    "source_filename": source_filename,
                    "parse_preview": json.loads(parsed.parse_preview_json),
                },
            )

        return StoredDurabilitySchedule(
            schedule_id=schedule_id,
            artifact_uri=artifact_uri,
            schedule_sha256=schedule_sha256,
            source_filename=source_filename,
            parse_preview_json=parsed.parse_preview_json,
            replaced_previous=replaced_previous,
            previous_schedule_id=previous_schedule_id,
        )

    def build_artifact_uri(self, schedule_sha256: str) -> str:
        artifact_key = self._artifact_key(schedule_sha256)
        self._validate_uri_components(artifact_key, SCHEDULE_BASENAME)
        return f"{ARTIFACT_SCHEME}{SCHEDULE_PREFIX}{artifact_key}/{SCHEDULE_BASENAME}"

    def resolve_uri(self, artifact_uri: str) -> Path:
        if not artifact_uri.startswith(ARTIFACT_SCHEME):
            raise ValueError("Artifact URI must use artifact:// scheme")
        rel = artifact_uri[len(ARTIFACT_SCHEME) :]
        if UNSAFE_PATH_PATTERN.search(rel) or rel.startswith("/") or "\\" in rel:
            raise ValueError("Unsafe artifact path component")
        if not rel.startswith(SCHEDULE_PREFIX):
            raise ValueError("Unsupported artifact URI namespace")
        remainder = rel[len(SCHEDULE_PREFIX) :]
        parts = remainder.split("/")
        if len(parts) != 2:
            raise ValueError("Invalid artifact URI path")
        artifact_key, basename = parts
        self._validate_uri_components(artifact_key, basename)
        return self.data_root / self.REL_ROOT / artifact_key / basename

    def _artifact_key(self, schedule_sha256: str) -> str:
        return f"sch_{schedule_sha256[:16]}"

    def _validate_uri_components(self, artifact_key: str, basename: str) -> None:
        for part in (artifact_key, basename):
            if not part or UNSAFE_PATH_PATTERN.search(part):
                raise ValueError("Unsafe artifact path component")
            if part.startswith("/") or "\\" in part:
                raise ValueError("Unsafe artifact path component")

    def save_schedule_edits(
        self,
        *,
        program_id: str,
        version: str,
        multiplier: float,
        event_rows: list[dict[str, Any]],
        delimiter_token: str | None,
        actor_user_id: str | None,
    ) -> dict[str, Any]:
        """Persist edited table rows on the active schedule preview metadata."""
        active = self.db.get_active_durability_schedule(program_id, version)
        if active is None:
            raise LookupError("No active durability schedule")

        program_events = self.db.get_events(program_id=program_id, version=version)
        valid_event_ids = {str(event["event_id"]) for event in program_events}
        submitted_event_ids = {str(row["event_id"]) for row in event_rows}
        unknown_event_ids = sorted(submitted_event_ids - valid_event_ids)
        if unknown_event_ids:
            raise ValueError(
                "event_id values must belong to the selected program/version: "
                + ", ".join(unknown_event_ids)
            )

        preview = json.loads(str(active["parse_preview_json"]))
        preview["multiplier"] = multiplier
        preview["event_rows"] = event_rows
        if delimiter_token is not None:
            preview["delimiter_token"] = delimiter_token
        elif "delimiter_token" in preview:
            preview.pop("delimiter_token")

        updated_preview_json = json.dumps(preview, sort_keys=True, separators=(",", ":"))
        schedule_id = int(active["schedule_id"])
        self.db.update_durability_schedule_parse_preview(schedule_id, updated_preview_json)

        self.db.log_audit(
            action="DURABILITY_SCHEDULE_EDITED",
            user_id=actor_user_id,
            details={
                "program_id": program_id,
                "version": version,
                "schedule_id": schedule_id,
                "row_count": len(event_rows),
                "parse_preview": json.loads(updated_preview_json),
            },
        )

        updated = self.db.get_active_durability_schedule(program_id, version)
        if updated is None:
            raise LookupError("No active durability schedule")
        return updated
