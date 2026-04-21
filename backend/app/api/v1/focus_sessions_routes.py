"""Record focus companion sessions (start / end) for analytics and parity with mobile."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id, get_db
from app.models.focus_session import FocusSession as FocusSessionORM
from app.models.resolution import Resolution as ResolutionORM
from app.models.task import Task as TaskORM
from app.schemas.api import FocusSessionCreateRequest, FocusSessionPatchRequest, FocusSessionResponse

router = APIRouter(tags=["focus-sessions"])


def _task_owned(db: Session, task_id: UUID, user_id: UUID, rid: str) -> TaskORM:
    t = db.get(TaskORM, task_id)
    if t is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    r = db.get(ResolutionORM, t.resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    return t


@router.post("/focus-sessions", response_model=FocusSessionResponse)
def focus_session_create(
    request: Request,
    body: FocusSessionCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> FocusSessionResponse:
    rid = _rid(request)
    _task_owned(db, body.task_id, user_id, rid)
    now = datetime.now(UTC)
    row = FocusSessionORM(
        id=uuid4(),
        user_id=user_id,
        task_id=body.task_id,
        started_at=now,
        ended_at=None,
        planned_seconds=body.planned_seconds,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return FocusSessionResponse.model_validate(row)


@router.patch("/focus-sessions/{session_id}", response_model=FocusSessionResponse)
def focus_session_patch(
    request: Request,
    session_id: UUID,
    body: FocusSessionPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> FocusSessionResponse:
    rid = _rid(request)
    row = db.get(FocusSessionORM, session_id)
    if row is None or row.user_id != user_id:
        raise ApiError(404, code="not_found", message="Focus session not found", request_id=rid)
    if row.ended_at is not None:
        return FocusSessionResponse.model_validate(row)
    row.ended_at = body.ended_at if body.ended_at is not None else datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return FocusSessionResponse.model_validate(row)
