"""Helpers for user preferences."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.agent_action_log import AgentActionLog
from app.db.models.user_preferences import UserPreferences
from app.services.user_service import get_or_create_user
from app.services.availability_profile import sanitize_availability_profile


DEFAULTS = {
    "coaching_paused": False,
    "weekly_plans_enabled": True,
    "interventions_enabled": True,
}


def get_or_create_preferences(db: Session, user_id: UUID) -> UserPreferences:
    prefs = db.get(UserPreferences, user_id)
    user = get_or_create_user(db, user_id)

    if not prefs:
        prefs = UserPreferences(user_id=user_id, **DEFAULTS)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    profile = sanitize_availability_profile(getattr(user, "availability_profile", None))
    setattr(prefs, "availability_profile", profile)
    return prefs


def update_preferences(
    db: Session,
    *,
    user_id: UUID,
    coaching_paused: Optional[bool] = None,
    weekly_plans_enabled: Optional[bool] = None,
    interventions_enabled: Optional[bool] = None,
    availability_profile: Optional[dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> UserPreferences:
    prefs = get_or_create_preferences(db, user_id)
    user = get_or_create_user(db, user_id)
    changed: dict[str, Any] = {}

    if coaching_paused is not None and coaching_paused != prefs.coaching_paused:
        prefs.coaching_paused = coaching_paused
        changed["coaching_paused"] = coaching_paused
    if weekly_plans_enabled is not None and weekly_plans_enabled != prefs.weekly_plans_enabled:
        prefs.weekly_plans_enabled = weekly_plans_enabled
        changed["weekly_plans_enabled"] = weekly_plans_enabled
    if interventions_enabled is not None and interventions_enabled != prefs.interventions_enabled:
        prefs.interventions_enabled = interventions_enabled
        changed["interventions_enabled"] = interventions_enabled

    if availability_profile is not None:
        normalized_profile = sanitize_availability_profile(availability_profile)
        existing_profile = sanitize_availability_profile(getattr(user, "availability_profile", None))
        if normalized_profile != existing_profile:
            user.availability_profile = normalized_profile
            db.add(user)
            changed["availability_profile"] = normalized_profile
            setattr(prefs, "availability_profile", normalized_profile)

    if "availability_profile" not in changed:
        setattr(prefs, "availability_profile", sanitize_availability_profile(getattr(user, "availability_profile", None)))

    if changed:
        db.add(prefs)
        log = AgentActionLog(
            user_id=user_id,
            action_type="preferences_updated",
            action_payload={"changes": changed, "request_id": request_id or ""},
            reason="User updated autonomy settings",
            undo_available=True,
        )
        db.add(log)
        db.commit()
        db.refresh(prefs)
    return prefs
