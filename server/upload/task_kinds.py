"""Shared upload/derived/database task kind and status constants."""

from __future__ import annotations

TASK_KIND_FOLDER_UPLOAD = "folder_upload"
TASK_KIND_CHANNEL_REPROCESS = "channel_reprocess"
TASK_KIND_DAMAGE_CALCULATION = "damage_calculation"
TASK_KIND_DATABASE_EXPORT = "database_export"
TASK_KIND_DATABASE_CREATE = "database_create"
TASK_KIND_DATABASE_SWITCH = "database_switch"
TASK_KIND_DATABASE_DELETE = "database_delete"

DERIVED_DATA_TASK_KINDS = frozenset(
    {
        TASK_KIND_CHANNEL_REPROCESS,
        TASK_KIND_DAMAGE_CALCULATION,
    }
)

ACTIVE_TASK_STATUSES = frozenset({"queued", "running", "cancelling"})

ACTIVE_UPLOAD_TASK_KINDS = frozenset(
    {
        TASK_KIND_FOLDER_UPLOAD,
        *DERIVED_DATA_TASK_KINDS,
    }
)

DATABASE_EXCLUSIVE_OPERATION_KINDS = frozenset(
    {
        TASK_KIND_DATABASE_CREATE,
        TASK_KIND_DATABASE_SWITCH,
        TASK_KIND_DATABASE_DELETE,
    }
)
