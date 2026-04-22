from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
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


class MergeAnonymousRequest(BaseModel):
    anonymous_user_id: UUID


class MergeAnonymousResponse(BaseModel):
    merged: bool
    message: str


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


class CoachingPreferencesState(BaseModel):
    coaching_paused: bool
    task_reminders_enabled: bool
    interventions_enabled: bool
    timezone: str | None = None
    updated_at: datetime | None = None
    home_segment_index: int = Field(
        0,
        ge=0,
        le=1,
        description="Home segmented control: 0=Personal, 1=Work",
    )
    # additive v1+: work-hours / personal-slots
    work_hours_start: str | None = Field(None, description="HH:MM local time when work begins, e.g. 09:00")
    work_hours_end: str | None = Field(None, description="HH:MM local time when work ends, e.g. 17:00")
    work_days: list[int] | None = Field(
        None,
        description="ISO weekday numbers (1=Monday … 7=Sunday) the user works, e.g. [1,2,3,4,5]",
    )
    personal_slots: dict[str, str] | None = Field(
        None,
        description="Free-form map of personal activity category to time-of-day slot: morning | afternoon | evening",
    )

    model_config = {"from_attributes": True}


class CoachingPreferencesPatchRequest(BaseModel):
    coaching_paused: bool | None = None
    task_reminders_enabled: bool | None = None
    interventions_enabled: bool | None = None
    timezone: str | None = Field(None, max_length=64)
    home_segment_index: int | None = Field(None, ge=0, le=1)
    # additive v1+
    work_hours_start: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    work_hours_end: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    work_days: list[int] | None = Field(None, description="ISO weekday numbers 1-7")
    personal_slots: dict[str, str] | None = Field(None)


class BrainDumpRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class BrainDumpResponse(BaseModel):
    id: UUID
    actionable: bool
    signals: dict[str, Any]


class BrainDumpListItem(BaseModel):
    id: UUID
    created_at: datetime
    excerpt: str
    actionable: bool


class BrainDumpListPage(BaseModel):
    items: list[BrainDumpListItem]
    next_cursor: str | None = None


class BrainDumpDetailResponse(BaseModel):
    id: UUID
    body: str
    actionable: bool
    signals: dict[str, Any]
    created_at: datetime


class Resolution(BaseModel):
    id: UUID
    title: str
    detail: str | None = None
    status: str
    week_1_plan_status: str
    plan_metadata_json: dict[str, Any] | None = None
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


class Week1PreviewTask(BaseModel):
    title: str
    sort_order: int


class Week1PreviewResponse(BaseModel):
    planner_version: str
    source: str
    tasks: list[Week1PreviewTask]
    snapshot_id: UUID


class PlanSnapshotItem(BaseModel):
    id: UUID
    kind: str
    planner_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanSnapshotDetail(BaseModel):
    id: UUID
    kind: str
    planner_version: str
    tasks: list[Week1PreviewTask]
    created_at: datetime


class PlanHistoryResponse(BaseModel):
    items: list[PlanSnapshotItem]


class DashboardResolutionSummary(BaseModel):
    id: UUID
    title: str
    week_1_plan_status: str
    open_tasks: int
    completed_tasks: int
    skipped_tasks: int = 0


class DashboardResponse(BaseModel):
    resolution: DashboardResolutionSummary | None
    pending_intervention: bool


class JourneyTaskItem(BaseModel):
    id: UUID
    title: str
    status: str
    due_window_ends_at: datetime | None = None


class DailyJourneyResponse(BaseModel):
    date: datetime
    tasks: list[JourneyTaskItem]


class NotificationsConfigResponse(BaseModel):
    enabled: bool
    provider: str


class OpsJobsConfigResponse(BaseModel):
    scheduler_enabled: bool
    timezone: str
    jobs: list[dict[str, str]]


class OpsJobRunRequest(BaseModel):
    job: Literal["reminders", "week1_recover"]
    resolution_id: UUID | None = None


class OpsJobRunResponse(BaseModel):
    job: str
    processed: int
    detail: str | None = None


class Task(BaseModel):
    id: UUID
    resolution_id: UUID
    title: str
    status: str
    sort_order: int
    due_window_starts_at: datetime | None = None
    due_window_ends_at: datetime | None = None
    metadata_json: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    resolution_id: UUID | None = None
    note: str | None = Field(None, max_length=500)
    sort_order: int | None = Field(None, ge=0, le=100_000)


class TaskPatchRequest(BaseModel):
    title: str | None = Field(None, max_length=500)
    note: str | None = Field(None, max_length=500)
    status: Literal["open", "completed", "skipped"] | None = None
    sort_order: int | None = Field(None, ge=0, le=100_000)


class TaskListResponse(BaseModel):
    tasks: list[Task]


class Intervention(BaseModel):
    id: UUID
    status: str
    summary: str
    detail_json: dict[str, Any] | None = None
    created_at: datetime | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}


class FocusSessionCreateRequest(BaseModel):
    task_id: UUID
    planned_seconds: int | None = Field(None, ge=1, le=86400)


class FocusSessionPatchRequest(BaseModel):
    ended_at: datetime | None = Field(
        default=None,
        description="Session end time; if omitted the server uses current UTC time",
    )


class FocusSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    task_id: UUID | None
    started_at: datetime
    ended_at: datetime | None
    planned_seconds: int | None

    model_config = {"from_attributes": True}


class FocusSessionListResponse(BaseModel):
    items: list[FocusSessionResponse]


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
