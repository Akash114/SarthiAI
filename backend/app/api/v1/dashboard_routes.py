"""Dashboard, daily journey, intervention history."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id
from app.db import get_db
from app.models.intervention import Intervention as InterventionORM
from app.models.resolution import Resolution as ResolutionORM
from app.models.task import Task as TaskORM
from app.schemas.api import (
    DailyJourneyResponse,
    DashboardResolutionSummary,
    DashboardResponse,
    Intervention,
    JourneyTaskItem,
)

router = APIRouter(tags=["dashboard", "journey", "interventions"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> DashboardResponse:
    _ = _rid(request)
    r = db.scalars(
        select(ResolutionORM)
        .where(
            ResolutionORM.user_id == user_id,
            ResolutionORM.status.in_(("draft", "active")),
        )
        .order_by(ResolutionORM.created_at.desc())
    ).first()
    if r is None:
        return DashboardResponse(resolution=None, pending_intervention=False)
    open_n = db.scalar(
        select(func.count())
        .select_from(TaskORM)
        .where(TaskORM.resolution_id == r.id, TaskORM.status == "open")
    ) or 0
    done_n = db.scalar(
        select(func.count())
        .select_from(TaskORM)
        .where(TaskORM.resolution_id == r.id, TaskORM.status == "completed")
    ) or 0
    pending_iv = db.scalar(
        select(func.count())
        .select_from(InterventionORM)
        .where(InterventionORM.user_id == user_id, InterventionORM.status == "pending")
    ) or 0
    return DashboardResponse(
        resolution=DashboardResolutionSummary(
            id=r.id,
            title=r.title,
            week_1_plan_status=r.week_1_plan_status,
            open_tasks=int(open_n),
            completed_tasks=int(done_n),
        ),
        pending_intervention=pending_iv > 0,
    )


@router.get("/journey/daily", response_model=DailyJourneyResponse)
def journey_daily(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> DailyJourneyResponse:
    _ = _rid(request)
    start = datetime.now(UTC)

    r = db.scalars(
        select(ResolutionORM)
        .where(
            ResolutionORM.user_id == user_id,
            ResolutionORM.status.in_(("draft", "active")),
        )
        .order_by(ResolutionORM.created_at.desc())
    ).first()
    if r is None:
        return DailyJourneyResponse(date=start, tasks=[])

    tasks = db.scalars(
        select(TaskORM)
        .where(
            TaskORM.resolution_id == r.id,
            TaskORM.status == "open",
        )
        .order_by(TaskORM.sort_order)
        .limit(20)
    ).all()
    return DailyJourneyResponse(
        date=start,
        tasks=[
            JourneyTaskItem(
                id=t.id,
                title=t.title,
                status=t.status,
                due_window_ends_at=t.due_window_ends_at,
            )
            for t in tasks
        ],
    )


@router.get("/interventions/history", response_model=list[Intervention])
def interventions_history(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    limit: int = 20,
) -> list[Intervention]:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    rows = db.scalars(
        select(InterventionORM)
        .where(
            InterventionORM.user_id == user_id,
            InterventionORM.status != "pending",
        )
        .order_by(InterventionORM.created_at.desc())
        .limit(limit)
    ).all()
    return [Intervention.model_validate(x) for x in rows]
