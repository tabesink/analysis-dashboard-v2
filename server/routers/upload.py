"""File upload endpoints."""

import asyncio
from datetime import datetime
import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from server.config import get_settings
from server.dependencies import (
    CurrentUserDep,
    DatabaseDep,
    IngestionServiceDep,
    QueryServiceDep,
    UploadQueryServiceDep,
    WriteUserDep,
)
from server.models.upload import (
    DatasetInfo,
    DatasetListResponse,
    DeleteEventResponse,
    DeleteEventsRequest,
    DeleteEventsResponse,
    DeleteProgramVersionScopeRequest,
    DeleteProgramVersionScopeResponse,
    FailedUploadCleanupResponse,
    FileResult,
    ProgramVersionSummary,
    PurgeDeletedEventsRequest,
    PurgeDeletedEventsResponse,
    UploadResponse,
    UploadTaskCancelResponse,
    UploadTaskDiscoveryResponse,
    UploadTaskEvent,
    UploadTaskStartResponse,
    ValidationIssue,
)
from server.services.operation_admission import (
    OperationAdmissionError,
    assert_can_start_folder_upload,
)
from server.services.dashboard_orchestration import can_access_derived_task_scope
from server.upload.task_kinds import (
    ACTIVE_TASK_STATUSES,
    ACTIVE_UPLOAD_TASK_KINDS,
    DERIVED_DATA_TASK_KINDS,
    TASK_KIND_FOLDER_UPLOAD,
)
from server.upload.policies import (
    FOLDER_UPLOAD_PHASE_UPLOAD_RECEIVED,
    classify_upload_filenames,
    has_upload_task_cancel_policy,
    has_scope_delete_uploaded_data_policy,
    require_data_files,
    SCOPE_DELETE_FORBIDDEN_DETAIL,
)
from server.utils.logging import get_audit_logger

router = APIRouter(prefix="/upload")
settings = get_settings()
audit_log = get_audit_logger()
MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024


def _as_iso_datetime(value: object) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value
    return None


def _to_upload_response(result: object | None) -> UploadResponse | None:
    if result is None:
        return None
    files = result.get("files", []) if isinstance(result, dict) else result.files
    file_results = [
        FileResult(
            filename=f["filename"] if isinstance(f, dict) else f.filename,
            success=f["success"] if isinstance(f, dict) else f.success,
            event_id=f.get("event_id") if isinstance(f, dict) else f.event_id,
            error=f.get("error") if isinstance(f, dict) else f.error,
            row_count=f.get("row_count", 0) if isinstance(f, dict) else f.row_count,
            validation_issues=[
                ValidationIssue(**issue)
                for issue in (
                    f.get("validation_issues", [])
                    if isinstance(f, dict)
                    else f.validation_issues
                )
            ],
        )
        for f in files
    ]
    if isinstance(result, dict):
        return UploadResponse(
            success=bool(result.get("success")),
            files=file_results,
            event_ids=list(result.get("event_ids", [])),
            error=result.get("error"),
            total_rows=int(result.get("total_rows", 0)),
            pending_channel_map=bool(result.get("pending_channel_map", False)),
        )
    return UploadResponse(
        success=result.success,
        files=file_results,
        event_ids=result.event_ids,
        error=result.error,
        total_rows=result.total_rows,
        pending_channel_map=getattr(result, "pending_channel_map", False),
    )


