"""Auth: register, login, refresh, logout, merge anonymous, /auth/me."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps.auth import require_access_token_user_id
from app.api.schemas.auth import (
    AuthMeResponse,
    LoginRequest,
    LogoutRequest,
    MergeAnonymousRequest,
    MergeAnonymousResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
)
from app.core.config import get_settings
from app.db.deps import get_db
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    get_password_identity_for_user,
    issue_refresh_token,
    login_with_password,
    merge_anonymous_into_authenticated,
    register_with_password,
    revoke_all_refresh_tokens_for_user,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or ""


@router.post("/register", response_model=TokenPairResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_agent: str | None = Header(None, alias="User-Agent"),
) -> TokenPairResponse:
    rid = _request_id(request)
    with trace("auth.register", metadata={"request_id": rid}, request_id=rid):
        try:
            user, _identity = register_with_password(db, payload.email, payload.password)
        except IntegrityError:
            log_metric("auth.register.failure", 1, metadata={"request_id": rid, "reason": "duplicate_email"})
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            ) from None

    access = create_access_token(user.id)
    raw_refresh, _row = issue_refresh_token(db, user.id, user_agent)
    db.commit()

    log_metric("auth.register.success", 1, metadata={"request_id": rid, "user_id": str(user.id)})
    return TokenPairResponse(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=get_settings().access_token_expire_minutes * 60,
        user_id=user.id,
        request_id=rid,
    )


@router.post("/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_agent: str | None = Header(None, alias="User-Agent"),
) -> TokenPairResponse:
    rid = _request_id(request)
    with trace("auth.login", metadata={"request_id": rid}, request_id=rid):
        user = login_with_password(db, payload.email, payload.password)
    if not user:
        log_metric("auth.login.failure", 1, metadata={"request_id": rid})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access = create_access_token(user.id)
    raw_refresh, _row = issue_refresh_token(db, user.id, user_agent)
    db.commit()

    log_metric("auth.login.success", 1, metadata={"request_id": rid, "user_id": str(user.id)})
    return TokenPairResponse(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=get_settings().access_token_expire_minutes * 60,
        user_id=user.id,
        request_id=rid,
    )


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_tokens(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_agent: str | None = Header(None, alias="User-Agent"),
) -> TokenPairResponse:
    rid = _request_id(request)
    with trace("auth.refresh", metadata={"request_id": rid}, request_id=rid):
        rotated = rotate_refresh_token(db, payload.refresh_token.strip(), user_agent)
    if not rotated:
        log_metric("auth.refresh.failure", 1, metadata={"request_id": rid})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    raw_new, user_id = rotated
    access = create_access_token(user_id)
    db.commit()

    log_metric("auth.refresh.success", 1, metadata={"request_id": rid, "user_id": str(user_id)})
    return TokenPairResponse(
        access_token=access,
        refresh_token=raw_new,
        expires_in=get_settings().access_token_expire_minutes * 60,
        user_id=user_id,
        request_id=rid,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(None, alias="Authorization"),
) -> Response:
    """Revoke a specific refresh token in the body, or all refresh tokens when Bearer access token is sent."""
    rid = _request_id(request)
    with trace("auth.logout", metadata={"request_id": rid}, request_id=rid):
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(None, 1)[1].strip()
            try:
                uid = decode_access_token(token)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired access token",
                ) from None
            revoke_all_refresh_tokens_for_user(db, uid)
        elif payload.refresh_token:
            revoke_refresh_token(db, payload.refresh_token.strip())
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide refresh_token in body or Authorization Bearer access token",
            )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=AuthMeResponse)
def auth_me(
    request: Request,
    user_id: UUID = Depends(require_access_token_user_id),
    db: Session = Depends(get_db),
) -> AuthMeResponse:
    rid = _request_id(request)
    identity = get_password_identity_for_user(db, user_id)
    email = identity.login_identifier if identity else None
    return AuthMeResponse(user_id=user_id, email=email, request_id=rid)


@router.post("/merge-anonymous", response_model=MergeAnonymousResponse)
def merge_anonymous(
    payload: MergeAnonymousRequest,
    request: Request,
    db: Session = Depends(get_db),
    authenticated_user_id: UUID = Depends(require_access_token_user_id),
) -> MergeAnonymousResponse:
    rid = _request_id(request)
    with trace(
        "auth.merge_anonymous",
        metadata={
            "request_id": rid,
            "authenticated_user_id": str(authenticated_user_id),
            "anonymous_user_id": str(payload.anonymous_user_id),
        },
        user_id=str(authenticated_user_id),
        request_id=rid,
    ):
        try:
            merged = merge_anonymous_into_authenticated(db, authenticated_user_id, payload.anonymous_user_id)
            db.commit()
        except ValueError as exc:
            db.rollback()
            log_metric(
                "auth.merge.failure",
                1,
                metadata={"request_id": rid, "reason": str(exc)[:200]},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not merged:
        log_metric(
            "auth.merge.skipped",
            1,
            metadata={"request_id": rid, "authenticated_user_id": str(authenticated_user_id)},
        )
        return MergeAnonymousResponse(
            merged=False,
            authenticated_user_id=authenticated_user_id,
            message="Anonymous user already merged or not found",
            request_id=rid,
        )
    log_metric(
        "auth.merge.success",
        1,
        metadata={
            "request_id": rid,
            "authenticated_user_id": str(authenticated_user_id),
            "anonymous_user_id": str(payload.anonymous_user_id),
        },
    )
    return MergeAnonymousResponse(
        merged=True,
        authenticated_user_id=authenticated_user_id,
        message="Anonymous data merged into this account",
        request_id=rid,
    )
