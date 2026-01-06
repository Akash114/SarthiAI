"""User preferences API routes."""
from __future__ import annotations

from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.schemas.preferences import PreferencesResponse, PreferencesUpdateRequest
from app.db.deps import get_db
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.preferences_service import get_or_create_preferences, update_preferences


router = APIRouter()


@router.get("/preferences", response_model=PreferencesResponse, tags=["preferences"])
def get_preferences(request: Request, user_id: UUID = Query(..., description="User ID"), db: Session = Depends(get_db)) -> PreferencesResponse:
    request_id = getattr(request.state, "request_id", None)
    start = perf_counter()
    metadata = {"user_id": str(user_id), "request_id": request_id}
    with trace("preferences.get", metadata=metadata, user_id=str(user_id), request_id=request_id):
        try:
            prefs = get_or_create_preferences(db, user_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    latency_ms = (perf_counter() - start) * 1000
    log_metric("preferences.get.success", 1, metadata={"user_id": str(user_id)})
    log_metric("preferences.get.latency_ms", latency_ms, metadata={"user_id": str(user_id)})
    return _serialize_preferences(prefs, request_id)


@router.patch("/preferences", response_model=PreferencesResponse, tags=["preferences"])
def update_preferences_endpoint(payload: PreferencesUpdateRequest, request: Request, db: Session = Depends(get_db)) -> PreferencesResponse:
    request_id = getattr(request.state, "request_id", None)
    start = perf_counter()
    metadata = {"user_id": str(payload.user_id), "request_id": request_id}
    with trace("preferences.update", metadata=metadata, user_id=str(payload.user_id), request_id=request_id):
        try:
            prefs = update_preferences(
                db,
                user_id=payload.user_id,
                coaching_paused=payload.coaching_paused,
                weekly_plans_enabled=payload.weekly_plans_enabled,
                interventions_enabled=payload.interventions_enabled,
                request_id=request_id,
            )
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    latency_ms = (perf_counter() - start) * 1000
    log_metric("preferences.update.success", 1, metadata={"user_id": str(payload.user_id)})
    log_metric("preferences.update.latency_ms", latency_ms, metadata={"user_id": str(payload.user_id)})
    return _serialize_preferences(prefs, request_id)


def _serialize_preferences(prefs, request_id: str | None) -> PreferencesResponse:
    return PreferencesResponse(
        user_id=prefs.user_id,
        coaching_paused=bool(prefs.coaching_paused),
        weekly_plans_enabled=bool(prefs.weekly_plans_enabled),
        interventions_enabled=bool(prefs.interventions_enabled),
        request_id=request_id or "",
    )