def _build_upload_task_event(task_id: str, row: dict[str, object]) -> UploadTaskEvent:
    """Build a poll/SSE upload task payload from a database row."""
    status_value = str(row.get("status") or "queued")
    task_kind = str(row.get("task_kind") or TASK_KIND_FOLDER_UPLOAD)
    terminal_state = status_value if status_value in {"completed", "failed", "cancelled"} else None
    error_value = row.get("error")
    parsed_error_details: dict[str, object] | None = None
    if isinstance(error_value, dict):
        parsed_error_details = {str(key): value for key, value in error_value.items()}
    elif isinstance(error_value, str) and error_value.strip():
        try:
            loaded_error = json.loads(error_value)
        except json.JSONDecodeError:
            parsed_error_details = {"message": error_value}
        else:
            if isinstance(loaded_error, dict):
                parsed_error_details = {str(key): value for key, value in loaded_error.items()}
            elif loaded_error is not None:
                parsed_error_details = {"details": loaded_error}
    result_payload = row.get("result_json")
    result_summary: str | None = None
    if isinstance(result_payload, dict):
        failed_event_ids = result_payload.get("event_ids")
        cleanup_candidate_count = (
            len([value for value in failed_event_ids if isinstance(value, str)])
            if isinstance(failed_event_ids, list)
            else 0
        )
        if status_value in {"failed", "cancelled"} and task_kind == TASK_KIND_FOLDER_UPLOAD:
            if parsed_error_details is None:
                parsed_error_details = {}
            parsed_error_details["cleanup_required"] = cleanup_candidate_count > 0
            parsed_error_details["cleanup_candidate_event_count"] = cleanup_candidate_count
            if status_value == "cancelled":
                parsed_error_details["retry_guidance"] = (
                    "This upload was cancelled after partially committing data. "
                    "Run failed-upload cleanup before retrying the same files."
                )
            else:
                parsed_error_details["retry_guidance"] = (
                    "This upload failed after partially committing data. "
                    "Run failed-upload cleanup before retrying the same files."
                )
            parsed_error_details["cleanup_endpoint"] = (
                f"/api/v1/upload/folder/task/{task_id}/cleanup"
            )
        summary = result_payload.get("summary")
        if isinstance(summary, str) and summary.strip():
            result_summary = summary
        else:
            success = bool(result_payload.get("success"))
            file_count = len(result_payload.get("files", [])) if isinstance(result_payload.get("files"), list) else 0
            event_count = (
                len(result_payload.get("event_ids", []))
                if isinstance(result_payload.get("event_ids"), list)
                else int(row.get("completed_events") or 0)
            )
            result_summary = (
                f"{'Succeeded' if success else 'Failed'}: "
                f"{event_count} events across {file_count} files"
            )
    elif status_value == "failed" and task_kind == TASK_KIND_FOLDER_UPLOAD:
        if parsed_error_details is None:
            parsed_error_details = {}
        parsed_error_details["cleanup_required"] = False
        parsed_error_details["cleanup_candidate_event_count"] = 0
        parsed_error_details["retry_guidance"] = (
            "This upload failed or was interrupted. "
            "Run failed-upload cleanup before retrying if duplicate hash errors appear."
        )
        parsed_error_details["cleanup_endpoint"] = (
            f"/api/v1/upload/folder/task/{task_id}/cleanup"
        )
    return UploadTaskEvent(
        task_id=str(row.get("task_id") or task_id),
        status=status_value,
        terminal_state=terminal_state,
        task_owner_user_id=(
            str(row.get("created_by_user_id"))
            if row.get("created_by_user_id") is not None
            else None
        ),
        task_kind=task_kind,
        scope=row.get("scope_json") if isinstance(row.get("scope_json"), dict) else None,
        phase=str(row.get("phase") or FOLDER_UPLOAD_PHASE_UPLOAD_RECEIVED),
        completed_events=int(row.get("completed_events") or 0),
        total_events=int(row.get("total_events") or 0),
        current_event=row.get("current_event"),  # type: ignore[arg-type]
        progress_message=row.get("progress_message"),  # type: ignore[arg-type]
        started_at=_as_iso_datetime(row.get("started_at")),
        cancel_requested_at=_as_iso_datetime(row.get("cancel_requested_at")),
        finished_at=_as_iso_datetime(row.get("finished_at")),
        last_heartbeat_at=_as_iso_datetime(row.get("last_heartbeat_at")),
        runner_id=(
            str(row.get("runner_id"))
            if row.get("runner_id") is not None
            else None
        ),
        error=str(error_value) if isinstance(error_value, str) else None,
        error_details=parsed_error_details,
        result_summary=result_summary,
        result=_to_upload_response(result_payload),
    )


