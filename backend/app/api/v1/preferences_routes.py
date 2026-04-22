"""Coaching preferences (reminders / intervention nudges)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from posthog import identify_context, new_context
from sqlalchemy.orm import Session

from app.api.v1.deps import _rid, current_user_id, get_posthog
from app.db import get_db
from app.schemas.api import CoachingPreferencesPatchRequest, CoachingPreferencesState
from app.services.idempotency import replay_if_exists, store
from app.services.user_prefs import get_or_create_prefs

router = APIRouter(tags=["preferences"])


@router.get("/preferences", response_model=CoachingPreferencesState)
def preferences_get(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> CoachingPreferencesState:
    p = get_or_create_prefs(db, user_id)
    db.commit()
    db.refresh(p)
    return CoachingPreferencesState.model_validate(p)


@router.patch("/preferences", response_model=CoachingPreferencesState)
def preferences_patch(
    request: Request,
    body: CoachingPreferencesPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
    posthog=Depends(get_posthog),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> CoachingPreferencesState | Response:
    _ = _rid(request)
    replay = replay_if_exists(
        db,
        user_id=user_id,
        idempotency_key=idempotency_key,
        scope="preferences_patch",
    )
    if replay is not None:
        return replay
    p = get_or_create_prefs(db, user_id)
    if body.coaching_paused is not None:
        p.coaching_paused = body.coaching_paused
    if body.task_reminders_enabled is not None:
        p.task_reminders_enabled = body.task_reminders_enabled
    if body.interventions_enabled is not None:
        p.interventions_enabled = body.interventions_enabled
    if body.timezone is not None:
        p.timezone = body.timezone or None
    if body.work_hours_start is not None:
        p.work_hours_start = body.work_hours_start or None
    if body.work_hours_end is not None:
        p.work_hours_end = body.work_hours_end or None
    if body.work_days is not None:
        p.work_days = body.work_days or None
    if body.personal_slots is not None:
        p.personal_slots = body.personal_slots or None
    if body.home_segment_index is not None:
        p.home_segment_index = body.home_segment_index
    p.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(p)
    out = CoachingPreferencesState.model_validate(p)
    if idempotency_key and len(idempotency_key) >= 8:
        store(
            db,
            user_id=user_id,
            idempotency_key=idempotency_key,
            scope="preferences_patch",
            response_status=200,
            body=out.model_dump(mode="json"),
        )
        db.commit()
    if posthog is not None:
        with new_context():
            identify_context(str(user_id))
            posthog.capture("coaching preferences updated")
    return out
