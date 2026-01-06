"""Schemas for weekly plan preview."""
from __future__ import annotations

from datetime import date
from typing import List, Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field

class WeekWindowPayload(BaseModel):
    start: date
    end: date


class WeeklyPlanInputs(BaseModel):
    active_resolutions: int
    active_tasks_total: int
    active_tasks_completed: int
    completion_rate: float


class SuggestedTaskPayload(BaseModel):
    title: str
    duration_min: Optional[int] = None
    suggested_time: Optional[Literal["morning", "afternoon", "evening"]] = None


class MicroResolutionPayload(BaseModel):
    title: str
    why_this: str
    suggested_week_1_tasks: List[SuggestedTaskPayload]


class WeeklyPlanPreviewResponse(BaseModel):
    user_id: UUID
    week: WeekWindowPayload
    inputs: WeeklyPlanInputs
    micro_resolution: MicroResolutionPayload
    request_id: str


class WeeklyPlanResponse(WeeklyPlanPreviewResponse):
    pass


class WeeklyPlanRunRequest(BaseModel):
    user_id: UUID
    force: bool = False


class WeeklyPlanHistoryItem(BaseModel):
    id: UUID
    created_at: str
    week_start: str
    week_end: str
    title: str
    completion_rate: Optional[float] = None


class WeeklyPlanHistoryResponse(BaseModel):
    user_id: UUID
    items: List[WeeklyPlanHistoryItem]
    next_cursor: Optional[str]
    request_id: str


class WeeklyPlanHistoryDetailResponse(BaseModel):
    id: UUID
    user_id: UUID
    created_at: str
    week_start: str
    week_end: str
    snapshot: WeeklyPlanResponse
    request_id: str
