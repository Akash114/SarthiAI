from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.core_routes import _get_goal_for_user, _get_task_for_user
from app.api.v1.cursor_pagination import decode_cursor, encode_cursor
from app.api.v1.deps import _rid, current_user_id
from app.db import get_db
from app.jobs.brain_dump import run_process_brain_dump
from app.models.brain_dump import BrainDump as BrainDumpORM
from app.models.brain_dump_proposal import BrainDumpProposal as ProposalORM
from app.models.focus_session import FocusSession
from app.models.goal import Goal as GoalORM
from app.models.task import Task as TaskORM
from app.models.transparency import TransparencyEntry as TransparencyORM
from app.queue import task_queue
from app.schemas.api import (
    BrainDumpApplyRequest,
    BrainDumpApplyResponse,
    BrainDumpCreateRequest,
    BrainDumpListItem,
    BrainDumpListPage,
    BrainDumpProposal,
    BrainDumpResponse,
)

router = APIRouter(tags=["brain-dumps"])


def _excerpt(body: str, max_len: int = 200) -> str:
    stripped = body.strip()
    return stripped if len(stripped) <= max_len else stripped[: max_len - 1] + "…"


def _proposal_out(row: ProposalORM) -> BrainDumpProposal:
    return BrainDumpProposal(
        id=row.id,
        change_type=row.change_type,
        target_type=row.target_type,
        target_id=row.target_id,
        payload=row.payload_json,
        rationale=row.rationale,
        confidence=row.confidence,
        status=row.status,
        created_at=row.created_at,
        applied_at=row.applied_at,
    )


def _dump_out(db: Session, row: BrainDumpORM) -> BrainDumpResponse:
    proposals = db.scalars(
        select(ProposalORM).where(ProposalORM.brain_dump_id == row.id).order_by(ProposalORM.created_at)
    ).all()
    return BrainDumpResponse(
        id=row.id,
        body=row.body,
        processing_status=row.processing_status,
        actionable=row.actionable,
        focus_session_id=row.focus_session_id,
        active_task_id=row.active_task_id,
        active_goal_id=row.active_goal_id,
        team_id=row.team_id,
        context_snapshot=row.context_snapshot_json,
        ai_result=row.ai_result_json,
        proposals=[_proposal_out(proposal) for proposal in proposals],
        created_at=row.created_at,
        processed_at=row.processed_at,
    )


def _create_dump(
    request: Request,
    body: BrainDumpCreateRequest,
    db: Session,
    user_id: UUID,
    *,
    force_focus_session_id: UUID | None = None,
) -> BrainDumpResponse:
    rid = _rid(request)
    text = body.text.strip()
    if not text:
        raise ApiError(400, code="validation", message="text must not be empty", request_id=rid)
    focus_session_id = force_focus_session_id or body.focus_session_id
    focus = None
    if focus_session_id is not None:
        focus = db.get(FocusSession, focus_session_id)
        if focus is None or focus.user_id != user_id:
            raise ApiError(404, code="not_found", message="Focus session not found", request_id=rid)
    task_id = body.task_id or (focus.task_id if focus else None)
    goal_id = body.goal_id
    team_id = body.team_id
    if task_id is not None:
        task = _get_task_for_user(db, task_id, user_id, rid)
        goal_id = goal_id or task.goal_id
        team_id = team_id or task.team_id
    if goal_id is not None:
        goal = _get_goal_for_user(db, goal_id, user_id, rid)
        team_id = team_id or goal.team_id
    row = BrainDumpORM(
        user_id=user_id,
        focus_session_id=focus_session_id,
        active_task_id=task_id,
        active_goal_id=goal_id,
        team_id=team_id,
        body=text[:20000],
        signals_extracted={},
        actionable=False,
        processing_status="pending",
        created_at=datetime.now(UTC),
    )
    db.add(row)
    db.flush()
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="brain_dump_recorded",
            headline="Brain dump captured",
            detail=_excerpt(text, 240),
        )
    )
    db.commit()
    db.refresh(row)
    task_queue().enqueue(run_process_brain_dump, str(row.id), job_timeout=120, meta={"request_id": rid})
    db.refresh(row)
    return _dump_out(db, row)


@router.get("/brain-dumps", response_model=BrainDumpListPage)
def brain_dump_list(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    cursor: str | None = None,
    limit: int = 20,
) -> BrainDumpListPage:
    rid = _rid(request)
    if limit < 1 or limit > 100:
        raise ApiError(400, code="validation", message="limit must be 1-100", request_id=rid)
    query = select(BrainDumpORM).where(BrainDumpORM.user_id == user_id)
    decoded = decode_cursor(cursor)
    if decoded:
        t0, id0 = decoded
        query = query.where((BrainDumpORM.created_at < t0) | ((BrainDumpORM.created_at == t0) & (BrainDumpORM.id < id0)))
    rows = list(db.scalars(query.order_by(BrainDumpORM.created_at.desc(), BrainDumpORM.id.desc()).limit(limit + 1)).all())
    has_next = len(rows) > limit
    rows = rows[:limit]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_next and rows else None
    return BrainDumpListPage(
        items=[
            BrainDumpListItem(
                id=row.id,
                created_at=row.created_at,
                excerpt=_excerpt(row.body),
                actionable=row.actionable,
                processing_status=row.processing_status,
            )
            for row in rows
        ],
        next_cursor=next_cursor,
    )


