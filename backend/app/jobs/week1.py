"""RQ job: stub week-1 plan generation."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from opentelemetry.propagate import extract
from opentelemetry.trace import get_tracer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session_factory
from app.models.intervention import Intervention
from app.models.resolution import Resolution
from app.models.task import Task
from app.models.transparency import TransparencyEntry

logger = logging.getLogger(__name__)
_tracer = get_tracer(__name__)


def run_generate_week1(resolution_id: str) -> None:
    from rq.job import get_current_job

    job = get_current_job()
    meta = (job.meta if job else {}) or {}
    rid_log = meta.get("request_id")
    tp = meta.get("traceparent")

    carrier: dict[str, str] = {}
    if tp:
        carrier["traceparent"] = tp
    ctx = extract(carrier)

    with _tracer.start_as_current_span("run_generate_week1", context=ctx):
        if rid_log:
            logger.info("week1_job_start", extra={"request_id": rid_log})
        rid = UUID(resolution_id)
        db = get_session_factory()()
        try:
            _run(db, rid)
            db.commit()
        except Exception:
            db.rollback()
            extra: dict[str, str] = {"resolution_id": resolution_id}
            if rid_log:
                extra["request_id"] = rid_log
            logger.exception("week1_job_failed", extra=extra)
            raise
        finally:
            db.close()


def _run(db: Session, resolution_id: UUID) -> None:
    res = db.get(Resolution, resolution_id)
    if res is None:
        return
    if res.week_1_plan_status == "ready":
        return
    existing_tasks = db.scalar(
        select(func.count()).select_from(Task).where(Task.resolution_id == resolution_id)
    )
    if existing_tasks and existing_tasks > 0:
        res.week_1_plan_status = "ready"
        return

    res.week_1_plan_status = "pending"
    db.flush()

    titles = [
        "Define your first small win",
        "Block 30 minutes this week",
        "Tell one person your commitment",
    ]
    for i, title in enumerate(titles):
        db.add(
            Task(
                resolution_id=res.id,
                title=title,
                status="open",
                sort_order=i,
                due_window_starts_at=datetime.now(UTC),
                due_window_ends_at=datetime.now(UTC) + timedelta(days=7),
            )
        )

    res.week_1_plan_status = "ready"
    db.add(
        TransparencyEntry(
            user_id=res.user_id,
            action_type="plan_generated",
            headline="Week 1 plan created",
            detail="Stub planner generated actionable tasks.",
        )
    )
    pending_iv = db.scalars(
        select(Intervention).where(
            Intervention.user_id == res.user_id,
            Intervention.status == "pending",
        )
    ).first()
    if pending_iv is None:
        db.add(
            Intervention(
                user_id=res.user_id,
                resolution_id=res.id,
                status="pending",
                summary=(
                    "Quick check-in: how does your first week feel? "
                    "Approve to log encouragement or dismiss to skip."
                ),
            )
        )
        db.add(
            TransparencyEntry(
                user_id=res.user_id,
                action_type="intervention_proposed",
                headline="Intervention suggested",
                detail="You can approve or dismiss from the app.",
            )
        )
