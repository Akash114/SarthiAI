from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from posthog import identify_context, new_context
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id, get_posthog
from app.db import get_db
from app.models.auth_identity import AuthIdentity
from app.models.email_verification import EmailVerificationToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.api import (
    AuthGoogleRequest,
    AuthLogoutRequest,
    AuthPasswordLoginRequest,
    AuthPasswordRegisterRequest,
    AuthPasswordRegisterResponse,
    AuthPasswordVerifyRequest,
    AuthRefreshRequest,
    AuthTokenResponse,
)
from app.security.jwt_tokens import hash_refresh_token, parse_refresh_payload
from app.security.password import verify_password
from app.services.auth_identity import (
    create_or_replace_password_identity,
    find_or_create_user_for_email,
    hash_code,
    issue_tokens,
    link_google_identity,
    normalize_email,
    user_profile,
    verify_google_id_token,
)
from app.services.auth_rate_limit import enforce_auth_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


def _rate_register(request: Request) -> None:
    enforce_auth_rate_limit(request, "register")


def _rate_login(request: Request) -> None:
    enforce_auth_rate_limit(request, "login")


def _rate_refresh(request: Request) -> None:
    enforce_auth_rate_limit(request, "refresh")


def _token_response(db: Session, user: User) -> AuthTokenResponse:
    access, access_exp, refresh, refresh_exp = issue_tokens(db, user)
    return AuthTokenResponse(
        access_token=access,
        access_expires_at=access_exp,
        refresh_token=refresh,
        refresh_expires_at=refresh_exp,
        user=user_profile(db, user),
    )


@router.post("/password/register", response_model=AuthPasswordRegisterResponse, status_code=201)
def password_register(
    request: Request,
    body: AuthPasswordRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(_rate_register)],
    posthog=Depends(get_posthog),
) -> AuthPasswordRegisterResponse:
    email = normalize_email(str(body.email))
    user = find_or_create_user_for_email(db, email=email, display_name=body.display_name)
    _identity, code = create_or_replace_password_identity(db, user=user, email=email, password=body.password)
    db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user.id))
            posthog.capture("password registration started")
    return AuthPasswordRegisterResponse(
        user_id=user.id,
        email=user.email,
        verification_required=True,
        verification_code=code,
    )


@router.post("/password/verify", response_model=AuthTokenResponse)
def password_verify(
    request: Request,
    body: AuthPasswordVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(_rate_login)],
    posthog=Depends(get_posthog),
) -> AuthTokenResponse:
    rid = _rid(request)
    email = normalize_email(str(body.email))
    token = db.scalar(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.email == email,
            EmailVerificationToken.code_hash == hash_code(body.code),
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
    )
    if token is None:
        raise ApiError(400, code="invalid_verification_code", message="Invalid verification code", request_id=rid)
    expires_at = token.expires_at if token.expires_at.tzinfo else token.expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise ApiError(400, code="verification_expired", message="Verification code expired", request_id=rid)
    identity = db.get(AuthIdentity, token.identity_id)
    user = db.get(User, token.user_id)
    if identity is None or user is None:
        raise ApiError(400, code="invalid_verification_code", message="Invalid verification code", request_id=rid)
    now = datetime.now(UTC)
    token.consumed_at = now
    identity.verified_at = now
    user.email_verified_at = user.email_verified_at or now
    out = _token_response(db, user)
    db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user.id))
            posthog.capture("user signed up", properties={"signup_method": "password"})
    return out


@router.post("/password/login", response_model=AuthTokenResponse)
def password_login(
    request: Request,
    body: AuthPasswordLoginRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(_rate_login)],
    posthog=Depends(get_posthog),
) -> AuthTokenResponse:
    rid = _rid(request)
    email = normalize_email(str(body.email))
    user = db.scalar(select(User).where(User.email == email))
    identity = None
    if user is not None:
        identity = db.scalar(
            select(AuthIdentity).where(AuthIdentity.user_id == user.id, AuthIdentity.provider == "password")
        )
    if (
        user is None
        or identity is None
        or identity.verified_at is None
        or not identity.password_hash
        or not verify_password(body.password, identity.password_hash)
    ):
        raise ApiError(401, code="invalid_credentials", message="Invalid email or password", request_id=rid)
    out = _token_response(db, user)
    db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user.id))
            posthog.capture("user logged in", properties={"login_method": "password"})
    return out


@router.post("/google", response_model=AuthTokenResponse)
def google_login(
    request: Request,
    body: AuthGoogleRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(_rate_login)],
    posthog=Depends(get_posthog),
) -> AuthTokenResponse:
    rid = _rid(request)
    try:
        google = verify_google_id_token(body.id_token)
        user = link_google_identity(db, google)
    except ValueError as exc:
        raise ApiError(401, code="invalid_google_token", message=str(exc), request_id=rid) from exc
    out = _token_response(db, user)
    db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user.id))
            posthog.capture("user logged in", properties={"login_method": "google"})
    return out


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(
    request: Request,
    body: AuthRefreshRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(_rate_refresh)],
) -> AuthTokenResponse:
    rid = _rid(request)
    try:
        user_id, jti = parse_refresh_payload(body.refresh_token)
    except ValueError:
        raise ApiError(401, code="invalid_refresh", message="Invalid or expired refresh token", request_id=rid) from None
    rt = db.scalar(select(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.user_id == user_id))
    if rt is None or rt.revoked_at is not None or rt.token_hash != hash_refresh_token(body.refresh_token):
        raise ApiError(401, code="invalid_refresh", message="Invalid or revoked refresh token", request_id=rid)
    expires_at = rt.expires_at if rt.expires_at.tzinfo else rt.expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise ApiError(401, code="invalid_refresh", message="Refresh token expired", request_id=rid)
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(401, code="user_not_found", message="User no longer exists", request_id=rid)
    rt.revoked_at = datetime.now(UTC)
    out = _token_response(db, user)
    db.commit()
    return out


@router.post("/logout", status_code=204, response_class=Response)
def logout(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    _body: AuthLogoutRequest | None = None,
) -> Response:
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))):
        rt.revoked_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=204)
