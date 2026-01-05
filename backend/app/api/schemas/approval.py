"""Schemas for resolution approval endpoint."""
from __future__ import annotations

from datetime import date, time
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TaskEdit(BaseModel):
    task_id: UUID
    title: Optional[str] = None
    scheduled_day: Optional[date] = None
    scheduled_time: Optional[time] = None
    duration_min: Optional[int] = Field(default=None, ge=1)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be blank when provided")
        return cleaned


class ApprovalRequest(BaseModel):
    user_id: UUID
    decision: Literal["accept", "reject", "regenerate"]
    task_edits: List[TaskEdit] = Field(default_factory=list)


class ApprovedTaskPayload(BaseModel):
    id: UUID
    title: str
    scheduled_day: Optional[date] = None
    scheduled_time: Optional[time] = None
    duration_min: Optional[int] = None
    draft: bool = False


class ApprovalResponse(BaseModel):
    resolution_id: UUID
    status: str
    tasks_activated: List[ApprovedTaskPayload] = Field(default_factory=list)
    message: Optional[str] = None
    request_id: str
