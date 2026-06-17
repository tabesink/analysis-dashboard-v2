"""Unit tests for pure folder-upload policy helpers."""

from __future__ import annotations

import pytest

from server.upload.policies import (
    EDIT_UPLOADED_DATA_FORBIDDEN_DETAIL,
    FOLDER_UPLOAD_PHASES,
    FOLDER_UPLOAD_TASK_KIND,
    MIXED_DATA_FORMAT_ERROR,
    NO_DATA_FILES_ERROR,
    SCOPE_DELETE_FORBIDDEN_DETAIL,
    classify_upload_filenames,
    has_contributor_edit_uploaded_data_policy,
    has_upload_task_cancel_policy,
    has_scope_delete_uploaded_data_policy,
    has_uploaded_data_admin_policy,
    require_data_files,
)
from server.upload.task_kinds import (
    ACTIVE_TASK_STATUSES,
    ACTIVE_UPLOAD_TASK_KINDS,
    DERIVED_DATA_TASK_KINDS,
    TASK_KIND_CHANNEL_REPROCESS,
    TASK_KIND_DAMAGE_CALCULATION,
    TASK_KIND_DATABASE_EXPORT,
    TASK_KIND_FOLDER_UPLOAD,
)


def test_csv_only_batch_is_classified_as_csv() -> None:
    classification = classify_upload_filenames(
        ["nested/a.csv", "nested/b.CSV", "nested/readme.txt"],
    )

    assert classification.data_format == "csv"
    assert classification.data_filenames == ["nested/a.csv", "nested/b.CSV"]
    assert classification.channel_map_companion_filename is None
    assert classification.ignored_filenames == ["nested/readme.txt"]
    require_data_files(classification)


def test_rsp_only_batch_is_classified_as_rsp() -> None:
    classification = classify_upload_filenames(["event_01.rsp", "event_02.RSP"])

    assert classification.data_format == "rsp"
    assert classification.data_filenames == ["event_01.rsp", "event_02.RSP"]
    assert classification.channel_map_companion_filename is None
    require_data_files(classification)


def test_mixed_csv_and_rsp_batch_is_rejected() -> None:
    with pytest.raises(ValueError, match=MIXED_DATA_FORMAT_ERROR):
        classify_upload_filenames(["event_01.csv", "event_02.rsp"])


@pytest.mark.parametrize(
    "filename",
    ["channel_map.yaml", "folder/sub/channel_map.yml", "FOLDER\\SUB\\CHANNEL_MAP.YAML"],
)
def test_channel_map_companion_file_is_detected(filename: str) -> None:
    classification = classify_upload_filenames(["event.csv", filename, "notes.md"])

    assert classification.channel_map_companion_filename == filename
    assert classification.data_format == "csv"
    assert classification.data_filenames == ["event.csv"]
    assert classification.ignored_filenames == ["notes.md"]


def test_unsupported_files_are_ignored_but_no_data_still_errors() -> None:
    classification = classify_upload_filenames(["notes.md", "preview.png", "channel_map.yml"])

    assert classification.data_filenames == []
    assert classification.data_format is None
    assert classification.channel_map_companion_filename == "channel_map.yml"
    with pytest.raises(ValueError, match=NO_DATA_FILES_ERROR):
        require_data_files(classification)


def test_folder_upload_task_and_phase_names_remain_stable() -> None:
    assert FOLDER_UPLOAD_TASK_KIND == "folder_upload"
    assert FOLDER_UPLOAD_PHASES == (
        "upload_received",
        "converting",
        "validating",
        "writing",
        "completed",
        "failed",
        "cancelled",
    )


def test_shared_task_kind_contract_constants_remain_stable() -> None:
    assert TASK_KIND_FOLDER_UPLOAD == "folder_upload"
    assert TASK_KIND_CHANNEL_REPROCESS == "channel_reprocess"
    assert TASK_KIND_DAMAGE_CALCULATION == "damage_calculation"
    assert TASK_KIND_DATABASE_EXPORT == "database_export"
    assert DERIVED_DATA_TASK_KINDS == {"channel_reprocess", "damage_calculation"}
    assert ACTIVE_TASK_STATUSES == {"queued", "running", "cancelling"}
    assert ACTIVE_UPLOAD_TASK_KINDS == {
        "folder_upload",
        "channel_reprocess",
        "damage_calculation",
    }


