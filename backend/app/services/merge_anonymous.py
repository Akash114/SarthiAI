"""Merge a pre-account (anonymous) user id into the authenticated account."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.brain_dump import BrainDump
from app.models.device_push import DevicePushToken
from app.models.idempotency import IdempotencyRecord
from app.models.intervention import Intervention
from app.models.onboarding import UserOnboarding
from app.models.plan_snapshot import PlanSnapshot
from app.models.refresh_token import RefreshToken
from app.models.resolution import Resolution
from app.models.transparency import TransparencyEntry
from app.models.user import User
from app.models.user_coaching_preferences import UserCoachingPreferences


class MergeConflictError(Exception):
    """Both accounts have an active/draft resolution."""

    def __init__(self, message: str = "Both accounts have an active resolution") -> None:
        self.message = message
        super().__init__(message)


def merge_anonymous_into_user(db: Session, authenticated_user_id: UUID, anonymous_user_id: UUID) -> bool:
    if authenticated_user_id == anonymous_user_id:
        raise ValueError("Cannot merge a user into itself")
    anon = db.get(User, anonymous_user_id)
    if anon is None:
        return False
    auth = db.get(User, authenticated_user_id)
    if auth is None:
        raise ValueError("Authenticated user not found")

    auth_has = db.scalar(
        select(Resolution.id).where(
            Resolution.user_id == authenticated_user_id,
            Resolution.status.in_(("active", "draft")),
        ).limit(1)
    )
    anon_has = db.scalar(
        select(Resolution.id).where(
            Resolution.user_id == anonymous_user_id,
            Resolution.status.in_(("active", "draft")),
        ).limit(1)
    )
    if auth_has is not None and anon_has is not None:
        raise MergeConflictError()

    db.execute(delete(IdempotencyRecord).where(IdempotencyRecord.user_id == anonymous_user_id))

    for r in db.scalars(select(Resolution).where(Resolution.user_id == anonymous_user_id)).all():
        r.user_id = authenticated_user_id
    for r in db.scalars(select(Intervention).where(Intervention.user_id == anonymous_user_id)).all():
        r.user_id = authenticated_user_id
    for r in db.scalars(select(TransparencyEntry).where(TransparencyEntry.user_id == anonymous_user_id)).all():
        r.user_id = authenticated_user_id
    for r in db.scalars(select(PlanSnapshot).where(PlanSnapshot.user_id == anonymous_user_id)).all():
        r.user_id = authenticated_user_id
    for r in db.scalars(select(BrainDump).where(BrainDump.user_id == anonymous_user_id)).all():
        r.user_id = authenticated_user_id
    db.flush()

    for tok in db.scalars(select(DevicePushToken).where(DevicePushToken.user_id == anonymous_user_id)).all():
        dup = db.scalar(
            select(DevicePushToken).where(
                DevicePushToken.user_id == authenticated_user_id,
                DevicePushToken.expo_push_token == tok.expo_push_token,
            )
        )
        if dup:
            db.delete(tok)
        else:
            tok.user_id = authenticated_user_id

    ob = db.get(UserOnboarding, anonymous_user_id)
    if ob:
        db.delete(ob)
    cp = db.get(UserCoachingPreferences, anonymous_user_id)
    if cp:
        db.delete(cp)

    db.execute(delete(RefreshToken).where(RefreshToken.user_id == anonymous_user_id))
    db.flush()
    # Core delete avoids ORM `User.resolutions` cascade deleting rows we already reassigned.
    db.execute(delete(User).where(User.id == anonymous_user_id))
    db.flush()
    return True
