"""Route orchestration helpers for dashboard channel-map and schedule workflows."""

from __future__ import annotations

import json
from typing import Any

from server.models.damage import DamageFailureReport
from server.services.post_upload_precompute import (
    decide_after_schedule_save,
    schedule_precompute_decision_to_extension,
)
from server.upload.policies import (
    EDIT_UPLOADED_DATA_FORBIDDEN_DETAIL,
    has_contributor_edit_uploaded_data_policy,
)
from server.utils.channel_map_file import is_valid_channel_map_filename


def require_uploaded_data_edit_permission(
    *,
    store: Any,
    program_id: str,
    version: str,
    user_id: str,
    role: str,
) -> None:
    """Raise when caller cannot edit contributor-owned uploaded data."""
    can_edit = has_contributor_edit_uploaded_data_policy(
        store=store,
        program_id=program_id,
        version=version,
        user_id=user_id,
        role=role,
    )
    if not can_edit:
        raise PermissionError(EDIT_UPLOADED_DATA_FORBIDDEN_DETAIL)


def start_channel_reprocess_from_entries(
    *,
    ingestion_service: Any,
    program_id: str,
    version: str,
    entries: list[dict[str, Any]],
    user_id: str,
) -> dict[str, Any]:
    """Start channel reprocess from explicit editor entries."""
    return ingestion_service.start_channel_reprocess_from_save(
        program_id=program_id,
        version=version,
        entries=entries,
        user_id=user_id,
    )


async def start_channel_reprocess_from_yaml_upload(
    *,
    channel_map_files: list[Any],
) -> tuple[str, bytes]:
    """Validate one channel-map upload and return start result + file bytes."""
    if len(channel_map_files) != 1:
        raise ValueError("Upload exactly one channel_map.yml or channel_map.yaml file")
    selected_file = channel_map_files[0]
    if not selected_file.filename or not is_valid_channel_map_filename(selected_file.filename):
        raise ValueError("Upload exactly one channel_map.yml or channel_map.yaml file")
    return selected_file.filename, await selected_file.read()


def parse_schedule_preview(parse_preview_json: str) -> dict[str, Any]:
    """Parse persisted schedule preview JSON payload."""
    return json.loads(parse_preview_json)


def schedule_damage_extension(
    *,
    damage_service: Any,
    program_id: str,
    version: str,
    user_id: str,
    active_schedule: dict[str, Any],
    previous_preview: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build schedule save/attach response extension with damage decision state."""
    decision = decide_after_schedule_save(
        damage_service.db,
        program_id=program_id,
        version=version,
        user_id=user_id,
        active_schedule=active_schedule,
        damage_service=damage_service,
        previous_preview=previous_preview,
    )
    extension: dict[str, Any] = dict(schedule_precompute_decision_to_extension(decision))
    if "damage_prerequisite_report" in extension:
        extension["damage_prerequisite_report"] = DamageFailureReport(
            **extension["damage_prerequisite_report"]
        )
    return extension