def _build_upload_task_cancel_response(row: dict[str, object]) -> UploadTaskCancelResponse:
    status_value = str(row.get("status") or "queued")
    terminal_state = status_value if status_value in {"completed", "failed", "cancelled"} else None
    return UploadTaskCancelResponse(
        task_id=str(row.get("task_id") or ""),
        status=status_value,
        terminal_state=terminal_state,
        task_kind=str(row.get("task_kind") or TASK_KIND_FOLDER_UPLOAD),
        cancel_requested_at=_as_iso_datetime(row.get("cancel_requested_at")),
    )


def _cancel_upload_task(
    *,
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> UploadTaskCancelResponse:
    task = db.get_upload_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )

    task_kind = str(task.get("task_kind") or TASK_KIND_FOLDER_UPLOAD)
    if task_kind not in ACTIVE_UPLOAD_TASK_KINDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )

    can_cancel = has_upload_task_cancel_policy(
        store=db,
        task_kind=task_kind,
        task_row=task,
        user_id=current_user["id"],
        role=current_user["role"],
    )
    if not can_cancel:
        if task_kind in DERIVED_DATA_TASK_KINDS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own uploads",
        )

    updated = db.request_upload_task_cancel(task_id)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )
    return _build_upload_task_cancel_response(updated)


async def _parse_upload_payload(
    program_id: Annotated[str, Form(description="Program identifier")],
    version: Annotated[str, Form(description="Version identifier")],
    files: Annotated[list[UploadFile], File(description="CSV or RSP files to upload")],
    channel_map: Annotated[
        UploadFile | None,
        File(description="channel_map.yaml file"),
    ] = None,
    status_value: Annotated[
        str | None,
        Form(alias="status", description="Status value (admin only)"),
    ] = None,
    job_number: Annotated[str | None, Form()] = None,
    work_order: Annotated[str | None, Form()] = None,
    rfq: Annotated[bool | None, Form()] = None,
    dv: Annotated[bool | None, Form()] = None,
    pv: Annotated[bool | None, Form()] = None,
    post_prod: Annotated[bool | None, Form()] = None,
    suspension_component: Annotated[str | None, Form()] = None,
    axle_location: Annotated[str | None, Form()] = None,
    gvw: Annotated[str | None, Form()] = None,
    fgawr: Annotated[str | None, Form()] = None,
    rgawr: Annotated[str | None, Form()] = None,
    drive_type: Annotated[str | None, Form()] = None,
    material_construction: Annotated[str | None, Form()] = None,
    steering_position: Annotated[str | None, Form()] = None,
    damper_type: Annotated[str | None, Form()] = None,
    vehicle_type: Annotated[str | None, Form()] = None,
    gross_vehicle_weight_range_lbs: Annotated[str | None, Form()] = None,
    custom_fields_json: Annotated[
        str | None,
        Form(description="Optional JSON object with custom field values"),
    ] = None,
) -> tuple[list[tuple[str, bytes]], bytes | None, dict[str, object], dict[str, str]]:
    """
    Upload CSV or RSP files with metadata.

    Requires channel_map.yaml file for plot configuration.
    Non-admin users always get status='Pending'.
    """
    # Read channel map
    channel_map_content = None
    total_bytes = 0
    if channel_map:
        channel_map_content = await channel_map.read()
        total_bytes += len(channel_map_content)
        if total_bytes > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload exceeds max size of {settings.max_upload_size_mb} MB",
            )

    # Classify data files with pure upload-lane policy rules.
    try:
        classification = classify_upload_filenames(
            [f.filename for f in files if f.filename],
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    try:
        require_data_files(classification)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    companion_filename = (
        classification.channel_map_companion_filename if channel_map is None else None
    )

    # Read data files. Ignore unrelated folder contents per route contract.
    file_data: list[tuple[str, bytes]] = []
    for f in files:
        if not f.filename:
            continue
        filename = f.filename
        lower_filename = filename.lower()

        if companion_filename is not None and filename == companion_filename:
            channel_map_content = await f.read()
            total_bytes += len(channel_map_content)
            if total_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Upload exceeds max size of {settings.max_upload_size_mb} MB",
                )
            continue

        if not lower_filename.endswith((".csv", ".rsp")):
            continue

        content = await f.read()
        total_bytes += len(content)
        if total_bytes > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload exceeds max size of {settings.max_upload_size_mb} MB",
            )
        file_data.append((filename, content))

    # Build metadata
    if not job_number or not job_number.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="job_number is required",
        )
    if not work_order or not work_order.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="work_order is required",
        )

    metadata = {}
    metadata["job_number"] = job_number.strip()
    metadata["work_order"] = work_order.strip()
    if rfq is not None:
        metadata["rfq"] = rfq
    if dv is not None:
        metadata["dv"] = dv
    if pv is not None:
        metadata["pv"] = pv
    if post_prod is not None:
        metadata["post_prod"] = post_prod
    if suspension_component:
        metadata["suspension_component"] = suspension_component
    if axle_location:
        metadata["axle_location"] = axle_location
    if gvw:
        metadata["gvw"] = gvw
    if fgawr:
        metadata["fgawr"] = fgawr
    if rgawr:
        metadata["rgawr"] = rgawr
    if drive_type:
        metadata["drive_type"] = drive_type
    if material_construction:
        metadata["material_construction"] = material_construction
    if steering_position:
        metadata["steering_position"] = steering_position
    if damper_type:
        metadata["damper_type"] = damper_type
    if vehicle_type:
        metadata["vehicle_type"] = vehicle_type
    if gross_vehicle_weight_range_lbs:
        metadata["gross_vehicle_weight_range_lbs"] = gross_vehicle_weight_range_lbs

    custom_field_values: dict[str, str] = {}
    if custom_fields_json:
        try:
            parsed = json.loads(custom_fields_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid custom_fields_json: {exc}",
            ) from exc
        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="custom_fields_json must be a JSON object",
            )
        for key, value in parsed.items():
            if not isinstance(key, str) or not isinstance(value, str):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="custom field keys and values must be strings",
                )
            key_clean = key.strip()
            value_clean = value.strip()
            if key_clean and value_clean:
                custom_field_values[key_clean] = value_clean

    return file_data, channel_map_content, metadata, custom_field_values


