from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from posthog import identify_context, new_context

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user, current_user_id, get_posthog
from app.db import get_db
from app.jobs.week1 import run_generate_week1
from app.models.intervention import Intervention as InterventionORM
from app.models.resolution import Resolution as ResolutionORM
from app.models.task import Task as TaskORM
from app.models.transparency import TransparencyEntry as TransparencyORM
from app.models.user import User
from app.models.device_push import DevicePushToken
from app.observability.trace_http import traceparent_from_context
from app.queue import task_queue
from app.schemas.api import (
    GenerateWeek1Response,
    Intervention,
    InterventionCurrentResponse,
    PushTokenRegisterRequest,
    Resolution,
    ResolutionCreateRequest,
    ResolutionCurrentResponse,
    ResolutionPatchRequest,
    Task,
    TaskCreateRequest,
    TaskListResponse,
    TaskPatchRequest,
    TransparencyEntry,
    TransparencyLogPage,
)
from app.services.idempotency import replay_if_exists, store

router = APIRouter(tags=["resolutions", "tasks", "interventions", "transparency", "devices"])


def _resolution_out(r: ResolutionORM) -> Resolution:
    return Resolution.model_validate(r)


def _active_resolution(db: Session, user_id: UUID) -> ResolutionORM | None:
    return db.scalars(
        select(ResolutionORM)
        .where(
            ResolutionORM.user_id == user_id,
            ResolutionORM.status.in_(("draft", "active")),
        )
        .order_by(ResolutionORM.created_at.desc())
    ).first()


@router.get("/resolutions/current", response_model=ResolutionCurrentResponse)
def resolutions_current(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> ResolutionCurrentResponse:
    r = _active_resolution(db, user_id)
    return ResolutionCurrentResponse(resolution=_resolution_out(r) if r else None)


@router.post("/resolutions", response_model=Resolution, status_code=201)
def resolutions_create(
    request: Request,
    body: ResolutionCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Resolution | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope="resolution_create",
    )
    if replay is not None:
        return replay
    if _active_resolution(db, user_id):
        raise ApiError(
            409,
            code="active_resolution_exists",
            message="Active resolution already exists",
            request_id=rid,
        )
    r = ResolutionORM(
        user_id=user_id,
        title=body.title,
        detail=body.detail,
        status="active",
        week_1_plan_status="not_requested",
    )
    db.add(r)
    db.flush()
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="resolution_created",
            headline="Resolution created",
            detail=body.title[:500],
        )
    )
    db.commit()
    db.refresh(r)
    out = _resolution_out(r)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope="resolution_create",
            response_status=201,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("resolution created", properties={"has_detail": bool(body.detail)})
    return out


