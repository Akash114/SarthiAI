"""Helpers for working with users."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.services.availability_profile import DEFAULT_AVAILABILITY_PROFILE, DEFAULT_PERSONAL_SLOTS


def get_or_create_user(db: Session, user_id: UUID) -> User:
    """Fetch an existing user or create a new row safely."""
    user = db.get(User, user_id)
    default_profile = {
        **DEFAULT_AVAILABILITY_PROFILE,
        "personal_slots": dict(DEFAULT_PERSONAL_SLOTS),
    }
    if user:
        if getattr(user, "availability_profile", None) is None:
            user.availability_profile = default_profile
            db.add(user)
            db.flush()
        return user

    user = User(id=user_id, availability_profile=default_profile)
    db.add(user)
    try:
        db.flush()
        return user
    except IntegrityError:
        db.rollback()
        existing = db.get(User, user_id)
        if existing:
            return existing
        raise