@router.post("/folder/start", response_model=UploadTaskStartResponse)
async def start_upload_folder(
    ingestion_service: IngestionServiceDep,
    current_user: WriteUserDep,
    program_id: Annotated[str, Form(description="Program identifier")],
    version: Annotated[str, Form(description="Version identifier")],
    files: Annotated[list[UploadFile], File(description="CSV or RSP files to upload")],
    channel_map: Annotated[
        UploadFile | None,
        File(description="channel_map.yaml file"),
    ] = None,
    status_value: Annotated[
        str | None,
        Form(alias="status", description="Status value (admin only)"),
    ] = None,
    job_number: Annotated[str | None, Form()] = None,
    work_order: Annotated[str | None, Form()] = None,
    rfq: Annotated[bool | None, Form()] = None,
    dv: Annotated[bool | None, Form()] = None,
    pv: Annotated[bool | None, Form()] = None,
    post_prod: Annotated[bool | None, Form()] = None,
    suspension_component: Annotated[str | None, Form()] = None,
    axle_location: Annotated[str | None, Form()] = None,
    gvw: Annotated[str | None, Form()] = None,
    fgawr: Annotated[str | None, Form()] = None,
    rgawr: Annotated[str | None, Form()] = None,
    drive_type: Annotated[str | None, Form()] = None,
    material_construction: Annotated[str | None, Form()] = None,
    steering_position: Annotated[str | None, Form()] = None,
    damper_type: Annotated[str | None, Form()] = None,
    vehicle_type: Annotated[str | None, Form()] = None,
    gross_vehicle_weight_range_lbs: Annotated[str | None, Form()] = None,
    custom_fields_json: Annotated[
        str | None,
        Form(description="Optional JSON object with custom field values"),
    ] = None,
) -> UploadTaskStartResponse:
    file_data, channel_map_content, metadata, custom_field_values = await _parse_upload_payload(
        program_id=program_id,
        version=version,
        files=files,
        channel_map=channel_map,
        status_value=status_value,
        job_number=job_number,
        work_order=work_order,
        rfq=rfq,
        dv=dv,
        pv=pv,
        post_prod=post_prod,
        suspension_component=suspension_component,
        axle_location=axle_location,
        gvw=gvw,
        fgawr=fgawr,
        rgawr=rgawr,
        drive_type=drive_type,
        material_construction=material_construction,
        steering_position=steering_position,
        damper_type=damper_type,
        vehicle_type=vehicle_type,
        gross_vehicle_weight_range_lbs=gross_vehicle_weight_range_lbs,
        custom_fields_json=custom_fields_json,
    )
    try:
        assert_can_start_folder_upload(ingestion_service.db)
        task_id = ingestion_service.start_upload_task(
            files=file_data,
            program_id=program_id,
            version=version,
            channel_map_content=channel_map_content,
            status_value=status_value or "Pending",
            is_admin=current_user["role"] == "admin",
            uploaded_by_user_id=current_user["id"],
            metadata=metadata,
            custom_field_values=custom_field_values,
        )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc
    audit_log.info(
        "upload started",
        extra={
            "event": "upload_started",
            "request_id": task_id,
            "user_id": current_user["id"],
            "username": current_user.get("username"),
            "rows": len(file_data),
            "bytes": sum(len(content) for _, content in file_data),
            "reason": f"program={program_id} version={version}",
        },
    )
    return UploadTaskStartResponse(task_id=task_id)


