"""Journey widget endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.schemas.journey import DailyJourneyResponse, JourneyCategoryPayload
from app.db.deps import get_db
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.daily_journey import build_daily_journey

router = APIRouter()


@router.get("/journey/daily", response_model=DailyJourneyResponse, tags=["journey"])
def get_daily_journey(
    request: Request,
    user_id: UUID = Query(..., description="User ID"),
    db: Session = Depends(get_db),
) -> DailyJourneyResponse:
    request_id = getattr(request.state, "request_id", None)
    with trace("journey.daily", metadata={"user_id": str(user_id)}, user_id=str(user_id), request_id=request_id):
        summaries = build_daily_journey(db, user_id=user_id)

    payload = [JourneyCategoryPayload(**summary.to_dict()) for summary in summaries]
    log_metric("journey.daily.count", len(payload), metadata={"user_id": str(user_id)})
    return DailyJourneyResponse(user_id=user_id, categories=payload, request_id=request_id or "")