def test_uploaded_data_admin_policy_is_admin_only() -> None:
    assert has_uploaded_data_admin_policy(role="admin") is True
    assert has_uploaded_data_admin_policy(role="user") is False


def test_contributor_edit_policy_delegates_to_store_with_admin_flag() -> None:
    calls: list[tuple[str, str, str, bool]] = []

    class _Store:
        def user_can_edit_program_version(
            self,
            program_id: str,
            version: str,
            user_id: str,
            is_admin: bool,
        ) -> bool:
            calls.append((program_id, version, user_id, is_admin))
            return is_admin

    store = _Store()
    assert (
        has_contributor_edit_uploaded_data_policy(
            store=store,
            program_id="P-1",
            version="V1",
            user_id="user-a",
            role="user",
        )
        is False
    )
    assert (
        has_contributor_edit_uploaded_data_policy(
            store=store,
            program_id="P-1",
            version="V1",
            user_id="admin-a",
            role="admin",
        )
        is True
    )
    assert calls == [
        ("P-1", "V1", "user-a", False),
        ("P-1", "V1", "admin-a", True),
    ]


def test_scope_delete_policy_delegates_to_store_with_admin_flag() -> None:
    calls: list[tuple[str, str | None, str, bool]] = []

    class _Store:
        def user_can_delete_program_version_scope(
            self,
            program_id: str,
            version: str | None,
            user_id: str,
            is_admin: bool,
        ) -> bool:
            calls.append((program_id, version, user_id, is_admin))
            return program_id == "P-owned" and not is_admin

    store = _Store()
    assert (
        has_scope_delete_uploaded_data_policy(
            store=store,
            program_id="P-owned",
            version=None,
            user_id="user-a",
            role="user",
        )
        is True
    )
    assert (
        has_scope_delete_uploaded_data_policy(
            store=store,
            program_id="P-owned",
            version="V1",
            user_id="admin-a",
            role="admin",
        )
        is False
    )
    assert calls == [
        ("P-owned", None, "user-a", False),
        ("P-owned", "V1", "admin-a", True),
    ]


def test_permission_details_are_named_policy_contract_constants() -> None:
    assert EDIT_UPLOADED_DATA_FORBIDDEN_DETAIL == "You can only edit uploaded data you own"
    assert SCOPE_DELETE_FORBIDDEN_DETAIL == (
        "This program/version contains data owned by another user. Contact an admin to delete it."
    )


def test_cancel_policy_allows_folder_owner_or_admin() -> None:
    class _Store:
        def user_can_edit_program_version(
            self,
            program_id: str,
            version: str,
            user_id: str,
            is_admin: bool,
        ) -> bool:
            return False

    store = _Store()
    task_row = {"created_by_user_id": "owner-id"}
    assert (
        has_upload_task_cancel_policy(
            store=store,
            task_kind="folder_upload",
            task_row=task_row,
            user_id="owner-id",
            role="user",
        )
        is True
    )
    assert (
        has_upload_task_cancel_policy(
            store=store,
            task_kind="folder_upload",
            task_row=task_row,
            user_id="other-id",
            role="user",
        )
        is False
    )
    assert (
        has_upload_task_cancel_policy(
            store=store,
            task_kind="folder_upload",
            task_row=task_row,
            user_id="other-id",
            role="admin",
        )
        is True
    )


def test_cancel_policy_for_derived_tasks_uses_scope_ownership() -> None:
    calls: list[tuple[str, str, str, bool]] = []

    class _Store:
        def user_can_edit_program_version(
            self,
            program_id: str,
            version: str,
            user_id: str,
            is_admin: bool,
        ) -> bool:
            calls.append((program_id, version, user_id, is_admin))
            return program_id == "P-owned" and version == "V1" and user_id == "owner-id"

    store = _Store()
    assert (
        has_upload_task_cancel_policy(
            store=store,
            task_kind="channel_reprocess",
            task_row={"scope_json": {"program_id": "P-owned", "version": "V1"}},
            user_id="owner-id",
            role="user",
        )
        is True
    )
    assert (
        has_upload_task_cancel_policy(
            store=store,
            task_kind="damage_calculation",
            task_row={"scope_json": {"program_id": "P-owned", "version": "V1"}},
            user_id="other-id",
            role="user",
        )
        is False
    )
    assert calls == [
        ("P-owned", "V1", "owner-id", False),
        ("P-owned", "V1", "other-id", False),
    ]