@router.get("/folder/task/{task_id}", response_model=UploadTaskEvent)
async def get_upload_folder_task(
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> UploadTaskEvent:
    """Return creator-scoped upload task status for client polling."""
    db.delete_expired_upload_tasks()
    db.reconcile_stale_upload_tasks()

    task = db.get_upload_task(task_id, created_by_user_id=current_user["id"])
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )
    return _build_upload_task_event(task_id, task)


@router.get("/tasks/active", response_model=UploadTaskDiscoveryResponse)
async def get_active_upload_tasks(
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> UploadTaskDiscoveryResponse:
    """Discover active/recent upload-task operations for reconnect recovery."""
    db.delete_expired_upload_tasks()
    db.reconcile_stale_upload_tasks()

    active_tasks: list[UploadTaskEvent] = []
    recent_terminal_tasks: list[UploadTaskEvent] = []
    rows = db.list_upload_tasks_for_discovery(limit=50)
    for row in rows:
        task_id = str(row.get("task_id") or "")
        task_kind = str(row.get("task_kind") or TASK_KIND_FOLDER_UPLOAD)

        if task_kind == TASK_KIND_FOLDER_UPLOAD:
            if str(row.get("created_by_user_id") or "") != current_user["id"]:
                continue
        elif task_kind in DERIVED_DATA_TASK_KINDS:
            if not can_access_derived_task_scope(
                store=db,
                task_row=row,
                user_id=current_user["id"],
                role=current_user["role"],
            ):
                continue
        else:
            continue

        event = _build_upload_task_event(task_id, row)
        if event.status in ACTIVE_TASK_STATUSES:
            active_tasks.append(event)
            continue
        if task_kind == TASK_KIND_FOLDER_UPLOAD and event.status in {"failed", "cancelled"}:
            recent_terminal_tasks.append(event)

    return UploadTaskDiscoveryResponse(
        active_tasks=active_tasks,
        recent_terminal_tasks=recent_terminal_tasks,
    )


@router.post("/tasks/{task_id}/cancel", response_model=UploadTaskCancelResponse)
async def cancel_upload_task(
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> UploadTaskCancelResponse:
    """Canonical cancel route for upload-task operation kinds."""
    return _cancel_upload_task(task_id=task_id, db=db, current_user=current_user)


@router.post("/folder/task/{task_id}/cancel", response_model=UploadTaskCancelResponse)
async def cancel_upload_folder_task(
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> UploadTaskCancelResponse:
    """Compatibility alias for folder-upload cancel requests."""
    return _cancel_upload_task(task_id=task_id, db=db, current_user=current_user)


@router.post(
    "/folder/task/{task_id}/cleanup",
    response_model=FailedUploadCleanupResponse,
)
async def cleanup_failed_upload_folder_task(
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
    query_service: QueryServiceDep,
) -> FailedUploadCleanupResponse:
    task = db.get_upload_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )
    if str(task.get("task_kind") or TASK_KIND_FOLDER_UPLOAD) != TASK_KIND_FOLDER_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cleanup is only supported for folder upload tasks",
        )
    task_status = str(task.get("status") or "")
    if task_status not in {"failed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed or cancelled folder upload tasks can be cleaned up",
        )

    task_owner = str(task.get("created_by_user_id") or "")
    if current_user["role"] != "admin" and current_user["id"] != task_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only clean up your own failed or cancelled uploads",
        )

    cleanup = db.cleanup_failed_folder_upload_task(task_id)
    if int(cleanup.get("deleted_event_count") or 0) > 0:
        query_service.invalidate_event_caches()

    audit_log.info(
        "failed folder upload cleaned up",
        extra={
            "event": "upload_failed_cleanup",
            "request_id": task_id,
            "user_id": current_user["id"],
            "rows": int(cleanup.get("deleted_event_count") or 0),
            "reason": "failed upload retry preparation",
        },
    )
    return FailedUploadCleanupResponse(
        deleted=True,
        task_id=task_id,
        deleted_event_ids=[str(value) for value in cleanup.get("deleted_event_ids", [])],
        deleted_event_count=int(cleanup.get("deleted_event_count") or 0),
        deleted_artifact_count=int(cleanup.get("deleted_artifact_count") or 0),
        skipped_artifact_paths=[
            str(path) for path in cleanup.get("skipped_artifact_paths", [])
        ],
    )


