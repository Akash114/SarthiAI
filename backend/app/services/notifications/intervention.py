"""Send intervention prompt notifications."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.device_push import DevicePushToken
from app.models.intervention import Intervention
from app.services.notifications.expo import send_expo_push_batch
from app.services.user_prefs import allow_intervention_push

logger = logging.getLogger(__name__)


def send_intervention_prompt_push(
    db: Session,
    settings: Settings,
    user_id: UUID,
    intervention: Intervention,
) -> None:
    if not settings.notifications_enabled:
        return
    if not allow_intervention_push(db, user_id):
        logger.debug("intervention_push_skipped_prefs user=%s", user_id)
        return
    tokens = db.scalars(
        select(DevicePushToken).where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.invalidated_at.is_(None),
        )
    ).all()
    if not tokens:
        logger.debug("no_push_tokens user=%s", user_id)
        return

    title = "Sarthi"
    body = (intervention.summary or "")[:180]
    messages = [
        {
            "to": t.expo_push_token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {
                "type": "intervention_prompt",
                "intervention_id": str(intervention.id),
            },
        }
        for t in tokens
    ]
    result = send_expo_push_batch(db, settings, user_id, messages)
    logger.info(
        "intervention_push user=%s intervention=%s delivered=%s invalidated=%s",
        user_id,
        intervention.id,
        result.ok,
        result.tokens_invalidated,
    )
