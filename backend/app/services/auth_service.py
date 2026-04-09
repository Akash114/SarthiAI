"""Registration, login, JWT access tokens, refresh rotation, anonymous merge."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.auth_identity import AuthIdentity
from app.db.models.brain_dump import BrainDump
from app.db.models.notification_token import NotificationToken
from app.db.models.refresh_token import RefreshToken
from app.db.models.resolution import Resolution
from app.db.models.task import Task
from app.db.models.user import User
from app.db.models.user_preferences import UserPreferences
from app.services.availability_profile import DEFAULT_AVAILABILITY_PROFILE, DEFAULT_PERSONAL_SLOTS

PASSWORD_PROVIDER = "password"
_ph = PasswordHasher()


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, plain)
    except VerifyMismatchError:
        return False


def _hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_access_token(user_id: UUID) -> str:
    cfg = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=cfg.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def decode_access_token(token: str) -> UUID:
    cfg = get_settings()
    try:
        payload = jwt.decode(
            token,
            cfg.jwt_secret,
            algorithms=[cfg.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid access token") from exc
    if payload.get("typ") != "access":
        raise ValueError("Invalid token type")
    return UUID(payload["sub"])


def issue_refresh_token(db: Session, user_id: UUID, user_agent: str | None) -> tuple[str, RefreshToken]:
    raw = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(raw)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=get_settings().refresh_token_expire_days)
    row = RefreshToken(
        id=uuid4(),
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires,
        revoked_at=None,
        user_agent=user_agent,
    )
    db.add(row)
    db.flush()
    return raw, row


def revoke_refresh_token(db: Session, raw_token: str) -> bool:
    token_hash = _hash_refresh_token(raw_token)
    row = db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).scalar_one_or_none()
    if not row or row.revoked_at:
        return False
    row.revoked_at = datetime.now(timezone.utc)
    db.add(row)
    return True


def revoke_all_refresh_tokens_for_user(db: Session, user_id: UUID) -> int:
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    return result.rowcount or 0


def rotate_refresh_token(db: Session, raw_old: str, user_agent: str | None) -> tuple[str, UUID] | None:
    token_hash = _hash_refresh_token(raw_old)
    row = db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).scalar_one_or_none()
    if not row or row.revoked_at:
        return None
    now = datetime.now(timezone.utc)
    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        return None
    row.revoked_at = now
    db.add(row)
    raw_new, _ = issue_refresh_token(db, row.user_id, user_agent)
    db.flush()
    return raw_new, row.user_id


def register_with_password(db: Session, email: str, password: str) -> tuple[User, AuthIdentity]:
    normalized = email.strip().lower()
    user_id = uuid4()
    default_profile = {
        **DEFAULT_AVAILABILITY_PROFILE,
        "personal_slots": dict(DEFAULT_PERSONAL_SLOTS),
    }
    user = User(id=user_id, availability_profile=default_profile)
    identity = AuthIdentity(
        id=uuid4(),
        user_id=user_id,
        provider=PASSWORD_PROVIDER,
        provider_subject=None,
        login_identifier=normalized,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()
    db.add(identity)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(user)
    db.refresh(identity)
    return user, identity


def login_with_password(db: Session, email: str, password: str) -> User | None:
    normalized = email.strip().lower()
    row = db.execute(
        select(AuthIdentity).where(
            AuthIdentity.provider == PASSWORD_PROVIDER,
            AuthIdentity.login_identifier == normalized,
        )
    ).scalar_one_or_none()
    if not row or not row.password_hash:
        return None
    if not verify_password(password, row.password_hash):
        return None
    user = db.get(User, row.user_id)
    return user


def get_password_identity_for_user(db: Session, user_id: UUID) -> AuthIdentity | None:
    return db.execute(
        select(AuthIdentity).where(AuthIdentity.user_id == user_id, AuthIdentity.provider == PASSWORD_PROVIDER)
    ).scalar_one_or_none()


def anonymous_user_has_no_credentials(db: Session, user_id: UUID) -> bool:
    n = db.execute(select(AuthIdentity.id).where(AuthIdentity.user_id == user_id).limit(1)).first()
    return n is None


def merge_anonymous_into_authenticated(db: Session, authenticated_user_id: UUID, anonymous_user_id: UUID) -> bool:
    """
    Move all rows from anonymous_user_id to authenticated_user_id, then delete anonymous user.
    Idempotent: if anonymous user does not exist, returns False (already merged).
    """
    if authenticated_user_id == anonymous_user_id:
        raise ValueError("Cannot merge a user into itself")

    anon = db.get(User, anonymous_user_id)
    if not anon:
        return False

    auth_user = db.get(User, authenticated_user_id)
    if not auth_user:
        raise ValueError("Authenticated user not found")

    if not get_password_identity_for_user(db, authenticated_user_id):
        raise ValueError("Authenticated user has no password identity")

    if not anonymous_user_has_no_credentials(db, anonymous_user_id):
        raise ValueError("Anonymous user already has credentials")

    # Prefer moving anonymous data: drop prefs on auth if any, then reassign anon rows.
    db.execute(delete(UserPreferences).where(UserPreferences.user_id == authenticated_user_id))

    db.execute(
        update(Resolution).where(Resolution.user_id == anonymous_user_id).values(user_id=authenticated_user_id)
    )
    db.execute(
        update(BrainDump).where(BrainDump.user_id == anonymous_user_id).values(user_id=authenticated_user_id)
    )
    db.execute(
        update(AgentActionLog)
        .where(AgentActionLog.user_id == anonymous_user_id)
        .values(user_id=authenticated_user_id)
    )
    db.execute(update(Task).where(Task.user_id == anonymous_user_id).values(user_id=authenticated_user_id))
    db.execute(
        update(UserPreferences)
        .where(UserPreferences.user_id == anonymous_user_id)
        .values(user_id=authenticated_user_id)
    )
    db.execute(
        update(NotificationToken)
        .where(NotificationToken.user_id == anonymous_user_id)
        .values(user_id=authenticated_user_id)
    )

    db.delete(anon)
    db.flush()
    return True
