"""Scan open tasks and send due-window reminders via Expo."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.device_push import DevicePushToken
from app.models.resolution import Resolution
from app.models.task import Task
from app.services.notifications.expo import send_expo_push_batch
from app.services.user_prefs import allow_task_reminders

logger = logging.getLogger(__name__)


@dataclass
class ReminderJobStats:
    users_notified: int
    pushes_sent: int


def run_task_reminder_scan(db: Session, settings: Settings) -> ReminderJobStats:
    if not settings.notifications_enabled:
        return ReminderJobStats(users_notified=0, pushes_sent=0)

    now = datetime.now(UTC)
    lookahead = now + timedelta(minutes=max(1, settings.task_reminder_lookahead_minutes))

    q = (
        select(Task, Resolution)
        .join(Resolution, Task.resolution_id == Resolution.id)
        .where(
            Task.status == "open",
            Task.reminder_sent_at.is_(None),
            Task.due_window_ends_at.isnot(None),
            Task.due_window_ends_at >= now,
            Task.due_window_ends_at <= lookahead,
            Resolution.status.in_(("active", "draft")),
        )
    )
    rows = db.execute(q).all()

    users_seen: set[str] = set()
    total_sent = 0

    for task, resolution in rows:
        user_id = resolution.user_id
        if not allow_task_reminders(db, user_id):
            continue
        tokens = db.scalars(
            select(DevicePushToken).where(
                DevicePushToken.user_id == user_id,
                DevicePushToken.invalidated_at.is_(None),
            )
        ).all()
        if not tokens:
            continue

        title = "Sarthi"
        body = f"Reminder: {task.title}"[:180]
        messages = [
            {
                "to": t.expo_push_token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": {
                    "type": "task_reminder",
                    "task_id": str(task.id),
                },
            }
            for t in tokens
        ]
        result = send_expo_push_batch(db, settings, user_id, messages)
        if result.ok > 0:
            task.reminder_sent_at = now
            db.add(task)
            users_seen.add(str(user_id))
            total_sent += result.ok

    # Caller commits (scheduler, ops API) so transaction boundaries stay explicit.
    return ReminderJobStats(users_notified=len(users_seen), pushes_sent=total_sent)
