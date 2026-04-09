"""Notification service interface."""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session


@dataclass
class NotificationResult:
    status: str
    reason: str
    tokens_attempted: int = 0
    tokens_ok: int = 0
    tokens_deactivated: int = 0
    retryable: bool = False


class NotificationService:
    """Base interface for notification providers."""

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
        raise NotImplementedError

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
        raise NotImplementedError
