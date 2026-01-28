"""Helper functions for managing notification tokens."""
from __future__ import annotations

from typing import Iterable
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.notification_token import NotificationToken
from app.db.models.user import User


def register_token(
    db: Session,
    *,
    user_id: UUID,
    token: str,
    platform: str | None = None,
    device_name: str | None = None,
) -> NotificationToken:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    model = (
        db.query(NotificationToken)
        .filter(NotificationToken.token == token)
        .one_or_none()
    )
    if model:
        model.user_id = user_id
        model.platform = platform
        model.device_name = device_name
        model.active = True
    else:
        model = NotificationToken(
            user_id=user_id,
            token=token,
            platform=platform,
            device_name=device_name,
        )
        db.add(model)
    db.commit()
    db.refresh(model)
    return model


def deactivate_tokens(db: Session, *, user_id: UUID, tokens: Iterable[str]) -> int:
    entries = (
        db.query(NotificationToken)
        .filter(NotificationToken.user_id == user_id, NotificationToken.token.in_(list(tokens)))
        .all()
    )
    count = 0
    for entry in entries:
        entry.active = False
        db.add(entry)
        count += 1
    if count:
        db.commit()
    return count


def fetch_user_tokens(db: Session, user_id: UUID) -> list[NotificationToken]:
    return (
        db.query(NotificationToken)
        .filter(NotificationToken.user_id == user_id, NotificationToken.active.is_(True))
        .all()
    )
