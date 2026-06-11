"""Pydantic models for derived-data async tasks."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


DerivedTaskKind = Literal["channel_reprocess", "damage_calculation"]


class DerivedTaskStartResponse(BaseModel):
    """Response for starting a derived-data background task."""

    task_id: str
    task_kind: DerivedTaskKind
    reused_existing_task: bool = False


class DerivedTaskStatusEvent(BaseModel):
    """Lean polling payload for derived-data task progress."""

    task_id: str
    task_kind: DerivedTaskKind
    status: str = Field(description="queued, running, completed, or failed")
    phase: str
    sub_phase: str | None = None
    progress_message: str | None = None
    completed_events: int = 0
    total_events: int = 0
    current_event: str | None = None
    error: str | None = None
    result: dict[str, Any] | None = None
