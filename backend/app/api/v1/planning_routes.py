"""Week-1 preview and plan snapshot history."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id
from app.config import get_settings
from app.db import get_db
from app.models.plan_snapshot import PlanSnapshot
from app.models.resolution import Resolution as ResolutionORM
from app.schemas.api import (
    PlanHistoryResponse,
    PlanSnapshotDetail,
    PlanSnapshotItem,
    Week1PreviewResponse,
    Week1PreviewTask,
)
from app.services.planner import generate_week1_plan

router = APIRouter(tags=["weekly-plan"])


@router.post(
    "/resolutions/{resolution_id}/week-1/preview",
    response_model=Week1PreviewResponse,
    status_code=201,
)
def week1_preview(
    request: Request,
    resolution_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Week1PreviewResponse:
    rid = _rid(request)
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    settings = get_settings()
    plan = generate_week1_plan(settings, r.title, r.detail)
    tasks = [Week1PreviewTask(title=t, sort_order=i) for i, t in enumerate(plan.task_titles)]
    snap = PlanSnapshot(
        user_id=user_id,
        resolution_id=r.id,
        kind="week1_preview",
        planner_version=plan.planner_version,
        tasks_json=json.dumps([t.model_dump() for t in tasks]),
        created_at=datetime.now(UTC),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return Week1PreviewResponse(
        planner_version=plan.planner_version,
        source=plan.source,
        tasks=tasks,
        snapshot_id=snap.id,
    )


@router.get(
    "/resolutions/{resolution_id}/plan-history",
    response_model=PlanHistoryResponse,
)
def plan_history(
    request: Request,
    resolution_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    limit: int = 20,
) -> PlanHistoryResponse:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    rows = db.scalars(
        select(PlanSnapshot)
        .where(
            PlanSnapshot.resolution_id == resolution_id,
            PlanSnapshot.user_id == user_id,
        )
        .order_by(PlanSnapshot.created_at.desc())
        .limit(limit)
    ).all()
    items = [
        PlanSnapshotItem(
            id=x.id,
            kind=x.kind,
            planner_version=x.planner_version,
            created_at=x.created_at,
        )
        for x in rows
    ]
    return PlanHistoryResponse(items=items)


@router.get("/plan-snapshots/{snapshot_id}", response_model=PlanSnapshotDetail)
def plan_snapshot_get(
    request: Request,
    snapshot_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> PlanSnapshotDetail:
    rid = _rid(request)
    s = db.get(PlanSnapshot, snapshot_id)
    if s is None or s.user_id != user_id:
        raise ApiError(404, code="not_found", message="Snapshot not found", request_id=rid)
    try:
        raw = json.loads(s.tasks_json)
        tasks = [Week1PreviewTask(title=item["title"], sort_order=item["sort_order"]) for item in raw]
    except (json.JSONDecodeError, KeyError, TypeError):
        tasks = []
    return PlanSnapshotDetail(
        id=s.id,
        kind=s.kind,
        planner_version=s.planner_version,
        tasks=tasks,
        created_at=s.created_at,
    )
