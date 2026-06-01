from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.db import get_db
from app.models.user import User
from app.schemas.api import ProfilePatchRequest, UserProfile
from app.services.auth_identity import user_profile

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserProfile)
def me(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> UserProfile:
    return user_profile(db, user)


@router.patch("/me", response_model=UserProfile)
def patch_me(
    body: ProfilePatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> UserProfile:
    if body.display_name is not None:
        user.display_name = body.display_name.strip() or None
    if body.profile_image_url is not None:
        user.profile_image_url = body.profile_image_url.strip() or None
        user.profile_source = "user" if user.profile_image_url else None
    user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user_profile(db, user)
