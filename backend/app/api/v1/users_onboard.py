from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from posthog import identify_context, new_context

from app.api.v1.deps import current_user, current_user_id, get_posthog
from app.db import get_db
from app.models.onboarding import UserOnboarding
from app.models.user import User
from app.schemas.api import OnboardingPatchRequest, OnboardingState, User as UserOut
from app.services.idempotency import replay_if_exists, store

router = APIRouter(tags=["users", "onboarding"])


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]) -> UserOut:
    return UserOut.model_validate(user)


@router.get("/onboarding", response_model=OnboardingState)
def get_onboarding(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> OnboardingState:
    ob = db.get(UserOnboarding, user.id)
    if ob is None:
        ob = UserOnboarding(
            user_id=user.id,
            status="not_started",
            step="welcome",
            updated_at=datetime.now(UTC),
        )
        db.add(ob)
        db.commit()
        db.refresh(ob)
    return OnboardingState.model_validate(ob)


@router.patch("/onboarding", response_model=OnboardingState)
def patch_onboarding(
    request: Request,
    body: OnboardingPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    user: Annotated[User, Depends(current_user)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> OnboardingState | Response:
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope="onboarding_patch",
    )
    if replay is not None:
        return replay

    ob = db.get(UserOnboarding, user.id)
    if ob is None:
        ob = UserOnboarding(
            user_id=user.id,
            status="not_started",
            step="welcome",
            updated_at=datetime.now(UTC),
        )
        db.add(ob)
        db.flush()
    if body.step is not None:
        ob.step = body.step
    if ob.status == "not_started" and body.step is not None:
        ob.status = "in_progress"
    if body.mark_completed:
        ob.status = "completed"
    ob.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(ob)
    out = OnboardingState.model_validate(ob)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope="onboarding_patch",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            if body.mark_completed:
                posthog.capture("onboarding completed")
            elif body.step is not None:
                posthog.capture("onboarding step advanced", properties={"step": body.step})
    return out
