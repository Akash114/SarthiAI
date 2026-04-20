"""Operational endpoints (protected by X-Ops-Key)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid
from app.config import get_settings
from app.db import get_db
from app.jobs.week1 import run_generate_week1
from app.models.resolution import Resolution as ResolutionORM
from app.queue import task_queue
from app.schemas.api import OpsJobRunRequest, OpsJobRunResponse, OpsJobsConfigResponse
from app.services.notifications.reminders import run_task_reminder_scan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ops", tags=["ops"])


def require_ops(
    request: Request,
    x_ops_key: Annotated[str | None, Header(alias="X-Ops-Key")] = None,
) -> None:
    rid = _rid(request)
    s = get_settings()
    if not s.ops_api_key:
        raise ApiError(404, code="not_found", message="Not found", request_id=rid)
    if not x_ops_key or x_ops_key != s.ops_api_key:
        raise ApiError(401, code="unauthorized", message="Invalid ops key", request_id=rid)


@router.get("/jobs", response_model=OpsJobsConfigResponse)
def ops_jobs_config(
    request: Request,
    _auth: Annotated[None, Depends(require_ops)],
) -> OpsJobsConfigResponse:
    _ = _rid(request)
    s = get_settings()
    return OpsJobsConfigResponse(
        scheduler_enabled=s.scheduler_enabled,
        timezone=s.scheduler_timezone,
        jobs=[
            {"id": "reminders", "description": "Scan due tasks and send push reminders"},
            {"id": "week1_recover", "description": "Re-enqueue stuck week-1 generation jobs"},
        ],
    )


@router.post("/jobs/run", response_model=OpsJobRunResponse)
def ops_jobs_run(
    request: Request,
    body: OpsJobRunRequest,
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[None, Depends(require_ops)],
) -> OpsJobRunResponse:
    rid = _rid(request)
    s = get_settings()
    if body.job == "reminders":
        stats = run_task_reminder_scan(db, s)
        db.commit()
        logger.info(
            "ops_job_run",
            extra={
                "request_id": rid,
                "ops_job": body.job,
                "ops_processed": stats.users_notified,
                "ops_detail": f"pushes={stats.pushes_sent}",
            },
        )
        return OpsJobRunResponse(
            job=body.job,
            processed=stats.users_notified,
            detail=f"pushes={stats.pushes_sent}",
        )
    if body.job == "week1_recover":
        cutoff = datetime.now(UTC) - timedelta(minutes=30)
        q = select(ResolutionORM).where(
            ResolutionORM.week_1_plan_status == "pending",
            ResolutionORM.updated_at < cutoff,
        )
        if body.resolution_id:
            q = q.where(ResolutionORM.id == body.resolution_id)
        rows = db.scalars(q).all()
        n = 0
        for r in rows:
            task_queue().enqueue(
                run_generate_week1,
                str(r.id),
                job_timeout=120,
                meta={"request_id": rid, "traceparent": None},
            )
            n += 1
        logger.info(
            "ops_job_run",
            extra={
                "request_id": rid,
                "ops_job": body.job,
                "ops_processed": n,
                "ops_detail": "enqueued",
            },
        )
        return OpsJobRunResponse(job=body.job, processed=n, detail="enqueued")
    raise ApiError(400, code="validation", message="Unknown job", request_id=rid)
