"""Resolution intake API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas.approval import ApprovalRequest, ApprovalResponse, ApprovedTaskPayload, TaskEdit
from app.api.schemas.decomposition import (
    DecompositionRequest,
    DecompositionResponse,
    DraftTaskPayload,
    PlanPayload,
)
from app.api.schemas.resolution import (
    ResolutionCreateRequest,
    ResolutionResponse,
    ResolutionSummary,
    ResolutionDetailResponse,
)
from app.db.deps import get_db
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.resolution import Resolution
from app.db.models.task import Task
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.resolution_decomposer import DraftTaskSpec, decompose_resolution
from app.services.resolution_intake import derive_resolution_fields
from app.services.user_service import get_or_create_user

router = APIRouter()


@router.get("/resolutions", response_model=List[ResolutionSummary], tags=["resolutions"])
def list_resolutions(
    http_request: Request,
    user_id: UUID = Query(..., description="User ID owning the resolutions"),
    status: Optional[str] = Query(default=None, pattern="^(draft|active)$"),
    db: Session = Depends(get_db),
) -> List[ResolutionSummary]:
    """List resolutions for a user with optional status filtering."""
    request_id = getattr(http_request.state, "request_id", None) if http_request else None
    metadata: Dict[str, Any] = {
        "route": "/resolutions",
        "user_id": str(user_id),
        "status": status,
        "request_id": request_id,
    }

    with trace(
        "resolution.list",
        metadata=metadata,
        user_id=str(user_id),
        request_id=request_id,
    ):
        query = db.query(Resolution).filter(Resolution.user_id == user_id)
        if status:
            query = query.filter(Resolution.status == status)
        resolutions = query.order_by(Resolution.updated_at.desc()).all()

    log_metric(
        "resolution.list.count",
        len(resolutions),
        metadata={"user_id": str(user_id), "status": status or "all"},
    )

    return [
        ResolutionSummary(
            id=res.id,
            title=res.title,
            type=res.type,
            status=res.status,
            duration_weeks=res.duration_weeks,
            updated_at=res.updated_at,
        )
        for res in resolutions
    ]


@router.get(
    "/resolutions/{resolution_id}",
    response_model=ResolutionDetailResponse,
    tags=["resolutions"],
)
def get_resolution_detail(
    resolution_id: UUID,
    http_request: Request,
    user_id: UUID = Query(..., description="User ID that must own the resolution"),
    db: Session = Depends(get_db),
) -> ResolutionDetailResponse:
    """Return a resolution plus its plan and relevant tasks."""
    request_id = getattr(http_request.state, "request_id", None) if http_request else None
    resolution = db.get(Resolution, resolution_id)
    if not resolution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolution not found")
    if resolution.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resolution does not belong to user")

    metadata_dict = dict(resolution.metadata_json or {})
    plan_payload = metadata_dict.get("plan_v1")
    plan_data = plan_payload if isinstance(plan_payload, dict) else None

    draft_tasks: List[DraftTaskPayload] = []
    active_tasks: List[ApprovedTaskPayload] = []

    with trace(
        "resolution.get",
        metadata={
            "route": f"/resolutions/{resolution_id}",
            "resolution_id": str(resolution_id),
            "user_id": str(user_id),
            "status": resolution.status,
            "request_id": request_id,
        },
        user_id=str(user_id),
        request_id=request_id,
    ):
        if resolution.status == "draft":
            draft_tasks = [_serialize_task(task) for task in _fetch_draft_tasks(db, resolution.id)]
        else:
            active_tasks = [_serialize_active_task(task) for task in _fetch_active_tasks(db, resolution.id)]

    log_metric(
        "resolution.get.success",
        1,
        metadata={"user_id": str(user_id), "resolution_id": str(resolution_id), "status": resolution.status},
    )

    return ResolutionDetailResponse(
        id=resolution.id,
        user_id=resolution.user_id,
        title=resolution.title,
        type=resolution.type,
        status=resolution.status,
        duration_weeks=resolution.duration_weeks,
        plan=plan_data,
        draft_tasks=draft_tasks,
        active_tasks=active_tasks,
        request_id=request_id or "",
    )


@router.post("/resolutions", response_model=ResolutionResponse, status_code=status.HTTP_201_CREATED, tags=["resolutions"])
def create_resolution_endpoint(
    payload: ResolutionCreateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> ResolutionResponse:
    """Store a new resolution derived from free text."""
    user_id = payload.user_id
    text = payload.text
    duration_weeks = payload.duration_weeks
    text_length = len(text)
    request_id = getattr(http_request.state, "request_id", None)

    base_metadata: Dict[str, Any] = {
        "route": "/resolutions",
        "user_id": str(user_id),
        "text_length": text_length,
        "duration_weeks": duration_weeks,
        "request_id": request_id,
    }

    classified_type = "other"
    success = False
    resolution: Resolution | None = None

    try:
        with trace(
            "resolution.intake",
            metadata=base_metadata,
            user_id=str(user_id),
            request_id=request_id,
        ) as span:
            get_or_create_user(db, user_id)
            derived = derive_resolution_fields(text)
            classified_type = derived.type

            resolution = Resolution(
                user_id=user_id,
                title=derived.title,
                type=classified_type,
                duration_weeks=duration_weeks,
                status="draft",
                metadata_json={"raw_text": text},
            )
            db.add(resolution)
            try:
                db.commit()
            except IntegrityError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to save resolution",
                ) from exc
            db.refresh(resolution)
            success = True

            if span:
                try:
                    span.update(metadata={**base_metadata, "classified_type": classified_type})
                except Exception:
                    pass
    finally:
        metric_metadata = {"user_id": str(user_id), "type": classified_type}
        if duration_weeks is not None:
            metric_metadata["duration_weeks"] = duration_weeks

        log_metric("resolution.intake.text_length", text_length, metadata=metric_metadata)
        log_metric("resolution.intake.success", 1 if success else 0, metadata=metric_metadata)
        log_metric("resolution.intake.classified_type", 1, metadata=metric_metadata)

    if not resolution:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Resolution not created")

    return ResolutionResponse(
        id=resolution.id,
        user_id=resolution.user_id,
        title=resolution.title,
        raw_text=text,
        type=resolution.type,
        duration_weeks=resolution.duration_weeks,
        status=resolution.status,
        request_id=request_id or "",
    )


@router.post(
    "/resolutions/{resolution_id}/decompose",
    response_model=DecompositionResponse,
    tags=["resolutions"],
)
def decompose_resolution_endpoint(
    resolution_id: UUID,
    http_request: Request,
    payload: DecompositionRequest | None = None,
    db: Session = Depends(get_db),
) -> DecompositionResponse:
    """Generate or return a multi-week plan plus draft week-one tasks."""
    params = payload or DecompositionRequest()
    resolution = db.get(Resolution, resolution_id)
    if not resolution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolution not found")

    request_id = getattr(http_request.state, "request_id", None)
    metadata = dict(resolution.metadata_json or {})
    raw_text = metadata.get("raw_text") or resolution.title
    plan_weeks = _resolve_plan_weeks(params.weeks, resolution.duration_weeks)
    regenerate = params.regenerate

    base_metadata: Dict[str, Any] = {
        "route": f"/resolutions/{resolution_id}/decompose",
        "resolution_id": str(resolution_id),
        "user_id": str(resolution.user_id),
        "duration_weeks": resolution.duration_weeks,
        "plan_weeks": plan_weeks,
        "regenerate": regenerate,
        "request_id": request_id,
    }

    start_time = perf_counter()
    success = False
    tasks_generated = 0
    plan_payload: Dict[str, Any]
    task_models: List[Task] = []

    try:
        with trace(
            "resolution.decomposition",
            metadata=base_metadata,
            user_id=str(resolution.user_id),
            request_id=request_id,
        ) as span:
            existing_plan = metadata.get("plan_v1")
            existing_tasks = _fetch_draft_tasks(db, resolution.id)

            if existing_plan and existing_tasks and not regenerate:
                plan_payload = existing_plan
                task_models = existing_tasks
            else:
                try:
                    plan_payload, task_models, new_type = _prepare_plan_and_tasks(
                        db=db,
                        resolution=resolution,
                        metadata=metadata,
                        raw_text=raw_text,
                        plan_weeks=plan_weeks,
                        regenerate=regenerate,
                    )
                    if new_type and (resolution.type == "other" or not resolution.type):
                        resolution.type = new_type
                    db.commit()
                except IntegrityError as exc:
                    db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to store decomposition",
                    ) from exc
                except Exception:
                    db.rollback()
                    raise

            tasks_generated = len(task_models)
            success = True

            if span:
                try:
                    span.update(metadata={**base_metadata, "tasks_generated": tasks_generated})
                except Exception:
                    pass
    finally:
        latency_ms = (perf_counter() - start_time) * 1000
        metric_metadata = {
            "resolution_id": str(resolution_id),
            "user_id": str(resolution.user_id),
            "regenerate": regenerate,
            "tasks_generated": tasks_generated,
        }
        if resolution.duration_weeks is not None:
            metric_metadata["duration_weeks"] = resolution.duration_weeks

        log_metric("resolution.decomposition.success", 1 if success else 0, metadata=metric_metadata)
        log_metric("resolution.decomposition.tasks_generated", tasks_generated, metadata=metric_metadata)
        log_metric("resolution.decomposition.latency_ms", latency_ms, metadata=metric_metadata)

    response_plan = PlanPayload(**plan_payload)
    response_tasks = [_serialize_task(task) for task in task_models]

    return DecompositionResponse(
        resolution_id=resolution.id,
        user_id=resolution.user_id,
        title=resolution.title,
        type=resolution.type,
        duration_weeks=resolution.duration_weeks,
        plan=response_plan,
        week_1_tasks=response_tasks,
        request_id=request_id or "",
    )


@router.post(
    "/resolutions/{resolution_id}/approve",
    response_model=ApprovalResponse,
    tags=["resolutions"],
)
def approve_resolution_endpoint(
    resolution_id: UUID,
    payload: ApprovalRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> ApprovalResponse:
    """Approve, reject, or request regeneration for a resolution plan."""
    resolution = db.get(Resolution, resolution_id)
    if not resolution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolution not found")

    if resolution.user_id != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resolution does not belong to user")

    request_id = getattr(http_request.state, "request_id", None)
    metadata = dict(resolution.metadata_json or {})
    decision = payload.decision

    base_metadata: Dict[str, Any] = {
        "route": f"/resolutions/{resolution_id}/approve",
        "resolution_id": str(resolution_id),
        "user_id": str(resolution.user_id),
        "decision": decision,
        "request_id": request_id,
    }

    start_time = perf_counter()
    success = False
    tasks_approved = 0
    edits_count = 0
    response_tasks: List[ApprovedTaskPayload] = []
    message: str | None = None

    try:
        with trace(
            "resolution.approval",
            metadata=base_metadata,
            user_id=str(resolution.user_id),
            request_id=request_id,
        ) as span:
            action_type: str
            reason: str
            action_payload: Dict[str, Any]

            try:
                if decision == "accept":
                    if resolution.status == "active":
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resolution already active")
                    if "plan_v1" not in metadata:
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Decompose resolution before approval")

                    draft_tasks = _fetch_draft_tasks(db, resolution.id)
                    if not draft_tasks:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="No draft tasks available; run decomposition first",
                        )

                    tasks_map = {task.id: task for task in draft_tasks if task.user_id == resolution.user_id}
                    invalid_edits = [
                        str(edit.task_id)
                        for edit in payload.task_edits
                        if edit.task_id not in tasks_map
                    ]
                    if invalid_edits:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"task_edits references invalid task_id(s): {', '.join(invalid_edits)}",
                        )

                    edits_count = _apply_task_edits(tasks_map, payload.task_edits)
                    activated_at = datetime.now(timezone.utc).isoformat()
                    _activate_tasks(draft_tasks, activated_at)
                    metadata["approved_at"] = activated_at
                    resolution.metadata_json = metadata
                    resolution.status = "active"
                    tasks_approved = len(draft_tasks)
                    response_tasks = [_serialize_active_task(task) for task in draft_tasks]
                    message = "Resolution activated."
                    action_type = "resolution_approved"
                    action_payload = {
                        "resolution_id": str(resolution.id),
                        "decision": decision,
                        "tasks_approved": [str(task.id) for task in draft_tasks],
                        "edits_count": edits_count,
                        "plan_version": "plan_v1" if "plan_v1" in metadata else None,
                        "request_id": request_id,
                    }
                    reason = f"User accepted plan for resolution {resolution.id}"
                    agent_log = AgentActionLog(
                        user_id=resolution.user_id,
                        action_type=action_type,
                        action_payload=action_payload,
                        reason=reason,
                        undo_available=True,
                    )
                    db.add(agent_log)
                elif decision == "reject":
                    if payload.task_edits:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_edits are only supported for accept decisions")
                    rejected_at = datetime.now(timezone.utc).isoformat()
                    metadata["rejected_at"] = rejected_at
                    resolution.metadata_json = metadata
                    message = "Resolution kept in draft."
                    action_type = "resolution_rejected"
                    action_payload = {
                        "resolution_id": str(resolution.id),
                        "decision": decision,
                        "request_id": request_id,
                    }
                    reason = f"User rejected plan for resolution {resolution.id}"
                    agent_log = AgentActionLog(
                        user_id=resolution.user_id,
                        action_type=action_type,
                        action_payload=action_payload,
                        reason=reason,
                        undo_available=False,
                    )
                    db.add(agent_log)
                else:  # regenerate
                    if payload.task_edits:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_edits are only supported for accept decisions")
                    requested_at = datetime.now(timezone.utc).isoformat()
                    metadata["regeneration_requested_at"] = requested_at
                    resolution.metadata_json = metadata
                    message = "Regeneration requested. Run /decompose with regenerate=true to refresh the plan."
                    action_type = "resolution_regenerate_requested"
                    action_payload = {
                        "resolution_id": str(resolution.id),
                        "decision": decision,
                        "request_id": request_id,
                    }
                    reason = f"User requested regeneration for resolution {resolution.id}"
                    agent_log = AgentActionLog(
                        user_id=resolution.user_id,
                        action_type=action_type,
                        action_payload=action_payload,
                        reason=reason,
                        undo_available=False,
                    )
                    db.add(agent_log)

                db.add(resolution)
                db.commit()
            except HTTPException:
                db.rollback()
                raise
            except IntegrityError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to persist approval decision",
                ) from exc
            except Exception:
                db.rollback()
                raise

            success = True
            if span:
                try:
                    span.update(metadata={**base_metadata, "tasks_approved": tasks_approved, "edits_count": edits_count})
                except Exception:
                    pass

    finally:
        latency_ms = (perf_counter() - start_time) * 1000
        metric_metadata = {
            "resolution_id": str(resolution_id),
            "user_id": str(resolution.user_id),
            "decision": decision,
            "tasks_approved": tasks_approved,
            "edits_count": edits_count,
        }
        log_metric("resolution.approval.success", 1 if success else 0, metadata=metric_metadata)
        log_metric("resolution.approval.tasks_approved", tasks_approved, metadata=metric_metadata)
        log_metric("resolution.approval.latency_ms", latency_ms, metadata=metric_metadata)

    return ApprovalResponse(
        resolution_id=resolution.id,
        status=resolution.status,
        tasks_activated=response_tasks,
        message=message,
        request_id=request_id or "",
    )


def _prepare_plan_and_tasks(
    db: Session,
    resolution: Resolution,
    metadata: Dict[str, Any],
    raw_text: str,
    plan_weeks: int,
    regenerate: bool,
) -> tuple[Dict[str, Any], List[Task], str]:
    if regenerate:
        _delete_existing_draft_tasks(db, resolution.id)
    decomposition = decompose_resolution(raw_text, resolution.title, resolution.type, plan_weeks)
    metadata["plan_v1"] = decomposition.plan
    metadata["plan_generated_at"] = datetime.now(timezone.utc).isoformat()
    resolution.metadata_json = metadata
    tasks = _create_tasks_from_specs(resolution, decomposition.week_one_tasks)
    for task in tasks:
        db.add(task)
    return decomposition.plan, tasks, decomposition.resolution_type


def _resolve_plan_weeks(request_weeks: int | None, duration_weeks: int | None) -> int:
    if request_weeks:
        return max(4, min(12, request_weeks))
    if duration_weeks:
        return max(4, min(12, duration_weeks))
    return 8


def _fetch_draft_tasks(db: Session, resolution_id: UUID) -> List[Task]:
    tasks = (
        db.query(Task)
        .filter(Task.resolution_id == resolution_id)
        .order_by(Task.created_at.asc())
        .all()
    )
    return [task for task in tasks if _is_draft_task(task)]


def _fetch_active_tasks(db: Session, resolution_id: UUID) -> List[Task]:
    tasks = (
        db.query(Task)
        .filter(Task.resolution_id == resolution_id)
        .order_by(Task.created_at.asc())
        .all()
    )
    return [task for task in tasks if _is_active_task(task)]


def _delete_existing_draft_tasks(db: Session, resolution_id: UUID) -> None:
    tasks = _fetch_draft_tasks(db, resolution_id)
    for task in tasks:
        db.delete(task)
    if tasks:
        db.flush()


def _is_draft_task(task: Task) -> bool:
    metadata = task.metadata_json or {}
    return bool(metadata.get("draft")) and metadata.get("source") == "decomposer_v1"


def _is_active_task(task: Task) -> bool:
    metadata = task.metadata_json or {}
    return metadata.get("draft") is False and metadata.get("source") == "decomposer_v1"


def _create_tasks_from_specs(resolution: Resolution, specs: List[DraftTaskSpec]) -> List[Task]:
    tasks: List[Task] = []
    for spec in specs:
        extra_metadata = {k: v for k, v in (spec.metadata or {}).items() if v is not None}
        metadata = {"draft": True, "source": "decomposer_v1", "week": 1, **extra_metadata}
        task = Task(
            user_id=resolution.user_id,
            resolution_id=resolution.id,
            title=spec.title,
            scheduled_day=spec.scheduled_day,
            scheduled_time=spec.scheduled_time,
            duration_min=spec.duration_min,
            metadata_json=metadata,
        )
        tasks.append(task)
    return tasks


def _serialize_task(task: Task) -> DraftTaskPayload:
    return DraftTaskPayload(
        id=task.id,
        title=task.title,
        scheduled_day=task.scheduled_day,
        scheduled_time=task.scheduled_time,
        duration_min=task.duration_min,
        draft=True,
    )


def _serialize_active_task(task: Task) -> ApprovedTaskPayload:
    return ApprovedTaskPayload(
        id=task.id,
        title=task.title,
        scheduled_day=task.scheduled_day,
        scheduled_time=task.scheduled_time,
        duration_min=task.duration_min,
        draft=False,
    )


def _activate_tasks(tasks: List[Task], activated_at: str) -> None:
    for task in tasks:
        metadata = dict(task.metadata_json or {})
        metadata["draft"] = False
        metadata["activated_at"] = activated_at
        task.metadata_json = metadata
        task.completed = False
        task.completed_at = None


def _apply_task_edits(tasks_map: Dict[UUID, Task], edits: List[TaskEdit]) -> int:
    edited: set[UUID] = set()
    for edit in edits:
        task = tasks_map.get(edit.task_id)
        if not task:
            continue
        mutated = False
        if edit.title is not None and edit.title != task.title:
            task.title = edit.title
            mutated = True
        if edit.scheduled_day is not None and edit.scheduled_day != task.scheduled_day:
            task.scheduled_day = edit.scheduled_day
            mutated = True
        if edit.scheduled_time is not None and edit.scheduled_time != task.scheduled_time:
            task.scheduled_time = edit.scheduled_time
            mutated = True
        if edit.duration_min is not None and edit.duration_min != task.duration_min:
            task.duration_min = edit.duration_min
            mutated = True
        if mutated:
            edited.add(task.id)
    return len(edited)
