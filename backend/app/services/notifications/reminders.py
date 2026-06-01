"""Create and send companion task reminders."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.companion_notification import CompanionNotification
from app.models.device_push import DevicePushToken
from app.models.task import Task
from app.services.notifications.expo import send_expo_push_batch
from app.services.user_prefs import allow_task_reminders


@dataclass
class ReminderJobStats:
    users_notified: int
    pushes_sent: int
    records_created: int


def _recipient_user_id(task: Task):
    return task.assignee_user_id or task.user_id or task.created_by_user_id


def run_task_reminder_scan(db: Session, settings: Settings) -> ReminderJobStats:
    now = datetime.now(UTC)
    lookahead = now + timedelta(minutes=max(1, settings.task_reminder_lookahead_minutes))
    tasks = db.scalars(
        select(Task).where(
            Task.status == "open",
            Task.reminder_sent_at.is_(None),
            Task.due_at.isnot(None),
            Task.due_at >= now,
            Task.due_at <= lookahead,
        )
    ).all()

    users_seen: set[str] = set()
    pushes_sent = 0
    records_created = 0
    for task in tasks:
        user_id = _recipient_user_id(task)
        if user_id is None or not allow_task_reminders(db, user_id):
            continue
        notification = CompanionNotification(
            user_id=user_id,
            team_id=task.team_id,
            goal_id=task.goal_id,
            task_id=task.id,
            kind="task_due",
            title="Task due soon",
            body=task.title[:500],
            status="pending",
        )
        db.add(notification)
        records_created += 1
        tokens = db.scalars(
            select(DevicePushToken).where(DevicePushToken.user_id == user_id, DevicePushToken.invalidated_at.is_(None))
        ).all()
        if settings.notifications_enabled and tokens:
            result = send_expo_push_batch(
                db,
                settings,
                user_id,
                [
                    {
                        "to": token.expo_push_token,
                        "title": notification.title,
                        "body": notification.body,
                        "sound": "default",
                        "data": {"type": "task_due", "task_id": str(task.id)},
                    }
                    for token in tokens
                ],
            )
            pushes_sent += result.ok
            if result.ok:
                notification.status = "sent"
                notification.sent_at = now
        task.reminder_sent_at = now
        users_seen.add(str(user_id))
    return ReminderJobStats(users_notified=len(users_seen), pushes_sent=pushes_sent, records_created=records_created)