@router.get("/folder/events/{task_id}")
async def stream_upload_folder_events(
    task_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
) -> StreamingResponse:
    """Stream creator-scoped upload task updates as SSE."""
    db.delete_expired_upload_tasks()
    db.reconcile_stale_upload_tasks()

    task = db.get_upload_task(task_id, created_by_user_id=current_user["id"])
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id",
        )

    async def event_stream() -> object:
        last_updated = None
        while True:
            db.reconcile_stale_upload_tasks()
            current = db.get_upload_task(task_id, created_by_user_id=current_user["id"])
            if current is None:
                payload = UploadTaskEvent(
                    task_id=task_id,
                    status="failed",
                    phase="failed",
                    error="Task expired or no longer available",
                )
                yield f"event: error\ndata: {payload.model_dump_json()}\n\n"
                break

            updated_at = current.get("updated_at")
            if updated_at != last_updated:
                last_updated = updated_at
                payload = _build_upload_task_event(task_id, current)
                event_name = (
                    "complete"
                    if payload.status in {"completed", "cancelled"}
                    else "error"
                    if payload.status == "failed"
                    else "progress"
                )
                yield f"event: {event_name}\ndata: {payload.model_dump_json()}\n\n"
                if payload.status in {"completed", "failed", "cancelled"}:
                    audit_log.info(
                        "ingestion finished",
                        extra={
                            "event": (
                                "ingest_completed"
                                if payload.status in {"completed", "cancelled"}
                                else "ingest_failed"
                            ),
                            "request_id": task_id,
                            "user_id": current_user["id"],
                            "rows": payload.completed_events,
                            "reason": payload.error,
                        },
                    )
                    break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/datasets", response_model=DatasetListResponse)
async def list_datasets(
    upload_query_service: UploadQueryServiceDep,
    _: CurrentUserDep,
) -> DatasetListResponse:
    """
    List every non-deleted uploaded dataset.

    Returns all events in one payload along with ``facets`` (distinct values
    per filterable column) and ``program_versions`` (summary per program/version
    pair). The Database page consumes this response directly; filtering and
    sorting happen client-side.
    """
    result = upload_query_service.list_datasets()
    datasets = [DatasetInfo(**item) for item in result["items"]]
    program_versions = [
        ProgramVersionSummary(**group)
        for group in result.get("program_versions", [])
    ]

    return DatasetListResponse(
        items=datasets,
        total=result["total"],
        facets=result["facets"],
        program_versions=program_versions,
    )


