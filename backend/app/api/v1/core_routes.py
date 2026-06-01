from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.cursor_pagination import decode_cursor, encode_cursor
from app.api.v1.deps import _rid, current_user_id
from app.config import get_settings
from app.db import get_db
from app.services.notifications.expo import send_expo_push_batch
from app.models.companion_notification import CompanionNotification as NotificationORM
from app.models.device_push import DevicePushToken
from app.models.goal import Goal as GoalORM
from app.models.intervention import Intervention as InterventionORM
from app.models.task import Task as TaskORM
from app.models.team_member import TeamMember as TeamMemberORM
from app.models.transparency import TransparencyEntry as TransparencyORM
from app.schemas.api import (
    CompanionNotification,
    CompanionNotificationListResponse,
    Goal,
    GoalCreateRequest,
    GoalListResponse,
    GoalPatchRequest,
    Intervention,
    InterventionListResponse,
    PushTokenRegisterRequest,
    Task,
    TaskCreateRequest,
    TaskListResponse,
    TaskPatchRequest,
    TransparencyEntry,
    TransparencyLogPage,
)

router = APIRouter(tags=["goals", "tasks", "notifications", "interventions", "transparency", "devices"])


def _ensure_team_member(db: Session, team_id: UUID, user_id: UUID, rid: str) -> TeamMemberORM:
    member = db.get(TeamMemberORM, {"team_id": team_id, "user_id": user_id})
    if member is None:
        raise ApiError(403, code="forbidden", message="Not a team member", request_id=rid)
    return member


def _goal_out(goal: GoalORM) -> Goal:
    return Goal(
        id=goal.id,
        owner_type="team" if goal.team_id else "user",
        user_id=goal.user_id,
        team_id=goal.team_id,
        created_by_user_id=goal.created_by_user_id,
        title=goal.title,
        description=goal.description,
        status=goal.status,
        target_at=goal.target_at,
        progress_summary=goal.progress_summary,
        metadata_json=goal.metadata_json,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        completed_at=goal.completed_at,
    )


def _task_out(task: TaskORM) -> Task:
    return Task(
        id=task.id,
        owner_type="team" if task.team_id else "user",
        user_id=task.user_id,
        team_id=task.team_id,
        goal_id=task.goal_id,
        created_by_user_id=task.created_by_user_id,
        assignee_user_id=task.assignee_user_id,
        completed_by_user_id=task.completed_by_user_id,
        title=task.title,
        notes=task.notes,
        status=task.status,
        priority=task.priority,
        sort_order=task.sort_order,
        due_at=task.due_at,
        due_window_starts_at=task.due_window_starts_at,
        due_window_ends_at=task.due_window_ends_at,
        completed_at=task.completed_at,
        source=task.source,
        metadata_json=task.metadata_json,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _get_goal_for_user(db: Session, goal_id: UUID, user_id: UUID, rid: str) -> GoalORM:
    goal = db.get(GoalORM, goal_id)
    if goal is None:
        raise ApiError(404, code="not_found", message="Goal not found", request_id=rid)
    if goal.user_id == user_id:
        return goal
    if goal.team_id is not None:
        _ensure_team_member(db, goal.team_id, user_id, rid)
        return goal
    raise ApiError(404, code="not_found", message="Goal not found", request_id=rid)


def _get_task_for_user(db: Session, task_id: UUID, user_id: UUID, rid: str) -> TaskORM:
    task = db.get(TaskORM, task_id)
    if task is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    if task.user_id == user_id:
        return task
    if task.team_id is not None:
        _ensure_team_member(db, task.team_id, user_id, rid)
        return task
    raise ApiError(404, code="not_found", message="Task not found", request_id=rid)


def _validate_goal_scope(db: Session, goal: GoalORM, user_id: UUID, team_id: UUID | None, rid: str) -> None:
    if team_id is None:
        if goal.user_id != user_id:
            raise ApiError(400, code="validation", message="Goal does not belong to this user", request_id=rid)
    else:
        if goal.team_id != team_id:
            raise ApiError(400, code="validation", message="Goal does not belong to this team", request_id=rid)
        _ensure_team_member(db, team_id, user_id, rid)


def _validate_assignee(db: Session, team_id: UUID | None, assignee_user_id: UUID | None, rid: str) -> None:
    if team_id is None or assignee_user_id is None:
        return
    _ensure_team_member(db, team_id, assignee_user_id, rid)


@router.post("/goals", response_model=Goal, status_code=201)
def create_goal(
    request: Request,
    body: GoalCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Goal:
    rid = _rid(request)
    title = body.title.strip()
    if body.team_id is not None:
        _ensure_team_member(db, body.team_id, user_id, rid)
    goal = GoalORM(
        user_id=None if body.team_id else user_id,
        team_id=body.team_id,
        created_by_user_id=user_id,
        title=title,
        description=body.description,
        status="active",
        target_at=body.target_at,
        metadata_json=body.metadata_json,
    )
    db.add(goal)
    db.flush()
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="goal_created",
            headline="Goal created",
            detail=title[:500],
        )
    )
    db.commit()
    db.refresh(goal)
    return _goal_out(goal)


