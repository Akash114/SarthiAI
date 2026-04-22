"""Brain dump ingestion (reflection text → structured signals)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from posthog import identify_context, new_context
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.cursor_pagination import decode_cursor, encode_cursor
from app.api.v1.deps import _rid, current_user_id, get_posthog
from app.config import get_settings
from app.db import get_db
from app.models.brain_dump import BrainDump
from app.models.transparency import TransparencyEntry as TransparencyORM
from app.schemas.api import (
    BrainDumpDetailResponse,
    BrainDumpListItem,
    BrainDumpListPage,
    BrainDumpRequest,
    BrainDumpResponse,
)
from app.services.brain_dump_extract import extract_brain_dump_signals

router = APIRouter(tags=["brain-dump"])


def _excerpt(body: str, max_len: int = 200) -> str:
    b = body.strip()
    if len(b) <= max_len:
        return b
    return b[: max_len - 1] + "…"


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
    q = select(BrainDump).where(BrainDump.user_id == user_id)
    c = decode_cursor(cursor)
    if c:
        t0, id0 = c
        q = q.where((BrainDump.created_at < t0) | ((BrainDump.created_at == t0) & (BrainDump.id < id0)))
    q = q.order_by(BrainDump.created_at.desc(), BrainDump.id.desc()).limit(limit + 1)
    rows = list(db.scalars(q).all())
    has_next = len(rows) > limit
    rows = rows[:limit]
    items = [
        BrainDumpListItem(
            id=r.id,
            created_at=r.created_at,
            excerpt=_excerpt(r.body),
            actionable=r.actionable,
        )
        for r in rows
    ]
    next_cursor = None
    if has_next and rows:
        last = rows[-1]
        next_cursor = encode_cursor(last.created_at, last.id)
    return BrainDumpListPage(items=items, next_cursor=next_cursor)


@router.get("/brain-dumps/{dump_id}", response_model=BrainDumpDetailResponse)
def brain_dump_get(
    request: Request,
    dump_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> BrainDumpDetailResponse:
    rid = _rid(request)
    row = db.get(BrainDump, dump_id)
    if row is None or row.user_id != user_id:
        raise ApiError(404, code="not_found", message="Brain dump not found", request_id=rid)
    return BrainDumpDetailResponse(
        id=row.id,
        body=row.body,
        actionable=row.actionable,
        signals=row.signals_extracted,
        created_at=row.created_at,
    )


@router.post("/brain-dump", response_model=BrainDumpResponse, status_code=201)
def brain_dump_create(
    request: Request,
    body: BrainDumpRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
) -> BrainDumpResponse:
    rid = _rid(request)
    text = body.text.strip()
    if not text:
        raise ApiError(400, code="validation", message="text must not be empty", request_id=rid)
    settings = get_settings()
    signals = extract_brain_dump_signals(settings, text)
    actionable = bool(signals.get("actionable_items"))
    row = BrainDump(
        user_id=user_id,
        body=text[:20000],
        signals_extracted=signals,
        actionable=actionable,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    db.flush()
    excerpt = text[:240] + ("…" if len(text) > 240 else "")
    db.add(
        TransparencyORM(
            user_id=user_id,
            action_type="brain_dump_recorded",
            headline="Reflection captured",
            detail=excerpt,
        )
    )
    db.commit()
    db.refresh(row)
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("brain dump recorded", properties={"actionable": actionable})
    return BrainDumpResponse(id=row.id, actionable=actionable, signals=signals)
