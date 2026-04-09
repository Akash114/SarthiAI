"""User preferences API routes."""
from __future__ import annotations

from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.auth import check_user_access, get_effective_user_id
from app.api.schemas.preferences import PreferencesResponse, PreferencesUpdateRequest
from app.db.deps import get_db
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.preferences_service import get_or_create_preferences, update_preferences


router = APIRouter()


@router.get("/preferences", response_model=PreferencesResponse, tags=["preferences"])
def get_preferences(
    request: Request,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_effective_user_id),
) -> PreferencesResponse:
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
def update_preferences_endpoint(
    payload: PreferencesUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(None, alias="Authorization"),
) -> PreferencesResponse:
    check_user_access(payload.user_id, authorization)
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
                task_reminders_enabled=payload.task_reminders_enabled,
                timezone=payload.timezone,
                availability_profile=payload.availability_profile.model_dump() if payload.availability_profile else None,
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
        task_reminders_enabled=bool(getattr(prefs, "task_reminders_enabled", True)),
        timezone=getattr(prefs, "timezone", None),
        availability_profile=prefs.availability_profile,
        request_id=request_id or "",
    )
