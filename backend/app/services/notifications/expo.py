"""Expo push notification provider for weekly plan and intervention snapshots."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.services.notification_tokens import fetch_user_tokens
from app.services.notifications.base import NotificationResult, NotificationService
from app.services.notifications.expo_client import send_expo_push_batch


class ExpoNotificationService(NotificationService):
    """Send weekly plan and intervention notifications via Expo Push API."""

    def notify_weekly_plan_ready(
        self,
        *,
        db: Session,
        user_id: UUID,
        week_start: str,
        week_end: str,
        snapshot_id: UUID,
        request_id: str | None,
        title: str | None = None,
        body: str | None = None,
    ) -> NotificationResult:
        t = title or "Your week is ready"
        b = body or "Open Sarthi to see your weekly blueprint."
        return _send_to_user(
            db,
            user_id,
            title=t,
            body=b[:4000],
            data={
                "type": "weekly_plan",
                "snapshot_id": str(snapshot_id),
                "user_id": str(user_id),
                "week_start": week_start,
                "week_end": week_end,
            },
        )

    def notify_intervention_ready(
        self,
        *,
        db: Session,
        user_id: UUID,
        week_start: str,
        week_end: str,
        snapshot_id: UUID,
        flagged: bool,
        request_id: str | None,
        title: str | None = None,
        body: str | None = None,
    ) -> NotificationResult:
        t = title or "Sarthi check-in"
        b = body or "Open Sarthi for your intervention update."
        return _send_to_user(
            db,
            user_id,
            title=t,
            body=b[:4000],
            data={
                "type": "intervention",
                "snapshot_id": str(snapshot_id),
                "user_id": str(user_id),
                "week_start": week_start,
                "week_end": week_end,
                "flagged": flagged,
            },
        )


def _send_to_user(
    db: Session,
    user_id: UUID,
    *,
    title: str,
    body: str,
    data: dict,
) -> NotificationResult:
    tokens = fetch_user_tokens(db, user_id)
    active = [t for t in tokens if t.active]
    if not active:
        return NotificationResult(
            status="skipped",
            reason="no active push tokens",
            tokens_attempted=0,
            tokens_ok=0,
            tokens_deactivated=0,
            retryable=False,
        )
    messages = [
        {
            "to": t.token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data,
        }
        for t in active
    ]
    return send_expo_push_batch(db, user_id, messages)
