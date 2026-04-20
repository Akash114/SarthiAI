"""Brain dump ingestion (reflection text → structured signals)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from posthog import identify_context, new_context
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id, get_posthog
from app.config import get_settings
from app.db import get_db
from app.models.brain_dump import BrainDump
from app.models.transparency import TransparencyEntry as TransparencyORM
from app.schemas.api import BrainDumpRequest, BrainDumpResponse
from app.services.brain_dump_extract import extract_brain_dump_signals

router = APIRouter(tags=["brain-dump"])


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
