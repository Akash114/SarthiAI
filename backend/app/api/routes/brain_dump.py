"""Brain dump API routes."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas.brain_dump import BrainDumpRequest, BrainDumpResponse, BrainDumpSignals
from app.db.deps import get_db
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.brain_dump import BrainDump
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.brain_dump_extractor import BrainDumpSignals as ServiceSignals
from app.services.brain_dump_extractor import extract_signals_from_text
from app.services.user_service import get_or_create_user

router = APIRouter()


@router.post("/brain-dump", response_model=BrainDumpResponse, tags=["brain-dump"])
def ingest_brain_dump(request: BrainDumpRequest, http_request: Request, db: Session = Depends(get_db)) -> BrainDumpResponse:
    """Persist a brain dump and return extracted signals."""
    user_id: UUID = request.user_id
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="text must not be empty")
    text_length = len(text)
    request_id = getattr(http_request.state, "request_id", None)

    base_metadata: Dict[str, Any] = {
        "route": "/brain-dump",
        "user_id": str(user_id),
        "text_length": text_length,
    }

    with trace("brain_dump.processing", metadata=base_metadata, user_id=str(user_id), request_id=request_id) as span:
        get_or_create_user(db, user_id)
        try:
            signals_dict = extract_signals_from_text(text)
        except Exception:  # pragma: no cover - defensive guard
            signals_dict = _fallback_signals_dict()

        signals_model = BrainDumpSignals(**signals_dict)
        actionable = bool(signals_model.actionable_items)

        if span:
            try:
                span.update(metadata={**base_metadata, "actionable": actionable})
            except Exception:  # pragma: no cover
                pass

        log_metric("brain_dump.text_length", text_length, metadata={"user_id": str(user_id)})
        log_metric("brain_dump.actionable", 1 if actionable else 0, metadata={"user_id": str(user_id)})

        brain_dump = BrainDump(
            user_id=user_id,
            body=text,
            signals_extracted=signals_dict,
            actionable=actionable,
        )
        db.add(brain_dump)
        db.flush()

        log_entry = AgentActionLog(
            user_id=user_id,
            action_type="brain_dump_analyzed",
            action_payload={
                "brain_dump_id": str(brain_dump.id),
                "signals": signals_dict,
                "request_id": request_id,
            },
            reason="Brain dump analyzed",
            undo_available=False,
        )
        db.add(log_entry)
        try:
            db.commit()
        except IntegrityError as exc:  # pragma: no cover - DB constraint guard
            db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save brain dump") from exc
        db.refresh(brain_dump)

    return BrainDumpResponse(
        id=brain_dump.id,
        acknowledgement=signals_model.acknowledgement,
        signals=signals_model,
        actionable=actionable,
    )


def _fallback_signals_dict() -> dict:
    return ServiceSignals(
        sentiment_score=0.0,
        emotions=[],
        topics=[],
        actionable_items=[],
        acknowledgement="Thanks for sharing. I'm here and we'll take it one step at a time.",
    ).model_dump()
