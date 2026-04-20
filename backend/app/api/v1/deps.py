from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.db import get_db
from app.models.user import User
from app.security.jwt_tokens import parse_user_id_from_access

security = HTTPBearer(auto_error=False)


def _rid(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


async def current_user_id(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> UUID:
    rid = _rid(request)
    if creds is None or creds.scheme.lower() != "bearer":
        raise ApiError(
            401,
            code="unauthorized",
            message="Missing or invalid Authorization header",
            request_id=rid,
        )
    try:
        uid = parse_user_id_from_access(creds.credentials)
    except ValueError:
        raise ApiError(
            401,
            code="invalid_token",
            message="Invalid or expired access token",
            request_id=rid,
        ) from None
    user = db.get(User, uid)
    if user is None:
        raise ApiError(
            401,
            code="user_not_found",
            message="User no longer exists",
            request_id=rid,
        )
    return uid


async def current_user(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    uid = await current_user_id(request, creds, db)
    return db.get(User, uid)  # type: ignore[return-value]
