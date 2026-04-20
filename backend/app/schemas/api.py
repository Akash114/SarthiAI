from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class Error(BaseModel):
    code: str
    message: str
    request_id: str
    details: dict[str, Any] | None = None


class User(BaseModel):
    id: UUID
    email: EmailStr

    model_config = {"from_attributes": True}


class AuthRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthRefreshRequest(BaseModel):
    refresh_token: str


class AuthLogoutRequest(BaseModel):
    revoke_all: bool = False


class AuthTokenResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime


class OnboardingState(BaseModel):
    status: str
    step: str
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class OnboardingPatchRequest(BaseModel):
    step: str | None = None
    mark_completed: bool = False


class Resolution(BaseModel):
    id: UUID
    title: str
    detail: str | None = None
    status: str
    week_1_plan_status: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResolutionCreateRequest(BaseModel):
    title: str = Field(max_length=200)
    detail: str | None = Field(None, max_length=8000)


class ResolutionPatchRequest(BaseModel):
    title: str | None = Field(None, max_length=200)
    detail: str | None = Field(None, max_length=8000)
    status: str | None = None


class ResolutionCurrentResponse(BaseModel):
    resolution: Resolution | None


class GenerateWeek1Response(BaseModel):
    week_1_plan_status: str
    job_id: str | None = None


class Task(BaseModel):
    id: UUID
    resolution_id: UUID
    title: str
    status: str
    sort_order: int
    due_window_starts_at: datetime | None = None
    due_window_ends_at: datetime | None = None

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    tasks: list[Task]


class Intervention(BaseModel):
    id: UUID
    status: str
    summary: str
    created_at: datetime | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}


class InterventionCurrentResponse(BaseModel):
    intervention: Intervention | None


class TransparencyEntry(BaseModel):
    id: UUID
    action_type: str
    headline: str
    detail: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransparencyLogPage(BaseModel):
    items: list[TransparencyEntry]
    next_cursor: str | None = None


class PushTokenRegisterRequest(BaseModel):
    expo_push_token: str
    platform: str
    device_id: str | None = Field(None, max_length=128)
