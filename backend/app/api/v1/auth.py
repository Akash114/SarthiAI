from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id
from app.db import get_db
from app.models.onboarding import UserOnboarding
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.api import (
    AuthLoginRequest,
    AuthLogoutRequest,
    AuthRefreshRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
)
from app.security.jwt_tokens import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    new_jti,
    parse_refresh_payload,
)
from app.security.password import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(db: Session, user_id: UUID) -> AuthTokenResponse:
    jti = new_jti()
    access, access_exp = create_access_token(user_id)
    refresh, refresh_exp = create_refresh_token(user_id, jti)
    db.add(
        RefreshToken(
            user_id=user_id,
            jti=jti,
            token_hash=hash_refresh_token(refresh),
            expires_at=refresh_exp,
        )
    )
    db.flush()
    return AuthTokenResponse(
        access_token=access,
        access_expires_at=access_exp,
        refresh_token=refresh,
        refresh_expires_at=refresh_exp,
    )


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
def register(
    request: Request,
    body: AuthRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthTokenResponse:
    from uuid import UUID

    rid = _rid(request)
    email = str(body.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise ApiError(
            409,
            code="email_exists",
            message="Email already registered",
            request_id=rid,
        )
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    db.add(
        UserOnboarding(
            user_id=user.id,
            status="not_started",
            step="welcome",
            updated_at=datetime.now(UTC),
        )
    )
    tokens = _issue_tokens(db, user.id)
    db.commit()
    return tokens


@router.post("/login", response_model=AuthTokenResponse)
def login(
    request: Request,
    body: AuthLoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthTokenResponse:
    rid = _rid(request)
    email = str(body.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise ApiError(
            401,
            code="invalid_credentials",
            message="Invalid email or password",
            request_id=rid,
        )
    tokens = _issue_tokens(db, user.id)
    db.commit()
    return tokens


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(
    request: Request,
    body: AuthRefreshRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthTokenResponse:
    rid = _rid(request)
    try:
        user_id, jti = parse_refresh_payload(body.refresh_token)
    except ValueError:
        raise ApiError(
            401,
            code="invalid_refresh",
            message="Invalid or expired refresh token",
            request_id=rid,
        ) from None
    rt = db.scalar(select(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.user_id == user_id))
    if rt is None or rt.revoked_at is not None:
        raise ApiError(
            401,
            code="invalid_refresh",
            message="Invalid or revoked refresh token",
            request_id=rid,
        )
    if rt.token_hash != hash_refresh_token(body.refresh_token):
        raise ApiError(
            401,
            code="invalid_refresh",
            message="Invalid or revoked refresh token",
            request_id=rid,
        )
    exp = rt.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    if exp < datetime.now(UTC):
        raise ApiError(
            401,
            code="invalid_refresh",
            message="Refresh token expired",
            request_id=rid,
        )
    rt.revoked_at = datetime.now(UTC)
    tokens = _issue_tokens(db, user_id)
    db.commit()
    return tokens


@router.post("/logout", status_code=204, response_class=Response)
def logout(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    _body: AuthLogoutRequest | None = None,
) -> Response:
    """Invalidate all active refresh tokens for this user."""
    for rt in db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    ):
        rt.revoked_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=204)