@router.delete("/events/{event_id}", response_model=DeleteEventResponse)
async def delete_event(
    event_id: str,
    db: DatabaseDep,
    current_user: CurrentUserDep,
    query_service: QueryServiceDep,
) -> DeleteEventResponse:
    """
    Soft-delete a single event.

    The event is marked as deleted but data is retained until vacuum/purge.
    """
    event = db.get_event(event_id)
    if not event or event.get("is_deleted"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found or already deleted",
        )
    if current_user["role"] != "admin" and event.get("uploaded_by_user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own uploads",
        )
    success = db.soft_delete_event(event_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found or already deleted",
        )

    # Deletes change which program_ids/versions exist; invalidate the same
    # cache groups that metadata writes invalidate so the Edit Metadata
    # dropdown and /dashboard/program-ids | /versions stop serving the
    # just-deleted version.
    query_service.invalidate_event_caches()

    return DeleteEventResponse(deleted=True, event_id=event_id)


@router.post("/events/delete", response_model=DeleteEventsResponse)
async def delete_events(
    request: DeleteEventsRequest,
    db: DatabaseDep,
    current_user: CurrentUserDep,
    query_service: QueryServiceDep,
) -> DeleteEventsResponse:
    """
    Bulk soft-delete multiple events.

    Uses POST instead of DELETE to support request body.
    The events are marked as deleted but data is retained until vacuum/purge.
    """
    if current_user["role"] == "admin":
        target_ids = request.event_ids
    else:
        target_ids = []
        for event_id in request.event_ids:
            event = db.get_event(event_id)
            if event and not event.get("is_deleted") and event.get("uploaded_by_user_id") == current_user["id"]:
                target_ids.append(event_id)

    deleted_count = db.soft_delete_events(target_ids)

    if deleted_count > 0:
        query_service.invalidate_event_caches()

    return DeleteEventsResponse(
        deleted_count=deleted_count,
        event_ids=target_ids,
    )


@router.post(
    "/program-version/delete",
    response_model=DeleteProgramVersionScopeResponse,
)
async def delete_program_version_scope(
    request: DeleteProgramVersionScopeRequest,
    db: DatabaseDep,
    current_user: WriteUserDep,
    query_service: QueryServiceDep,
) -> DeleteProgramVersionScopeResponse:
    """Hard-delete a program or program/version scope, including retained artifacts."""
    preview = db.preview_program_version_scope_delete(request.program_id, request.version)
    if preview["event_count"] == 0 and preview["artifact_count"] == 0 and preview["channel_map_rows"] == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program/version scope not found",
        )

    if not has_scope_delete_uploaded_data_policy(
        store=db,
        program_id=request.program_id,
        version=request.version,
        user_id=current_user["id"],
        role=current_user["role"],
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=SCOPE_DELETE_FORBIDDEN_DETAIL,
        )

    result = db.hard_delete_program_version_scope(request.program_id, request.version)
    query_service.invalidate_event_caches()
    audit_log.info(
        "program/version scope deleted",
        extra={
            "event": "program_version_scope_deleted",
            "user_id": current_user["id"],
            "rows": result.get("event_count", 0),
            "reason": f"program={request.program_id} version={request.version or '*'}",
        },
    )
    return DeleteProgramVersionScopeResponse(
        deleted=True,
        program_id=request.program_id,
        version=request.version,
        event_count=int(result.get("event_count") or 0),
        raw_rows=int(result.get("raw_rows") or 0),
        lttb_rows=int(result.get("lttb_rows") or 0),
        event_custom_field_rows=int(result.get("event_custom_field_rows") or 0),
        artifact_count=int(result.get("artifact_count") or 0),
        channel_map_rows=int(result.get("channel_map_rows") or 0),
        deleted_files=int(result.get("deleted_files") or 0),
        skipped_files=[str(path) for path in result.get("skipped_files", [])],
        owner_user_ids=[str(owner) for owner in result.get("owner_user_ids", [])],
    )


@router.post("/events/purge-deleted", response_model=PurgeDeletedEventsResponse)
async def purge_deleted_events(
    request: PurgeDeletedEventsRequest,
    db: DatabaseDep,
    _: WriteUserDep,
    query_service: QueryServiceDep,
) -> PurgeDeletedEventsResponse:
    """Hard-delete soft-deleted events and related measurements."""
    result = db.purge_deleted_events(request.event_ids)
    if result.get("purged_events", 0) > 0:
        query_service.invalidate_event_caches()
    return PurgeDeletedEventsResponse(**result)