@router.post("/brain-dumps", response_model=BrainDumpResponse, status_code=201)
def brain_dump_create(
    request: Request,
    body: BrainDumpCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> BrainDumpResponse:
    return _create_dump(request, body, db, user_id)


@router.post("/focus-sessions/{session_id}/brain-dumps", response_model=BrainDumpResponse, status_code=201)
def focus_brain_dump_create(
    request: Request,
    session_id: UUID,
    body: BrainDumpCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> BrainDumpResponse:
    return _create_dump(request, body, db, user_id, force_focus_session_id=session_id)


@router.get("/brain-dumps/{dump_id}", response_model=BrainDumpResponse)
def brain_dump_get(
    request: Request,
    dump_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> BrainDumpResponse:
    row = db.get(BrainDumpORM, dump_id)
    if row is None or row.user_id != user_id:
        raise ApiError(404, code="not_found", message="Brain dump not found", request_id=_rid(request))
    return _dump_out(db, row)


@router.post("/brain-dumps/{dump_id}/apply", response_model=BrainDumpApplyResponse)
def brain_dump_apply(
    request: Request,
    dump_id: UUID,
    body: BrainDumpApplyRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> BrainDumpApplyResponse:
    rid = _rid(request)
    dump = db.get(BrainDumpORM, dump_id)
    if dump is None or dump.user_id != user_id:
        raise ApiError(404, code="not_found", message="Brain dump not found", request_id=rid)
    proposals = db.scalars(select(ProposalORM).where(ProposalORM.brain_dump_id == dump_id, ProposalORM.status == "pending")).all()
    selected = set(body.proposal_ids) if body.proposal_ids else {proposal.id for proposal in proposals}
    created_goal_ids: list[UUID] = []
    updated_goal_ids: list[UUID] = []
    created_task_ids: list[UUID] = []
    updated_task_ids: list[UUID] = []
    applied: list[UUID] = []
    for proposal in proposals:
        if proposal.id not in selected:
            continue
        payload = dict(proposal.payload_json or {})
        if proposal.change_type == "create_goal":
            team_id = UUID(str(payload["team_id"])) if payload.get("team_id") else dump.team_id
            goal = GoalORM(
                user_id=None if team_id else user_id,
                team_id=team_id,
                created_by_user_id=user_id,
                title=str(payload.get("title") or "Untitled goal")[:240],
                description=payload.get("description"),
                status="active",
                metadata_json={"source_brain_dump_id": str(dump.id)},
            )
            db.add(goal)
            db.flush()
            created_goal_ids.append(goal.id)
        elif proposal.change_type == "update_goal" and proposal.target_id is not None:
            goal = _get_goal_for_user(db, proposal.target_id, user_id, rid)
            if payload.get("title"):
                goal.title = str(payload["title"])[:240]
            if "description" in payload:
                goal.description = payload["description"]
            if "progress_summary" in payload:
                goal.progress_summary = payload["progress_summary"]
            goal.updated_at = datetime.now(UTC)
            updated_goal_ids.append(goal.id)
        elif proposal.change_type == "create_task":
            team_id = UUID(str(payload["team_id"])) if payload.get("team_id") else dump.team_id
            goal_id = UUID(str(payload["goal_id"])) if payload.get("goal_id") else dump.active_goal_id
            task = TaskORM(
                user_id=None if team_id else user_id,
                team_id=team_id,
                goal_id=goal_id,
                created_by_user_id=user_id,
                title=str(payload.get("title") or "Untitled task")[:500],
                notes=payload.get("notes"),
                status="open",
                priority=payload.get("priority") or "normal",
                source="brain_dump",
                metadata_json={"source_brain_dump_id": str(dump.id)},
            )
            db.add(task)
            db.flush()
            created_task_ids.append(task.id)
        elif proposal.change_type == "update_task" and proposal.target_id is not None:
            task = _get_task_for_user(db, proposal.target_id, user_id, rid)
            if payload.get("title"):
                task.title = str(payload["title"])[:500]
            if "notes" in payload:
                task.notes = payload["notes"]
            if "metadata_json" in payload:
                task.metadata_json = {**(task.metadata_json or {}), **(payload.get("metadata_json") or {})}
            task.updated_at = datetime.now(UTC)
            updated_task_ids.append(task.id)
        else:
            continue
        proposal.status = "applied"
        proposal.applied_at = datetime.now(UTC)
        applied.append(proposal.id)
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="brain_dump_applied",
            headline="Brain dump changes applied",
            detail=f"Applied {len(applied)} proposed changes.",
        )
    )
    db.commit()
    return BrainDumpApplyResponse(
        applied_proposal_ids=applied,
        created_goal_ids=created_goal_ids,
        updated_goal_ids=updated_goal_ids,
        created_task_ids=created_task_ids,
        updated_task_ids=updated_task_ids,
    )
