from __future__ import annotations

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models.auth_identity import AuthIdentity
from app.models.email_verification import EmailVerificationToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.api import AuthMethod, UserProfile
from app.security.jwt_tokens import create_access_token, create_refresh_token, hash_refresh_token, new_jti
from app.security.password import hash_password


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    email_verified: bool
    display_name: str | None = None
    profile_image_url: str | None = None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def user_profile(db: Session, user: User) -> UserProfile:
    identities = db.scalars(
        select(AuthIdentity).where(AuthIdentity.user_id == user.id).order_by(AuthIdentity.created_at)
    ).all()
    return UserProfile(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        profile_image_url=user.profile_image_url,
        profile_source=user.profile_source,
        email_verified_at=user.email_verified_at,
        auth_methods=[
            AuthMethod(provider=identity.provider, verified_at=identity.verified_at)
            for identity in identities
            if identity.verified_at is not None
        ],
    )


def issue_tokens(db: Session, user: User):
    jti = new_jti()
    access, access_exp = create_access_token(user.id)
    refresh, refresh_exp = create_refresh_token(user.id, jti)
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_refresh_token(refresh),
            expires_at=refresh_exp,
        )
    )
    db.flush()
    return access, access_exp, refresh, refresh_exp


def find_or_create_user_for_email(
    db: Session,
    *,
    email: str,
    display_name: str | None = None,
    profile_image_url: str | None = None,
    profile_source: str | None = None,
    verified: bool = False,
) -> User:
    normalized = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized))
    if user is not None:
        if display_name and not user.display_name:
            user.display_name = display_name
        if profile_image_url and not user.profile_image_url:
            user.profile_image_url = profile_image_url
            user.profile_source = profile_source
        if verified and user.email_verified_at is None:
            user.email_verified_at = datetime.now(UTC)
        return user

    now = datetime.now(UTC)
    user = User(
        email=normalized,
        display_name=display_name,
        profile_image_url=profile_image_url,
        profile_source=profile_source,
        email_verified_at=now if verified else None,
    )
    db.add(user)
    db.flush()
    return user


def create_or_replace_password_identity(
    db: Session,
    *,
    user: User,
    email: str,
    password: str,
) -> tuple[AuthIdentity, str]:
    normalized = normalize_email(email)
    identity = db.scalar(
        select(AuthIdentity).where(AuthIdentity.user_id == user.id, AuthIdentity.provider == "password")
    )
    if identity is None:
        identity = AuthIdentity(
            user_id=user.id,
            provider="password",
            provider_subject=normalized,
            password_hash=hash_password(password),
        )
        db.add(identity)
        db.flush()
    else:
        identity.provider_subject = normalized
        identity.password_hash = hash_password(password)
        identity.verified_at = None

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(UTC) + timedelta(minutes=get_settings().email_verification_minutes)
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            identity_id=identity.id,
            email=normalized,
            code_hash=hash_code(code),
            expires_at=expires_at,
        )
    )
    return identity, code


def parse_local_google_token(id_token: str) -> GoogleIdentity | None:
    """Accept JSON/base64 JSON tokens in local tests when no Google client ID is configured."""
    candidates = [id_token]
    try:
        padded = id_token + "=" * (-len(id_token) % 4)
        candidates.append(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        pass

    for raw in candidates:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        sub = data.get("sub") or data.get("subject")
        email = data.get("email")
        if not sub or not email:
            continue
        return GoogleIdentity(
            subject=str(sub),
            email=normalize_email(str(email)),
            email_verified=bool(data.get("email_verified", True)),
            display_name=data.get("name"),
            profile_image_url=data.get("picture"),
        )
    return None


def verify_google_id_token(id_token: str, settings: Settings | None = None) -> GoogleIdentity:
    settings = settings or get_settings()
    allowed = [item.strip() for item in (settings.google_oauth_client_ids or "").split(",") if item.strip()]
    if not allowed:
        local = parse_local_google_token(id_token)
        if local is None:
            raise ValueError("Google auth is not configured")
        return local

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(settings.google_tokeninfo_url, params={"id_token": id_token})
    if resp.status_code >= 400:
        raise ValueError("Invalid Google token")
    data = resp.json()
    aud = str(data.get("aud") or "")
    if aud not in allowed:
        raise ValueError("Google token audience is not allowed")
    email = data.get("email")
    sub = data.get("sub")
    if not email or not sub:
        raise ValueError("Google token missing email or subject")
    email_verified = str(data.get("email_verified", "")).lower() in ("true", "1")
    if not email_verified:
        raise ValueError("Google email is not verified")
    return GoogleIdentity(
        subject=str(sub),
        email=normalize_email(str(email)),
        email_verified=True,
        display_name=data.get("name"),
        profile_image_url=data.get("picture"),
    )


def link_google_identity(db: Session, google: GoogleIdentity) -> User:
    if not google.email_verified:
        raise ValueError("Google email is not verified")
    existing_identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == google.subject,
        )
    )
    if existing_identity is not None:
        user = db.get(User, existing_identity.user_id)
        if user is None:
            raise ValueError("Linked user not found")
        return user

    user = find_or_create_user_for_email(
        db,
        email=google.email,
        display_name=google.display_name,
        profile_image_url=google.profile_image_url,
        profile_source="google" if google.profile_image_url else None,
        verified=True,
    )
    db.add(
        AuthIdentity(
            user_id=user.id,
            provider="google",
            provider_subject=google.subject,
            verified_at=datetime.now(UTC),
        )
    )
    return user
