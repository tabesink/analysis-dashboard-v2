"""Pydantic models for damage inspection."""

from typing import Literal

from pydantic import BaseModel, Field

DamageFailureField = Literal[
    "repeats",
    "weight",
    "rspEventName",
    "schedulePattern",
    "event_id",
    "channel",
]


class DamageFailureIssue(BaseModel):
    """One repairable issue in a schedule damage validation or prerequisite report."""

    event_id: str | None = None
    event_name: str | None = None
    field: DamageFailureField
    code: str
    message: str


class DamageFailureReport(BaseModel):
    """Compact failure or prerequisite report for schedule-driven damage."""

    summary: str
    issues: list[DamageFailureIssue]


class DamageInspectRequest(BaseModel):
    event_ids: list[str] = Field(default_factory=list)
    include_all_calculated: bool = False


class DamageChannelMetadata(BaseModel):
    channel_key: str
    channel_name: str
    unit: str | None = None


class DamageCell(BaseModel):
    damage: float | None
    base_damage: float | None = None
    status: str
    error: str | None = None
    stale_reason: str | None = None


class DamageInspectRow(BaseModel):
    event_id: str
    job_number: str | None = None
    work_order: str | None = None
    program_id: str
    damages: dict[str, DamageCell]


class DamageInspectScopeState(BaseModel):
    program_id: str
    version: str
    has_current_results: bool = False
    has_stale_results: bool = False
    needs_damage_repair: bool = False
    has_active_schedule: bool = False
    can_start_calculation: bool = False
    prerequisite_report: DamageFailureReport | None = None
    failure_report: DamageFailureReport | None = None
    active_damage_task_id: str | None = None


class DamageCalculateRequest(BaseModel):
    program_id: str
    version: str


class DamageCalculateResponse(BaseModel):
    damage_task_id: str | None = None
    task_kind: Literal["damage_calculation"] | None = None
    reused_existing_task: bool | None = None
    damage_prerequisite_report: DamageFailureReport | None = None


class DamageInspectResponse(BaseModel):
    channels: list[DamageChannelMetadata]
    rows: list[DamageInspectRow]
    has_stale_values: bool = False
    scopes: list[DamageInspectScopeState] = Field(default_factory=list)
