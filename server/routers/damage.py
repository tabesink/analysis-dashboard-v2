"""Damage inspection endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from server.dependencies import (
    DamageCalculationTaskServiceDep,
    QueryServiceDep,
    WriteUserDep,
    get_current_user,
)
from server.models.damage import (
    DamageCalculateRequest,
    DamageCalculateResponse,
    DamageInspectRequest,
    DamageInspectResponse,
)
from server.services.damage_inspect import build_damage_inspect_response
from server.services.operation_admission import OperationAdmissionError
from server.services.dashboard_orchestration import require_uploaded_data_edit_permission
from server.services.post_upload_precompute import (
    decide_after_inspect_damage_access,
    inspect_precompute_decision_to_response,
)


router = APIRouter(prefix="/damage", dependencies=[Depends(get_current_user)])


@router.post("/inspect", response_model=DamageInspectResponse)
async def inspect_damage(
    request: DamageInspectRequest,
    query_service: QueryServiceDep,
) -> DamageInspectResponse:
    return build_damage_inspect_response(
        query_service.db,
        query_service,
        event_ids=request.event_ids,
        include_all_calculated=request.include_all_calculated,
    )


@router.post("/backfill", response_model=DamageCalculateResponse)
async def backfill_missing_damage(
    request: DamageCalculateRequest,
    damage_service: DamageCalculationTaskServiceDep,
    user: WriteUserDep,
) -> DamageCalculateResponse:
    try:
        require_uploaded_data_edit_permission(
            store=damage_service.db,
            program_id=request.program_id,
            version=request.version,
            user_id=user["id"],
            role=user["role"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    try:
        decision = decide_after_inspect_damage_access(
            damage_service.db,
            program_id=request.program_id,
            version=request.version,
            user_id=user["id"],
            damage_service=damage_service,
        )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc
    payload = inspect_precompute_decision_to_response(decision)
    if "damage_prerequisite_report" in payload:
        from server.models.damage import DamageFailureReport

        return DamageCalculateResponse(
            damage_prerequisite_report=DamageFailureReport(
                **payload["damage_prerequisite_report"],
            ),
        )
    return DamageCalculateResponse(
        damage_task_id=payload.get("damage_task_id"),
        task_kind=payload.get("task_kind"),
        reused_existing_task=payload.get("reused_existing_task"),
    )


@router.post("/calculate", response_model=DamageCalculateResponse)
async def start_damage_calculation(
    request: DamageCalculateRequest,
    damage_service: DamageCalculationTaskServiceDep,
    user: WriteUserDep,
) -> DamageCalculateResponse:
    try:
        require_uploaded_data_edit_permission(
            store=damage_service.db,
            program_id=request.program_id,
            version=request.version,
            user_id=user["id"],
            role=user["role"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    active_schedule = damage_service.db.get_active_durability_schedule(
        request.program_id,
        request.version,
    )
    if active_schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active durability schedule is attached for this program/version",
        )

    try:
        result = damage_service.maybe_start_after_schedule_change(
            program_id=request.program_id,
            version=request.version,
            user_id=user["id"],
            active_schedule=active_schedule,
        )
    except OperationAdmissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.to_http_detail(),
        ) from exc
    if "damage_prerequisite_report" in result:
        from server.models.damage import DamageFailureReport

        return DamageCalculateResponse(
            damage_prerequisite_report=DamageFailureReport(
                **result["damage_prerequisite_report"],
            ),
        )
    return DamageCalculateResponse(
        damage_task_id=result["task_id"],
        task_kind=result["task_kind"],
        reused_existing_task=result.get("reused_existing_task"),
    )
