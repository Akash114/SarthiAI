"""Notification configuration and token routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.schemas.notifications import NotificationTokenRequest, NotificationTokenResponse
from app.core.config import settings
from app.db.deps import get_db
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.notification_tokens import deactivate_tokens, register_token


router = APIRouter()


@router.get("/notifications/config", tags=["notifications"])
def get_notifications_config(request: Request) -> dict:
    request_id = getattr(request.state, "request_id", None)
    with trace(
        "notifications.config",
        metadata={"provider": settings.notifications_provider},
        request_id=request_id,
    ):
        log_metric("notifications.config.success", 1, metadata={"provider": settings.notifications_provider})
        return {
            "enabled": settings.notifications_enabled,
            "provider": settings.notifications_provider,
            "request_id": request_id or "",
        }


@router.post("/notifications/register", response_model=NotificationTokenResponse, tags=["notifications"])
def register_notification_token(
    payload: NotificationTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> NotificationTokenResponse:
    request_id = getattr(request.state, "request_id", None)
    metadata = {"user_id": str(payload.user_id), "platform": payload.platform, "request_id": request_id}
    with trace("notifications.register", metadata=metadata, user_id=str(payload.user_id), request_id=request_id):
        try:
            register_token(
                db,
                user_id=payload.user_id,
                token=payload.token,
                platform=payload.platform,
                device_name=payload.device_name,
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    log_metric("notifications.register.success", 1, metadata={"user_id": str(payload.user_id)})
    return NotificationTokenResponse(registered=True, request_id=request_id or "")


@router.delete("/notifications/register", response_model=NotificationTokenResponse, tags=["notifications"])
def unregister_notification_token(
    payload: NotificationTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> NotificationTokenResponse:
    request_id = getattr(request.state, "request_id", None)
    metadata = {"user_id": str(payload.user_id), "request_id": request_id}
    with trace("notifications.unregister", metadata=metadata, user_id=str(payload.user_id), request_id=request_id):
        removed = deactivate_tokens(db, user_id=payload.user_id, tokens=[payload.token])
        if not removed:
            raise HTTPException(status_code=404, detail="Token not found")
    log_metric("notifications.unregister.success", 1, metadata={"user_id": str(payload.user_id)})
    return NotificationTokenResponse(registered=False, request_id=request_id or "")