@router.get("/goals", response_model=GoalListResponse)
def list_goals(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    team_id: UUID | None = None,
    status: str = "active",
) -> GoalListResponse:
    rid = _rid(request)
    if team_id is not None:
        _ensure_team_member(db, team_id, user_id, rid)
        query = select(GoalORM).where(GoalORM.team_id == team_id)
    else:
        query = select(GoalORM).where(GoalORM.user_id == user_id)
    if status != "all":
        query = query.where(GoalORM.status == status)
    goals = db.scalars(query.order_by(GoalORM.created_at.desc())).all()
    return GoalListResponse(goals=[_goal_out(goal) for goal in goals])


@router.get("/goals/{goal_id}", response_model=Goal)
def get_goal(
    request: Request,
    goal_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Goal:
    return _goal_out(_get_goal_for_user(db, goal_id, user_id, _rid(request)))


@router.patch("/goals/{goal_id}", response_model=Goal)
def patch_goal(
    request: Request,
    goal_id: UUID,
    body: GoalPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Goal:
    goal = _get_goal_for_user(db, goal_id, user_id, _rid(request))
    if body.title is not None:
        goal.title = body.title.strip()
    if body.description is not None:
        goal.description = body.description
    if body.target_at is not None:
        goal.target_at = body.target_at
    if body.progress_summary is not None:
        goal.progress_summary = body.progress_summary
    if body.metadata_json is not None:
        goal.metadata_json = body.metadata_json
    if body.status is not None:
        goal.status = body.status
        if body.status == "completed" and goal.completed_at is None:
            goal.completed_at = datetime.now(UTC)
    goal.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(goal)
    return _goal_out(goal)


@router.post("/goals/{goal_id}/complete", response_model=Goal)
def complete_goal(
    request: Request,
    goal_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Goal:
    goal = _get_goal_for_user(db, goal_id, user_id, _rid(request))
    goal.status = "completed"
    goal.completed_at = datetime.now(UTC)
    goal.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(goal)
    return _goal_out(goal)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(
    request: Request,
    body: TaskCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    rid = _rid(request)
    team_id = body.team_id
    if team_id is not None:
        _ensure_team_member(db, team_id, user_id, rid)
    goal = None
    if body.goal_id is not None:
        goal = _get_goal_for_user(db, body.goal_id, user_id, rid)
        if team_id is None:
            team_id = goal.team_id
        _validate_goal_scope(db, goal, user_id, team_id, rid)
    _validate_assignee(db, team_id, body.assignee_user_id, rid)
    max_sort = db.scalar(
        select(func.max(TaskORM.sort_order)).where(
            TaskORM.user_id == (None if team_id else user_id),
            TaskORM.team_id == team_id,
        )
    )
    task = TaskORM(
        user_id=None if team_id else user_id,
        team_id=team_id,
        goal_id=body.goal_id,
        created_by_user_id=user_id,
        assignee_user_id=body.assignee_user_id,
        title=body.title.strip(),
        notes=body.notes,
        status="open",
        priority=body.priority,
        due_at=body.due_at,
        due_window_starts_at=body.due_window_starts_at,
        due_window_ends_at=body.due_window_ends_at,
        sort_order=body.sort_order if body.sort_order is not None else int(max_sort or -1) + 1,
        source="manual",
        metadata_json=body.metadata_json,
    )
    db.add(task)
    db.flush()
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="task_created",
            headline="Task added",
            detail=task.title[:500],
        )
    )
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    team_id: UUID | None = None,
    goal_id: UUID | None = None,
    status: str = "open",
) -> TaskListResponse:
    rid = _rid(request)
    if team_id is not None:
        _ensure_team_member(db, team_id, user_id, rid)
        query = select(TaskORM).where(TaskORM.team_id == team_id)
    else:
        query = select(TaskORM).where(TaskORM.user_id == user_id)
    if goal_id is not None:
        query = query.where(TaskORM.goal_id == goal_id)
    if status != "all":
        query = query.where(TaskORM.status == status)
    tasks = db.scalars(query.order_by(TaskORM.sort_order, TaskORM.created_at.desc())).all()
    return TaskListResponse(tasks=[_task_out(task) for task in tasks])


@router.get("/goals/{goal_id}/tasks", response_model=TaskListResponse)
def list_goal_tasks(
    request: Request,
    goal_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    status: str = "open",
) -> TaskListResponse:
    _get_goal_for_user(db, goal_id, user_id, _rid(request))
    query = select(TaskORM).where(TaskORM.goal_id == goal_id)
    if status != "all":
        query = query.where(TaskORM.status == status)
    tasks = db.scalars(query.order_by(TaskORM.sort_order, TaskORM.created_at.desc())).all()
    return TaskListResponse(tasks=[_task_out(task) for task in tasks])


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    return _task_out(_get_task_for_user(db, task_id, user_id, _rid(request)))


@router.patch("/tasks/{task_id}", response_model=Task)
def patch_task(
    request: Request,
    task_id: UUID,
    body: TaskPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    rid = _rid(request)
    task = _get_task_for_user(db, task_id, user_id, rid)
    if body.goal_id is not None:
        goal = _get_goal_for_user(db, body.goal_id, user_id, rid)
        _validate_goal_scope(db, goal, user_id, task.team_id, rid)
        task.goal_id = body.goal_id
    if body.assignee_user_id is not None:
        _validate_assignee(db, task.team_id, body.assignee_user_id, rid)
        task.assignee_user_id = body.assignee_user_id
    if body.title is not None:
        task.title = body.title.strip()
    if body.notes is not None:
        task.notes = body.notes
    if body.priority is not None:
        task.priority = body.priority
    if body.due_at is not None:
        task.due_at = body.due_at
    if body.due_window_starts_at is not None:
        task.due_window_starts_at = body.due_window_starts_at
    if body.due_window_ends_at is not None:
        task.due_window_ends_at = body.due_window_ends_at
    if body.sort_order is not None:
        task.sort_order = body.sort_order
    if body.metadata_json is not None:
        task.metadata_json = body.metadata_json
    if body.status is not None:
        task.status = body.status
        if body.status == "completed":
            task.completed_at = task.completed_at or datetime.now(UTC)
            task.completed_by_user_id = user_id
        elif body.status == "open":
            task.completed_at = None
            task.completed_by_user_id = None
    task.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.post("/tasks/{task_id}/complete", response_model=Task)
def complete_task(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    task = _get_task_for_user(db, task_id, user_id, _rid(request))
    task.status = "completed"
    task.completed_at = datetime.now(UTC)
    task.completed_by_user_id = user_id
    task.updated_at = datetime.now(UTC)
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="task_completed",
            headline="Task completed",
            detail=task.title[:500],
        )
    )
    if task.goal_id is not None:
        now = datetime.now(UTC)
        notification = NotificationORM(
            user_id=user_id,
            team_id=task.team_id,
            goal_id=task.goal_id,
            task_id=task.id,
            kind="goal_progress",
            title="Goal progressed",
            body=f"You completed: {task.title}",
            status="pending",
            payload_json={
                "type": "goal_progress",
                "goal_id": str(task.goal_id),
                "task_id": str(task.id),
            },
        )
        db.add(notification)
        db.flush()
        settings = get_settings()
        tokens = db.scalars(
            select(DevicePushToken).where(
                DevicePushToken.user_id == user_id,
                DevicePushToken.invalidated_at.is_(None),
            )
        ).all()
        if settings.notifications_enabled and tokens:
            result = send_expo_push_batch(
                db,
                settings,
                user_id,
                [
                    {
                        "to": token.expo_push_token,
                        "title": notification.title,
                        "body": notification.body,
                        "sound": "default",
                        "data": notification.payload_json,
                    }
                    for token in tokens
                ],
            )
            if result.ok:
                notification.status = "sent"
                notification.sent_at = now
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.post("/tasks/{task_id}/reopen", response_model=Task)
def reopen_task(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    task = _get_task_for_user(db, task_id, user_id, _rid(request))
    task.status = "open"
    task.completed_at = None
    task.completed_by_user_id = None
    task.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.get("/notifications", response_model=CompanionNotificationListResponse)
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    limit: int = 50,
) -> CompanionNotificationListResponse:
    rows = db.scalars(
        select(NotificationORM)
        .where(NotificationORM.user_id == user_id)
        .order_by(NotificationORM.created_at.desc())
        .limit(max(1, min(limit, 100)))
    ).all()
    return CompanionNotificationListResponse(notifications=[CompanionNotification.model_validate(row) for row in rows])


@router.get("/interventions", response_model=InterventionListResponse)
def list_interventions(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    status: str = "pending",
) -> InterventionListResponse:
    query = select(InterventionORM).where(InterventionORM.user_id == user_id)
    if status != "all":
        query = query.where(InterventionORM.status == status)
    rows = db.scalars(query.order_by(InterventionORM.created_at.desc())).all()
    return InterventionListResponse(interventions=[Intervention.model_validate(row) for row in rows])


@router.post("/interventions/{intervention_id}/resolve", response_model=Intervention)
def resolve_intervention(
    request: Request,
    intervention_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Intervention:
    rid = _rid(request)
    row = db.get(InterventionORM, intervention_id)
    if row is None or row.user_id != user_id:
        raise ApiError(404, code="not_found", message="Intervention not found", request_id=rid)
    row.status = "resolved"
    row.resolved_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return Intervention.model_validate(row)


@router.get("/transparency", response_model=TransparencyLogPage)
def transparency_log(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    cursor: str | None = None,
    limit: int = 20,
) -> TransparencyLogPage:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    query = select(TransparencyORM).where(TransparencyORM.user_id == user_id)
    decoded = decode_cursor(cursor)
    if decoded:
        t0, id0 = decoded
        query = query.where(
            (TransparencyORM.created_at < t0) | ((TransparencyORM.created_at == t0) & (TransparencyORM.id < id0))
        )
    rows = list(
        db.scalars(query.order_by(TransparencyORM.created_at.desc(), TransparencyORM.id.desc()).limit(limit + 1)).all()
    )
    has_next = len(rows) > limit
    rows = rows[:limit]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_next and rows else None
    return TransparencyLogPage(
        items=[TransparencyEntry.model_validate(row) for row in rows],
        next_cursor=next_cursor,
    )


@router.post("/devices/push-token", status_code=204, response_class=Response)
def register_push_token(
    body: PushTokenRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Response:
    existing = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.expo_push_token == body.expo_push_token,
        )
    )
    if existing is None:
        db.add(
            DevicePushToken(
                user_id=user_id,
                expo_push_token=body.expo_push_token,
                platform=body.platform,
                device_id=body.device_id,
            )
        )
    else:
        existing.invalidated_at = None
        existing.platform = body.platform
        existing.device_id = body.device_id
    db.commit()
    return Response(status_code=204)


@router.delete("/devices/push-token", status_code=204, response_class=Response)
def delete_push_token(
    body: PushTokenRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Response:
    row = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.expo_push_token == body.expo_push_token,
        )
    )
    if row is not None:
        row.invalidated_at = datetime.now(UTC)
        db.commit()
    return Response(status_code=204)
