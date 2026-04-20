"""Expo Push API client (batch send + token invalidation)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.device_push import DevicePushToken

logger = logging.getLogger(__name__)


@dataclass
class ExpoSendResult:
    ok: int
    tokens_invalidated: int
    status_code: int | None
    error: str | None = None


def _expo_tickets_invalid(body: dict[str, Any], messages: list[dict[str, Any]]) -> list[str]:
    """Collect push tokens Expo marks as not registered / invalid."""
    invalid: list[str] = []
    data = body.get("data")
    if not isinstance(data, list):
        return invalid
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        status = item.get("status")
        if status != "error":
            continue
        msg = str(item.get("message", "") or "")
        ml = msg.lower().replace(" ", "")
        unregistered = (
            "notregistered" in ml
            or "devicenotregistered" in ml
            or ("invalid" in ml and "token" in ml)
        )
        if unregistered:
            tok = item.get("to")
            if not isinstance(tok, str) and i < len(messages):
                tok = messages[i].get("to")
            if isinstance(tok, str):
                invalid.append(tok)
    return invalid


def send_expo_push_batch(
    db: Session,
    settings: Settings,
    user_id,
    messages: list[dict[str, Any]],
) -> ExpoSendResult:
    """Send a batch of Expo messages; deactivate tokens Expo rejects."""
    if not settings.notifications_enabled or not messages:
        return ExpoSendResult(ok=0, tokens_invalidated=0, status_code=None, error="notifications_disabled")

    url = settings.expo_push_url.rstrip("/")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if settings.expo_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_access_token}"

    invalidated = 0
    delivered = 0
    last_code: int | None = None
    last_err: str | None = None

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=messages, headers=headers)
            last_code = resp.status_code
            body = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                last_err = str(body.get("errors") or resp.text)[:500]
                logger.warning("expo_push_http_error status=%s body=%s", resp.status_code, last_err)
            else:
                delivered = sum(
                    1
                    for item in (body.get("data") or [])
                    if isinstance(item, dict) and item.get("status") == "ok"
                )
                for raw in _expo_tickets_invalid(body, messages):
                    rows = db.scalars(
                        select(DevicePushToken).where(
                            DevicePushToken.user_id == user_id,
                            DevicePushToken.expo_push_token == raw,
                        )
                    ).all()
                    for row in rows:
                        row.invalidated_at = datetime.now(UTC)
                        invalidated += 1
    except Exception as exc:
        last_err = str(exc)[:500]
        logger.exception("expo_push_failed")

    return ExpoSendResult(
        ok=delivered,
        tokens_invalidated=invalidated,
        status_code=last_code,
        error=last_err,
    )
