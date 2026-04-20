"""User coaching preferences (reminders / interventions gating)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user_coaching_preferences import UserCoachingPreferences


def get_or_create_prefs(db: Session, user_id: UUID) -> UserCoachingPreferences:
    row = db.get(UserCoachingPreferences, user_id)
    if row is None:
        row = UserCoachingPreferences(
            user_id=user_id,
            coaching_paused=False,
            task_reminders_enabled=True,
            interventions_enabled=True,
            updated_at=datetime.now(UTC),
        )
        db.add(row)
        db.flush()
    return row


def allow_task_reminders(db: Session, user_id: UUID) -> bool:
    p = db.get(UserCoachingPreferences, user_id)
    if p is None:
        return True
    if p.coaching_paused:
        return False
    return bool(p.task_reminders_enabled)


def allow_intervention_push(db: Session, user_id: UUID) -> bool:
    p = db.get(UserCoachingPreferences, user_id)
    if p is None:
        return True
    if p.coaching_paused:
        return False
    return bool(p.interventions_enabled)
