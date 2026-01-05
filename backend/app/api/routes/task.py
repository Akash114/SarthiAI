"""Task listing API routes."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import asc, nulls_last
from sqlalchemy.orm import Session

from app.api.schemas.task import TaskSummary
from app.db.deps import get_db
from app.db.models.task import Task
from app.observability.metrics import log_metric
from app.observability.tracing import trace

router = APIRouter()


@router.get("/tasks", response_model=List[TaskSummary], tags=["tasks"])
def list_tasks(
    http_request: Request,
    user_id: UUID = Query(..., description="User ID owning the tasks"),
    status: str = Query("active", pattern="^(active|draft|all)$"),
    from_: Optional[date] = Query(default=None, alias="from"),
    to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[TaskSummary]:
    """List tasks for a user with optional status and date filtering."""
    request_id = getattr(http_request.state, "request_id", None)

    metadata: Dict[str, Any] = {
        "route": "/tasks",
        "user_id": str(user_id),
        "status": status,
        "from": from_.isoformat() if from_ else None,
        "to": to.isoformat() if to else None,
        "request_id": request_id,
    }

    start_tasks: List[Task] = []
    with trace(
        "task.list",
        metadata=metadata,
        user_id=str(user_id),
        request_id=request_id,
    ):
        query = db.query(Task).filter(Task.user_id == user_id)

        tasks = query.order_by(
            nulls_last(asc(Task.scheduled_day)),
            nulls_last(asc(Task.scheduled_time)),
            asc(Task.created_at),
        ).all()

        if status == "draft":
            start_tasks = [task for task in tasks if _is_draft_task(task)]
        elif status == "active":
            start_tasks = [task for task in tasks if not _is_draft_task(task)]
        else:
            start_tasks = tasks

        if from_:
            start_tasks = [
                task for task in start_tasks if task.scheduled_day and task.scheduled_day >= from_
            ]
        if to:
            start_tasks = [
                task for task in start_tasks if task.scheduled_day and task.scheduled_day <= to
            ]

    count = len(start_tasks)
    log_metric(
        "task.list.success",
        1,
        metadata={"user_id": str(user_id), "status": status},
    )
    log_metric(
        "task.list.count",
        count,
        metadata={"user_id": str(user_id), "status": status},
    )

    return [_serialize_task(task) for task in start_tasks]


def _is_draft_task(task: Task) -> bool:
    metadata = task.metadata_json or {}
    return bool(metadata.get("draft")) and metadata.get("source") == "decomposer_v1"


def _serialize_task(task: Task) -> TaskSummary:
    metadata = task.metadata_json or {}
    source = metadata.get("source") or "unknown"
    if source not in {"decomposer_v1", "manual", "unknown"}:
        source = "unknown"

    return TaskSummary(
        id=task.id,
        resolution_id=task.resolution_id,
        title=task.title,
        scheduled_day=task.scheduled_day,
        scheduled_time=task.scheduled_time,
        duration_min=task.duration_min,
        completed=bool(task.completed),
        created_at=task.created_at,
        updated_at=task.updated_at,
        source=source,
    )
