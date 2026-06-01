from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.core_routes import _get_task_for_user
from app.api.v1.cursor_pagination import decode_cursor, encode_cursor
from app.api.v1.deps import _rid, current_user_id
from app.db import get_db
from app.models.focus_session import FocusSession as FocusSessionORM
from app.models.task import Task as TaskORM
from app.schemas.api import (
    FocusSessionEndRequest,
    FocusSessionListPage,
    FocusSessionResponse,
    FocusSessionStartRequest,
    FocusSessionSummary,
)

router = APIRouter(tags=["focus-sessions"])


def _elapsed_seconds(started_at: datetime, ended_at: datetime | None = None) -> int:
    start = started_at if started_at.tzinfo else started_at.replace(tzinfo=UTC)
    end = ended_at or datetime.now(UTC)
    end = end if end.tzinfo else end.replace(tzinfo=UTC)
    return max(0, int((end - start).total_seconds()))


def _focus_out(row: FocusSessionORM) -> FocusSessionResponse:
    return FocusSessionResponse(
        id=row.id,
        user_id=row.user_id,
        task_id=row.task_id,
        started_at=row.started_at,
        ended_at=row.ended_at,
        elapsed_seconds=_elapsed_seconds(row.started_at, row.ended_at),
        context_snapshot_json=row.context_snapshot_json,
    )


@router.get("/focus-sessions", response_model=FocusSessionListPage)
def list_focus_sessions(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    cursor: str | None = None,
    limit: int = 20,
) -> FocusSessionListPage:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    query = select(FocusSessionORM).where(FocusSessionORM.user_id == user_id)
    decoded = decode_cursor(cursor)
    if decoded:
        t0, id0 = decoded
        query = query.where(
            (FocusSessionORM.started_at < t0) | ((FocusSessionORM.started_at == t0) & (FocusSessionORM.id < id0))
        )
    rows = list(
        db.scalars(query.order_by(FocusSessionORM.started_at.desc(), FocusSessionORM.id.desc()).limit(limit + 1)).all()
    )
    has_next = len(rows) > limit
    rows = rows[:limit]
    task_titles: dict[UUID, str] = {}
    task_ids = {row.task_id for row in rows if row.task_id is not None}
    if task_ids:
        for task in db.scalars(select(TaskORM).where(TaskORM.id.in_(task_ids))).all():
            task_titles[task.id] = task.title
    items = [
        FocusSessionSummary(
            id=row.id,
            task_id=row.task_id,
            task_title=task_titles.get(row.task_id) if row.task_id else None,
            started_at=row.started_at,
            ended_at=row.ended_at,
            elapsed_seconds=_elapsed_seconds(row.started_at, row.ended_at),
        )
        for row in rows
    ]
    next_cursor = encode_cursor(rows[-1].started_at, rows[-1].id) if has_next and rows else None
    return FocusSessionListPage(items=items, next_cursor=next_cursor)


@router.get("/focus-sessions/active", response_model=FocusSessionResponse | None)
def active_focus_session(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> FocusSessionResponse | None:
    row = db.scalar(
        select(FocusSessionORM)
        .where(FocusSessionORM.user_id == user_id, FocusSessionORM.ended_at.is_(None))
        .order_by(FocusSessionORM.started_at.desc())
    )
    return _focus_out(row) if row else None


@router.post("/focus-sessions/start", response_model=FocusSessionResponse, status_code=201)
def start_focus_session(
    request: Request,
    body: FocusSessionStartRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> FocusSessionResponse:
    rid = _rid(request)
    existing = db.scalar(select(FocusSessionORM).where(FocusSessionORM.user_id == user_id, FocusSessionORM.ended_at.is_(None)))
    if existing is not None:
        raise ApiError(409, code="focus_session_active", message="A focus session is already active", request_id=rid)
    context: dict[str, str] = {}
    if body.task_id is not None:
        task = _get_task_for_user(db, body.task_id, user_id, rid)
        context = {
            "task_id": str(task.id),
            "task_title": task.title,
            "goal_id": str(task.goal_id) if task.goal_id else "",
            "team_id": str(task.team_id) if task.team_id else "",
        }
    row = FocusSessionORM(
        user_id=user_id,
        task_id=body.task_id,
        started_at=datetime.now(UTC),
        ended_at=None,
        planned_seconds=None,
        context_snapshot_json=context or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _focus_out(row)


@router.post("/focus-sessions/{session_id}/end", response_model=FocusSessionResponse)
def end_focus_session(
    request: Request,
    session_id: UUID,
    body: FocusSessionEndRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> FocusSessionResponse:
    rid = _rid(request)
    row = db.get(FocusSessionORM, session_id)
    if row is None or row.user_id != user_id:
        raise ApiError(404, code="not_found", message="Focus session not found", request_id=rid)
    if row.ended_at is None:
        row.ended_at = body.ended_at or datetime.now(UTC)
        db.commit()
        db.refresh(row)
    return _focus_out(row)
