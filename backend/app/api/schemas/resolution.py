"""Schemas for resolution intake API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.api.schemas.decomposition import PlanPayload, DraftTaskPayload, WeekPlanSection
from app.api.schemas.approval import ApprovedTaskPayload


class ResolutionCreateRequest(BaseModel):
    user_id: UUID
    text: str = Field(..., min_length=5, max_length=300)
    duration_weeks: Optional[int] = Field(default=None, ge=1, le=52)

    @field_validator("text")
    @classmethod
    def trim_and_validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 5 or len(cleaned) > 300:
            raise ValueError("text must be between 5 and 300 characters after trimming")
        return cleaned


class ResolutionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    raw_text: str
    type: Literal["habit", "project", "learning", "health", "finance", "other"]
    duration_weeks: Optional[int]
    status: Literal["draft"]
    request_id: str


class ResolutionSummary(BaseModel):
    id: UUID
    title: str
    type: str
    status: str
    duration_weeks: Optional[int]
    updated_at: datetime


class ResolutionDetailResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    type: str
    status: str
    duration_weeks: Optional[int]
    plan: Optional[PlanPayload] = None
    plan_weeks: List[WeekPlanSection] = Field(default_factory=list)
    draft_tasks: List[DraftTaskPayload] = Field(default_factory=list)
    active_tasks: List[ApprovedTaskPayload] = Field(default_factory=list)
    request_id: str
