"""Pure folder-upload lane policies and constants."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Protocol

from server.upload.task_kinds import TASK_KIND_FOLDER_UPLOAD

FOLDER_UPLOAD_TASK_KIND = TASK_KIND_FOLDER_UPLOAD
FOLDER_UPLOAD_PHASE_UPLOAD_RECEIVED = "upload_received"
FOLDER_UPLOAD_PHASES: tuple[str, ...] = (
    FOLDER_UPLOAD_PHASE_UPLOAD_RECEIVED,
    "converting",
    "validating",
    "writing",
    "completed",
    "failed",
    "cancelled",
)

NO_DATA_FILES_ERROR = "No CSV or RSP files found"
MIXED_DATA_FORMAT_ERROR = "Upload folders must contain only one data format: CSV or RSP"
EDIT_UPLOADED_DATA_FORBIDDEN_DETAIL = "You can only edit uploaded data you own"
SCOPE_DELETE_FORBIDDEN_DETAIL = (
    "This program/version contains data owned by another user. Contact an admin to delete it."
)

_CHANNEL_MAP_COMPANION_BASENAMES = frozenset({"channel_map.yaml", "channel_map.yml"})


@dataclass(frozen=True)
class UploadBatchClassification:
    """Classification result for one folder-upload selection."""

    data_filenames: list[str]
    data_format: Literal["csv", "rsp"] | None
    channel_map_companion_filename: str | None
    ignored_filenames: list[str]


class ProgramVersionContributorEditPolicyStore(Protocol):
    """Store protocol for contributor edit checks against uploaded data."""

    def user_can_edit_program_version(
        self,
        program_id: str,
        version: str,
        user_id: str,
        is_admin: bool,
    ) -> bool: ...


class ProgramVersionScopeDeletePolicyStore(Protocol):
    """Store protocol for scope delete checks."""

    def user_can_delete_program_version_scope(
        self,
        program_id: str,
        version: str | None,
        user_id: str,
        is_admin: bool,
    ) -> bool: ...


def _basename_lower(filename: str) -> str:
    normalized = filename.replace("\\", "/")
    return os.path.basename(normalized).lower()


def classify_upload_filenames(filenames: list[str]) -> UploadBatchClassification:
    """Classify upload filenames and enforce CSV/RSP exclusivity."""
    data_filenames: list[str] = []
    ignored_filenames: list[str] = []
    data_formats: set[Literal["csv", "rsp"]] = set()
    channel_map_companion_filename: str | None = None

    for filename in filenames:
        if not filename:
            continue
        basename = _basename_lower(filename)
        lower_filename = filename.lower()

        if basename in _CHANNEL_MAP_COMPANION_BASENAMES:
            if channel_map_companion_filename is None:
                channel_map_companion_filename = filename
            else:
                ignored_filenames.append(filename)
            continue

        if lower_filename.endswith(".csv"):
            data_formats.add("csv")
            data_filenames.append(filename)
            continue

        if lower_filename.endswith(".rsp"):
            data_formats.add("rsp")
            data_filenames.append(filename)
            continue

        ignored_filenames.append(filename)

    if len(data_formats) > 1:
        raise ValueError(MIXED_DATA_FORMAT_ERROR)

    data_format: Literal["csv", "rsp"] | None
    if "csv" in data_formats:
        data_format = "csv"
    elif "rsp" in data_formats:
        data_format = "rsp"
    else:
        data_format = None

    return UploadBatchClassification(
        data_filenames=data_filenames,
        data_format=data_format,
        channel_map_companion_filename=channel_map_companion_filename,
        ignored_filenames=ignored_filenames,
    )


def require_data_files(classification: UploadBatchClassification) -> None:
    """Enforce the public contract that at least one data file is present."""
    if classification.data_format is None or not classification.data_filenames:
        raise ValueError(NO_DATA_FILES_ERROR)


def has_uploaded_data_admin_policy(*, role: str) -> bool:
    """Admins can CRUD uploaded data regardless of contributor ownership."""
    return role == "admin"


def has_contributor_edit_uploaded_data_policy(
    *,
    store: ProgramVersionContributorEditPolicyStore,
    program_id: str,
    version: str,
    user_id: str,
    role: str,
) -> bool:
    """Write contributors can edit uploaded data only for datasets they own."""
    return store.user_can_edit_program_version(
        program_id,
        version,
        user_id,
        has_uploaded_data_admin_policy(role=role),
    )


def has_scope_delete_uploaded_data_policy(
    *,
    store: ProgramVersionScopeDeletePolicyStore,
    program_id: str,
    version: str | None,
    user_id: str,
    role: str,
) -> bool:
    """Scope delete keeps exclusive-owner-or-admin semantics."""
    return store.user_can_delete_program_version_scope(
        program_id,
        version,
        user_id,
        has_uploaded_data_admin_policy(role=role),
    )