@router.get("/resolutions/{resolution_id}", response_model=Resolution)
def resolutions_get(
    request: Request,
    resolution_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Resolution:
    rid = _rid(request)
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    return _resolution_out(r)


@router.patch("/resolutions/{resolution_id}", response_model=Resolution)
def resolutions_patch(
    request: Request,
    resolution_id: UUID,
    body: ResolutionPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Resolution | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"resolution_patch:{resolution_id}",
    )
    if replay is not None:
        return replay
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    if body.title is not None:
        r.title = body.title
    if body.detail is not None:
        r.detail = body.detail
    if body.status is not None:
        r.status = body.status
    r.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(r)
    out = _resolution_out(r)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"resolution_patch:{resolution_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None and body.status is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("resolution status updated", properties={"status": body.status})
    return out


@router.post(
    "/resolutions/{resolution_id}/generate-week-1",
    response_model=GenerateWeek1Response,
    status_code=202,
)
def resolutions_generate_week_1(
    request: Request,
    resolution_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> GenerateWeek1Response | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"generate_week1:{resolution_id}",
    )
    if replay is not None:
        return replay
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    if r.week_1_plan_status == "ready":
        raise ApiError(
            409,
            code="week1_already_generated",
            message="Week-1 already generated",
            request_id=rid,
        )
    if r.week_1_plan_status == "pending":
        out = GenerateWeek1Response(week_1_plan_status="pending", job_id=None)
        return out
    # failed / not_requested → (re)enqueue
    r.week_1_plan_status = "pending"
    db.commit()
    tp = traceparent_from_context()
    meta: dict[str, str] = {"request_id": rid}
    if tp:
        meta["traceparent"] = tp
    job = task_queue().enqueue(
        run_generate_week1,
        str(resolution_id),
        job_timeout=120,
        meta=meta,
    )
    db.refresh(r)
    out = GenerateWeek1Response(week_1_plan_status=r.week_1_plan_status, job_id=job.id)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"generate_week1:{resolution_id}",
            response_status=202,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("week 1 plan requested", properties={"resolution_id": str(resolution_id)})
    return out


@router.get("/tasks/{task_id}", response_model=Task)
def task_get(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Task:
    rid = _rid(request)
    t = db.get(TaskORM, task_id)
    if t is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    r = db.get(ResolutionORM, t.resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    return Task.model_validate(t)


@router.patch("/tasks/{task_id}", response_model=Task)
def task_patch(
    request: Request,
    task_id: UUID,
    body: TaskPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Task | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"task_patch:{task_id}",
    )
    if replay is not None:
        return replay
    t = db.get(TaskORM, task_id)
    if t is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    r = db.get(ResolutionORM, t.resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    if body.title is not None:
        t.title = body.title
    if body.note is not None:
        meta = dict(t.metadata_json or {})
        if body.note == "":
            meta.pop("note", None)
        else:
            meta["note"] = body.note
        t.metadata_json = meta if meta else None
    if body.sort_order is not None:
        t.sort_order = body.sort_order
    if body.status is not None:
        if body.status == t.status:
            pass
        elif body.status == "completed":
            t.status = "completed"
        elif body.status == "skipped":
            if t.status == "completed":
                raise ApiError(
                    400,
                    code="invalid_state",
                    message="Cannot skip a completed task",
                    request_id=rid,
                )
            t.status = "skipped"
        elif body.status == "open":
            if t.status == "completed":
                raise ApiError(
                    400,
                    code="invalid_state",
                    message="Cannot reopen a completed task",
                    request_id=rid,
                )
            t.status = "open"
    db.commit()
    db.refresh(t)
    out = Task.model_validate(t)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"task_patch:{task_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("task updated", properties={"resolution_id": str(t.resolution_id)})
    return out


@router.get("/resolutions/{resolution_id}/tasks", response_model=TaskListResponse)
def tasks_list(
    request: Request,
    resolution_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TaskListResponse:
    rid = _rid(request)
    r = db.get(ResolutionORM, resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
    tasks = db.scalars(
        select(TaskORM).where(TaskORM.resolution_id == resolution_id).order_by(TaskORM.sort_order)
    ).all()
    return TaskListResponse(tasks=[Task.model_validate(t) for t in tasks])


@router.post("/tasks", response_model=Task, status_code=201)
def tasks_create(
    request: Request,
    body: TaskCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Task | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope="task_create",
    )
    if replay is not None:
        return replay

    resolution: ResolutionORM | None
    if body.resolution_id is not None:
        resolution = db.get(ResolutionORM, body.resolution_id)
        if resolution is None or resolution.user_id != user_id:
            raise ApiError(404, code="not_found", message="Resolution not found", request_id=rid)
        if resolution.status not in ("draft", "active"):
            raise ApiError(
                400,
                code="invalid_state",
                message="Cannot add tasks to an inactive resolution",
                request_id=rid,
            )
    else:
        resolution = _active_resolution(db, user_id)
        if resolution is None:
            # Preserve the old app behavior: quick tasks can be created directly
            # from Home, even before a user explicitly creates their first goal.
            resolution = ResolutionORM(
                user_id=user_id,
                title="Quick Tasks",
                detail="Auto-created for quick task capture",
                status="active",
                week_1_plan_status="not_requested",
            )
            db.add(resolution)
            db.flush()

    max_sort = db.scalar(
        select(func.max(TaskORM.sort_order)).where(TaskORM.resolution_id == resolution.id)
    )
    sort_order = body.sort_order if body.sort_order is not None else int(max_sort or -1) + 1

    metadata_json = {"note": body.note} if body.note else None
    t = TaskORM(
        resolution_id=resolution.id,
        title=body.title,
        status="open",
        sort_order=sort_order,
        metadata_json=metadata_json,
    )
    db.add(t)
    db.flush()
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="task_created",
            headline="Task added",
            detail=body.title[:500],
        )
    )
    db.commit()
    db.refresh(t)
    out = Task.model_validate(t)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope="task_create",
            response_status=201,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("task created", properties={"resolution_id": str(resolution.id)})
    return out


@router.post("/tasks/{task_id}/complete", response_model=Task)
def tasks_complete(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Task | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"task_complete:{task_id}",
    )
    if replay is not None:
        return replay
    t = db.get(TaskORM, task_id)
    if t is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    r = db.get(ResolutionORM, t.resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    t.status = "completed"
    db.commit()
    db.refresh(t)
    out = Task.model_validate(t)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"task_complete:{task_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("task completed", properties={"resolution_id": str(t.resolution_id)})
    return out


@router.post("/tasks/{task_id}/skip", response_model=Task)
def tasks_skip(
    request: Request,
    task_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Task | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"task_skip:{task_id}",
    )
    if replay is not None:
        return replay
    t = db.get(TaskORM, task_id)
    if t is None:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    r = db.get(ResolutionORM, t.resolution_id)
    if r is None or r.user_id != user_id:
        raise ApiError(404, code="not_found", message="Task not found", request_id=rid)
    if t.status == "skipped":
        out = Task.model_validate(t)
    elif t.status == "completed":
        raise ApiError(400, code="invalid_state", message="Cannot skip a completed task", request_id=rid)
    else:
        t.status = "skipped"
        db.commit()
        db.refresh(t)
        out = Task.model_validate(t)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"task_skip:{task_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("task skipped", properties={"resolution_id": str(t.resolution_id)})
    return out


@router.get("/interventions/current", response_model=InterventionCurrentResponse)
def interventions_current(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> InterventionCurrentResponse:
    iv = db.scalars(
        select(InterventionORM)
        .where(InterventionORM.user_id == user_id, InterventionORM.status == "pending")
        .order_by(InterventionORM.created_at.desc())
    ).first()
    if iv is None:
        return InterventionCurrentResponse(intervention=None)
    return InterventionCurrentResponse(
        intervention=Intervention.model_validate(iv),
    )


@router.post("/interventions/{intervention_id}/approve", response_model=Intervention)
def interventions_approve(
    request: Request,
    intervention_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Intervention | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"intervention_approve:{intervention_id}",
    )
    if replay is not None:
        return replay
    iv = db.get(InterventionORM, intervention_id)
    if iv is None or iv.user_id != user_id:
        raise ApiError(404, code="not_found", message="Intervention not found", request_id=rid)
    if iv.status != "pending":
        raise ApiError(
            400,
            code="invalid_state",
            message="Intervention is not pending",
            request_id=rid,
        )
    iv.status = "approved"
    iv.resolved_at = datetime.now(UTC)
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="intervention_approved",
            headline="Intervention approved",
            detail=None,
        )
    )
    db.commit()
    db.refresh(iv)
    out = Intervention.model_validate(iv)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"intervention_approve:{intervention_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("intervention approved")
    return out


@router.post("/interventions/{intervention_id}/dismiss", response_model=Intervention)
def interventions_dismiss(
    request: Request,
    intervention_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Intervention | Response:
    rid = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope=f"intervention_dismiss:{intervention_id}",
    )
    if replay is not None:
        return replay
    iv = db.get(InterventionORM, intervention_id)
    if iv is None or iv.user_id != user_id:
        raise ApiError(404, code="not_found", message="Intervention not found", request_id=rid)
    if iv.status != "pending":
        raise ApiError(
            400,
            code="invalid_state",
            message="Intervention is not pending",
            request_id=rid,
        )
    iv.status = "dismissed"
    iv.resolved_at = datetime.now(UTC)
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="intervention_dismissed",
            headline="Intervention dismissed",
            detail=None,
        )
    )
    db.commit()
    db.refresh(iv)
    out = Intervention.model_validate(iv)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope=f"intervention_dismiss:{intervention_id}",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("intervention dismissed")
    return out


def _encode_cursor(created_at: datetime, eid: UUID) -> str:
    raw = json.dumps({"t": created_at.isoformat(), "id": str(eid)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cur: str | None) -> tuple[datetime, UUID] | None:
    if not cur:
        return None
    try:
        raw = base64.urlsafe_b64decode(cur.encode()).decode()
        d = json.loads(raw)
        return datetime.fromisoformat(d["t"]), UUID(d["id"])
    except (ValueError, json.JSONDecodeError, KeyError):
        return None


@router.get("/transparency-log/{entry_id}", response_model=TransparencyEntry)
def transparency_entry_get(
    request: Request,
    entry_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TransparencyEntry:
    rid = _rid(request)
    e = db.get(TransparencyORM, entry_id)
    if e is None or e.user_id != user_id:
        raise ApiError(404, code="not_found", message="Entry not found", request_id=rid)
    return TransparencyEntry.model_validate(e)


@router.get("/transparency-log", response_model=TransparencyLogPage)
def transparency_list(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    cursor: str | None = None,
    limit: int = 20,
    action_type: str | None = None,
) -> TransparencyLogPage:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    q = select(TransparencyORM).where(TransparencyORM.user_id == user_id)
    if action_type:
        q = q.where(TransparencyORM.action_type == action_type)
    c = _decode_cursor(cursor)
    if c:
        t0, id0 = c
        q = q.where(
            (TransparencyORM.created_at < t0)
            | ((TransparencyORM.created_at == t0) & (TransparencyORM.id < id0))
        )
    q = q.order_by(TransparencyORM.created_at.desc(), TransparencyORM.id.desc()).limit(limit + 1)
    rows = list(db.scalars(q).all())
    has_next = len(rows) > limit
    rows = rows[:limit]
    items = [TransparencyEntry.model_validate(x) for x in rows]
    next_cursor = None
    if has_next and rows:
        last = rows[-1]
        next_cursor = _encode_cursor(last.created_at, last.id)
    return TransparencyLogPage(items=items, next_cursor=next_cursor)


@router.post("/devices/push-token", status_code=204, response_class=Response)
def devices_push_token(
    request: Request,
    body: PushTokenRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Response:
    rid = _rid(request)
    if body.platform not in ("android", "ios"):
        raise ApiError(
            400,
            code="validation",
            message="platform must be android or ios",
            request_id=rid,
        )
    existing = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.expo_push_token == body.expo_push_token,
        )
    )
    if existing:
        existing.platform = body.platform
        existing.device_id = body.device_id
        existing.invalidated_at = None
        existing.created_at = datetime.now(UTC)
    else:
        db.add(
            DevicePushToken(
                user_id=user_id,
                expo_push_token=body.expo_push_token,
                platform=body.platform,
                device_id=body.device_id,
            )
        )
    db.commit()
    return Response(status_code=204)


@router.delete("/devices/push-token", status_code=204, response_class=Response)
def devices_push_token_delete(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    body: PushTokenRegisterRequest = Body(...),
) -> Response:
    rid = _rid(request)
    row = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.expo_push_token == body.expo_push_token,
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return Response(status_code=204)
