from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import InvalidTokenError

from app.config import get_settings


def _secret() -> str:
    return get_settings().jwt_secret


def create_access_token(user_id: UUID) -> tuple[str, datetime]:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.access_token_minutes)
    payload = {"sub": str(user_id), "typ": "access", "exp": exp}
    return jwt.encode(payload, _secret(), algorithm="HS256"), exp


def create_refresh_token(user_id: UUID, jti: str) -> tuple[str, datetime]:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(days=s.refresh_token_days)
    payload = {"sub": str(user_id), "typ": "refresh", "jti": jti, "exp": exp}
    return jwt.encode(payload, _secret(), algorithm="HS256"), exp


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=["HS256"])


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_jti() -> str:
    return secrets.token_urlsafe(32)


def parse_user_id_from_access(token: str) -> UUID:
    try:
        data = decode_token(token)
        if data.get("typ") != "access":
            raise ValueError("not access")
        return UUID(str(data["sub"]))
    except (InvalidTokenError, KeyError, ValueError) as e:
        raise ValueError("invalid access token") from e


def parse_refresh_payload(token: str) -> tuple[UUID, str]:
    try:
        data = decode_token(token)
        if data.get("typ") != "refresh":
            raise ValueError("not refresh")
        return UUID(str(data["sub"])), str(data["jti"])
    except (InvalidTokenError, KeyError, ValueError) as e:
        raise ValueError("invalid refresh token") from e
