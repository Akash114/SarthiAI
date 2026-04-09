"""Notification service factory."""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.notifications.base import NotificationService
from app.services.notifications.expo import ExpoNotificationService
from app.services.notifications.noop import NoopNotificationService


@lru_cache
def get_notification_service() -> NotificationService:
    provider = settings.notifications_provider.lower()
    if provider == "expo":
        return ExpoNotificationService()
    if provider == "noop":
        return NoopNotificationService()
    return NoopNotificationService()
