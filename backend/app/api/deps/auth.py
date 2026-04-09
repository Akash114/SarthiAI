"""Resolve acting user from Bearer JWT and optional legacy query user_id."""
from __future__ import annotations

from uuid import UUID

from fastapi import Header, HTTPException, Query, Request, status

from app.core.config import get_settings
from app.services.auth_service import decode_access_token


def _parse_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def get_effective_user_id(
    request: Request,
    user_id: UUID | None = Query(None, description="Legacy user ID when no Authorization header"),
    authorization: str | None = Header(None, alias="Authorization"),
) -> UUID:
    """Prefer verified JWT; fall back to query user_id only when legacy mode is enabled."""
    _ = request  # reserved for future request-scoped audit
    settings = get_settings()
    if not settings.auth_enabled:
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing user_id (auth disabled for development)",
            )
        return user_id
    bearer = _parse_bearer(authorization)
    if bearer:
        try:
            uid = decode_access_token(bearer)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            ) from exc
        if user_id is not None and user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="user_id does not match credentials",
            )
        return uid
    if settings.auth_legacy_allow_unauthenticated and user_id is not None:
        return user_id
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def require_access_token_user_id(
    authorization: str | None = Header(None, alias="Authorization"),
) -> UUID:
    """Require a valid Bearer access token (no legacy fallback)."""
    bearer = _parse_bearer(authorization)
    if not bearer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return decode_access_token(bearer)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc


def check_user_access(user_id: UUID, authorization: str | None) -> UUID:
    """Allow acting as user_id when Bearer matches, or legacy mode with no Bearer."""
    if not get_settings().auth_enabled:
        return user_id
    bearer = _parse_bearer(authorization)
    if bearer:
        try:
            token_uid = decode_access_token(bearer)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            ) from exc
        if token_uid != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="user_id does not match credentials",
            )
        return user_id
    if get_settings().auth_legacy_allow_unauthenticated:
        return user_id
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
