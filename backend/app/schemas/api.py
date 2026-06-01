from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

OwnerType = Literal["user", "team"]
GoalStatus = Literal["active", "completed", "archived"]
TaskStatus = Literal["open", "completed", "cancelled"]
TaskPriority = Literal["low", "normal", "high"]
ProposalStatus = Literal["pending", "applied", "dismissed"]


class Error(BaseModel):
    code: str
    message: str
    request_id: str
    details: dict[str, Any] | None = None


class AuthMethod(BaseModel):
    provider: Literal["password", "google"]
    verified_at: datetime | None = None


class UserProfile(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str | None = None
    profile_image_url: str | None = None
    profile_source: str | None = None
    email_verified_at: datetime | None = None
    auth_methods: list[AuthMethod] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ProfilePatchRequest(BaseModel):
    display_name: str | None = Field(None, max_length=160)
    profile_image_url: str | None = Field(None, max_length=2048)


class AuthPasswordRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    display_name: str | None = Field(None, max_length=160)


class AuthPasswordRegisterResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    verification_required: bool = True
    verification_code: str | None = Field(
        None,
        description="Returned in local/test email mode so clients and tests can complete verification.",
    )


class AuthPasswordVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=32)


class AuthPasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthGoogleRequest(BaseModel):
    id_token: str = Field(min_length=1)


class AuthRefreshRequest(BaseModel):
    refresh_token: str


class AuthLogoutRequest(BaseModel):
    revoke_all: bool = True


class AuthTokenResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    user: UserProfile


class CoachingPreferencesState(BaseModel):
    coaching_paused: bool
    task_reminders_enabled: bool
    interventions_enabled: bool
    timezone: str | None = None
    updated_at: datetime | None = None
    home_segment_index: int = Field(0, ge=0, le=1)
    work_hours_start: str | None = None
    work_hours_end: str | None = None
    work_days: list[int] | None = None
    personal_slots: dict[str, str] | None = None

    model_config = {"from_attributes": True}


class CoachingPreferencesPatchRequest(BaseModel):
    coaching_paused: bool | None = None
    task_reminders_enabled: bool | None = None
    interventions_enabled: bool | None = None
    timezone: str | None = Field(None, max_length=64)
    home_segment_index: int | None = Field(None, ge=0, le=1)
    work_hours_start: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    work_hours_end: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    work_days: list[int] | None = None
    personal_slots: dict[str, str] | None = None


class Goal(BaseModel):
    id: UUID
    owner_type: OwnerType
    user_id: UUID | None = None
    team_id: UUID | None = None
    created_by_user_id: UUID
    title: str
    description: str | None = None
    status: GoalStatus
    target_at: datetime | None = None
    progress_summary: str | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class GoalCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str | None = Field(None, max_length=12000)
    team_id: UUID | None = None
    target_at: datetime | None = None
    metadata_json: dict[str, Any] | None = None


class GoalPatchRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=240)
    description: str | None = Field(None, max_length=12000)
    status: GoalStatus | None = None
    target_at: datetime | None = None
    progress_summary: str | None = Field(None, max_length=4000)
    metadata_json: dict[str, Any] | None = None


class GoalListResponse(BaseModel):
    goals: list[Goal]


class Task(BaseModel):
    id: UUID
    owner_type: OwnerType
    user_id: UUID | None = None
    team_id: UUID | None = None
    goal_id: UUID | None = None
    created_by_user_id: UUID
    assignee_user_id: UUID | None = None
    completed_by_user_id: UUID | None = None
    title: str
    notes: str | None = None
    status: TaskStatus
    priority: TaskPriority
    sort_order: int
    due_at: datetime | None = None
    due_window_starts_at: datetime | None = None
    due_window_ends_at: datetime | None = None
    completed_at: datetime | None = None
    source: str
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(None, max_length=12000)
    goal_id: UUID | None = None
    team_id: UUID | None = None
    assignee_user_id: UUID | None = None
    priority: TaskPriority = "normal"
    due_at: datetime | None = None
    due_window_starts_at: datetime | None = None
    due_window_ends_at: datetime | None = None
    sort_order: int | None = Field(None, ge=0, le=100_000)
    metadata_json: dict[str, Any] | None = None


class TaskPatchRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    notes: str | None = Field(None, max_length=12000)
    goal_id: UUID | None = None
    assignee_user_id: UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_at: datetime | None = None
    due_window_starts_at: datetime | None = None
    due_window_ends_at: datetime | None = None
    sort_order: int | None = Field(None, ge=0, le=100_000)
    metadata_json: dict[str, Any] | None = None


class TaskListResponse(BaseModel):
    tasks: list[Task]


class Team(BaseModel):
    id: UUID
    name: str
    invite_code: str
    created_by_user_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamSummary(BaseModel):
    id: UUID
    name: str
    role: Literal["admin", "member"]
    member_count: int


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TeamCreateResponse(BaseModel):
    team: Team
    invite_code: str


class TeamMemberOut(BaseModel):
    user_id: UUID
    email: str
    display_name: str | None = None
    profile_image_url: str | None = None
    role: Literal["admin", "member"]
    joined_at: datetime


class TeamDetailResponse(BaseModel):
    team: Team
    members: list[TeamMemberOut]


class TeamJoinRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=12)


class TeamListResponse(BaseModel):
    teams: list[TeamSummary]


class FocusSessionStartRequest(BaseModel):
    task_id: UUID | None = None


class FocusSessionEndRequest(BaseModel):
    ended_at: datetime | None = None


class FocusSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    task_id: UUID | None = None
    started_at: datetime
    ended_at: datetime | None = None
    elapsed_seconds: int
    context_snapshot_json: dict[str, Any] | None = None


class FocusSessionSummary(BaseModel):
    id: UUID
    task_id: UUID | None = None
    task_title: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    elapsed_seconds: int


class FocusSessionListPage(BaseModel):
    items: list[FocusSessionSummary]
    next_cursor: str | None = None


class BrainDumpCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    focus_session_id: UUID | None = None
    task_id: UUID | None = None
    goal_id: UUID | None = None
    team_id: UUID | None = None


class BrainDumpProposal(BaseModel):
    id: UUID
    change_type: str
    target_type: str
    target_id: UUID | None = None
    payload: dict[str, Any]
    rationale: str | None = None
    confidence: float | None = None
    status: ProposalStatus
    created_at: datetime
    applied_at: datetime | None = None


class BrainDumpResponse(BaseModel):
    id: UUID
    body: str
    processing_status: Literal["pending", "processed", "failed"]
    actionable: bool
    focus_session_id: UUID | None = None
    active_task_id: UUID | None = None
    active_goal_id: UUID | None = None
    team_id: UUID | None = None
    context_snapshot: dict[str, Any] | None = None
    ai_result: dict[str, Any] | None = None
    proposals: list[BrainDumpProposal] = Field(default_factory=list)
    created_at: datetime
    processed_at: datetime | None = None


class BrainDumpListItem(BaseModel):
    id: UUID
    created_at: datetime
    excerpt: str
    actionable: bool
    processing_status: str


class BrainDumpListPage(BaseModel):
    items: list[BrainDumpListItem]
    next_cursor: str | None = None


class BrainDumpApplyRequest(BaseModel):
    proposal_ids: list[UUID] = Field(default_factory=list)


class BrainDumpApplyResponse(BaseModel):
    applied_proposal_ids: list[UUID]
    created_goal_ids: list[UUID] = Field(default_factory=list)
    updated_goal_ids: list[UUID] = Field(default_factory=list)
    created_task_ids: list[UUID] = Field(default_factory=list)
    updated_task_ids: list[UUID] = Field(default_factory=list)


class CompanionNotification(BaseModel):
    id: UUID
    kind: str
    title: str
    body: str | None = None
    status: str
    team_id: UUID | None = None
    goal_id: UUID | None = None
    task_id: UUID | None = None
    payload_json: dict[str, Any] | None = None
    created_at: datetime
    sent_at: datetime | None = None
    read_at: datetime | None = None

    model_config = {"from_attributes": True}


class CompanionNotificationListResponse(BaseModel):
    notifications: list[CompanionNotification]


class Intervention(BaseModel):
    id: UUID
    severity: str
    reason: str
    status: str
    summary: str
    suggested_action: str | None = None
    team_id: UUID | None = None
    goal_id: UUID | None = None
    task_id: UUID | None = None
    detail_json: dict[str, Any] | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}


class InterventionListResponse(BaseModel):
    interventions: list[Intervention]


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


class NotificationsConfigResponse(BaseModel):
    enabled: bool
    provider: str
