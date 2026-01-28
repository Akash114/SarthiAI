"""Task reminder notification service."""
from __future__ import annotations

import json
import os
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, time as dt_time
from typing import Iterable, List, Tuple

import httpx
import openai
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.resolution import Resolution
from app.db.models.task import Task
from app.db.models.user_preferences import UserPreferences
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.notification_tokens import fetch_user_tokens

_REMINDER_KEY = "reminder_sent_at"
_tz = ZoneInfo(settings.scheduler_timezone)
logger = logging.getLogger(__name__)


@dataclass
class ReminderCandidate:
    task: Task
    scheduled_at: datetime


@dataclass
class ReminderRunStats:
    users_processed: int
    snapshots_written: int
    skipped_due_to_preferences: int = 0


def run_task_reminder_check(db: Session) -> ReminderRunStats:
    """Find due tasks and send reminders."""
    if not settings.notifications_enabled:
        return ReminderRunStats(users_processed=0, snapshots_written=0)

    now = datetime.now(timezone.utc)
    lookahead = now + timedelta(minutes=settings.task_reminder_lookahead_minutes)
    candidates = _gather_candidates(db, now, lookahead)
    if not candidates:
        logger.debug("Task reminder job found no upcoming tasks in window.")
        return ReminderRunStats(users_processed=0, snapshots_written=0)

    users_notified: set[str] = set()
    notifications_sent = 0

    for candidate in candidates:
        task = candidate.task
        metadata = dict(task.metadata_json or {})
        if metadata.get(_REMINDER_KEY):
            continue
        tokens = fetch_user_tokens(db, task.user_id)
        if not tokens:
            continue

        message = _generate_message(db, task, candidate.scheduled_at)
        if not message:
            continue

        payloads = [
            {
                "to": token.token,
                "title": "Sarathi AI",
                "body": message,
                "sound": "default",
            }
            for token in tokens
            if token.active
        ]
        if not payloads:
            continue

        if not _preferences_allow_reminder(db, task.user_id):
            continue

        with trace(
            "notifications.task_reminder",
            metadata={"user_id": str(task.user_id), "task_id": str(task.id)},
            user_id=str(task.user_id),
        ):
            _dispatch(payloads)
            metadata[_REMINDER_KEY] = now.isoformat()
            task.metadata_json = metadata
            db.add(task)
            db.commit()
            users_notified.add(str(task.user_id))
            notifications_sent += len(payloads)
            logger.info(
                "Task reminder sent user=%s task=%s tokens=%s scheduled_at=%s",
                task.user_id,
                task.id,
                len(payloads),
                candidate.scheduled_at.isoformat(),
            )

    if notifications_sent:
        log_metric("task_reminders.sent", notifications_sent, metadata={})
    else:
        logger.info("Task reminder check completed with no notifications.")
    return ReminderRunStats(users_processed=len(users_notified), snapshots_written=notifications_sent)


def _gather_candidates(db: Session, window_start: datetime, window_end: datetime) -> List[ReminderCandidate]:
    start_day = window_start.date()
    end_day = window_end.date()
    rows: List[Task] = (
        db.query(Task)
        .filter(
            Task.scheduled_day.isnot(None),
            Task.scheduled_time.isnot(None),
            Task.completed.is_(False),
            Task.scheduled_day >= min(start_day, end_day),
            Task.scheduled_day <= max(start_day, end_day),
        )
        .all()
    )
    candidates: List[ReminderCandidate] = []
    for task in rows:
        metadata = dict(task.metadata_json or {})
        if metadata.get("draft"):
            continue
        scheduled_at = _combine_datetime(task.scheduled_day, task.scheduled_time)
        if not scheduled_at:
            continue
        if window_start <= scheduled_at <= window_end:
            if metadata.get(_REMINDER_KEY):
                continue
            candidates.append(ReminderCandidate(task=task, scheduled_at=scheduled_at))
    return candidates


def _combine_datetime(day: date | None, scheduled_time: dt_time | None) -> datetime | None:
    if not day or not scheduled_time:
        return None
    local_dt = datetime.combine(day, scheduled_time)
    if scheduled_time.tzinfo:
        aware = local_dt.astimezone(timezone.utc)
    else:
        aware = local_dt.replace(tzinfo=_tz).astimezone(timezone.utc)
    return aware


def _generate_message(db: Session, task: Task, scheduled_at: datetime) -> str:
    goals = _load_goal_context(db, task.user_id)
    base_prompt = (
        "You are Sarathi AI, a compassionate accountability partner. "
        "Compose a short, inspiring reminder (max 30 words) that nudges the user to complete their task. "
        "Reference their broader resolution when possible and keep the tone gentle yet confident."
    )
    task_context = f"Task: {task.title}\nScheduled Time (UTC): {scheduled_at.isoformat()}"
    if goals:
        task_context += f"\nTop Goals: {', '.join(goals)}"

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_message(task.title, goals)

    client = openai.OpenAI(api_key=api_key)
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.7,
            messages=[
                {"role": "system", "content": base_prompt},
                {"role": "user", "content": task_context},
            ],
        )
        content = completion.choices[0].message.content if completion.choices else None
        if content:
            return content.strip()
    except Exception:
        pass
    return _fallback_message(task.title, goals)


def _fallback_message(task_title: str, goals: list[str]) -> str:
    if goals:
        return f"Quick nudge: finishing “{task_title}” keeps your {goals[0]} momentum alive."
    return f"Quick nudge: it's time for “{task_title}”. You've got this."


def _load_goal_context(db: Session, user_id) -> list[str]:
    rows = (
        db.query(Resolution)
        .filter(Resolution.user_id == user_id, Resolution.status == "active")
        .order_by(Resolution.updated_at.desc())
        .limit(3)
        .all()
    )
    return [row.title for row in rows]


def _dispatch(payloads: list[dict]) -> None:
    if not payloads:
        return
    headers = {"accept": "application/json", "content-type": "application/json"}
    with httpx.Client(timeout=5) as client:
        response = client.post(settings.expo_push_url, json=payloads, headers=headers)
        if response.status_code >= 400:
            raise RuntimeError(f"Failed to send push notification: {response.text}")


def _preferences_allow_reminder(db: Session, user_id) -> bool:
    prefs = db.get(UserPreferences, user_id)
    if not prefs:
        return True
    if prefs.coaching_paused:
        return False
    if not prefs.weekly_plans_enabled:
        return False
    return True
