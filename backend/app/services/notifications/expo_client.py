"""Shared Expo Push API client: batch send, ticket parsing, token deactivation."""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.notification_tokens import deactivate_tokens
from app.services.notifications.base import NotificationResult

logger = logging.getLogger(__name__)

# Expo ticket `details.error` values that indicate the push token should not be reused.
_DEACTIVATE_TICKET_ERRORS = frozenset(
    {
        "DeviceNotRegistered",
        "InvalidCredentials",
        "ExponentPushTokenError",
        "InvalidPushToken",
    }
)

_EXPO_CHUNK_SIZE = 100


def send_expo_push_batch(
    db: Session,
    user_id: UUID,
    messages: list[dict[str, Any]],
) -> NotificationResult:
    """
    Send one or more Expo push messages (each dict must include ``to``).
    Responses are aligned by index with ``messages``; invalid tokens are deactivated.
    """
    if not messages:
        return NotificationResult(
            status="skipped",
            reason="no messages",
            tokens_attempted=0,
            tokens_ok=0,
            tokens_deactivated=0,
            retryable=False,
        )

    attempted = len(messages)
    tokens_ok_total = 0
    all_bad_tokens: list[str] = []
    last_transport_reason = ""
    last_retryable = False

    for offset in range(0, len(messages), _EXPO_CHUNK_SIZE):
        chunk = messages[offset : offset + _EXPO_CHUNK_SIZE]
        partial = _post_expo_chunk(chunk)
        if partial["http_failed"]:
            last_transport_reason = partial.get("reason", "expo request failed")
            last_retryable = bool(partial.get("retryable"))
            if partial.get("bad_tokens"):
                deactivate_tokens(db, user_id=user_id, tokens=partial["bad_tokens"])
            return NotificationResult(
                status="failed",
                reason=last_transport_reason,
                tokens_attempted=attempted,
                tokens_ok=tokens_ok_total,
                tokens_deactivated=len(partial["bad_tokens"]),
                retryable=last_retryable,
            )
        tokens_ok_total += partial["tokens_ok"]
        all_bad_tokens.extend(partial["bad_tokens"])

    deactivated_count = 0
    if all_bad_tokens:
        deactivated_count = deactivate_tokens(db, user_id=user_id, tokens=all_bad_tokens)

    if tokens_ok_total == 0:
        return NotificationResult(
            status="failed",
            reason="all push tickets failed",
            tokens_attempted=attempted,
            tokens_ok=0,
            tokens_deactivated=deactivated_count,
            retryable=False,
        )
    if tokens_ok_total < attempted:
        return NotificationResult(
            status="partial",
            reason="some devices failed",
            tokens_attempted=attempted,
            tokens_ok=tokens_ok_total,
            tokens_deactivated=deactivated_count,
            retryable=False,
        )
    return NotificationResult(
        status="sent",
        reason="ok",
        tokens_attempted=attempted,
        tokens_ok=tokens_ok_total,
        tokens_deactivated=deactivated_count,
        retryable=False,
    )


def _post_expo_chunk(chunk: list[dict[str, Any]]) -> dict[str, Any]:
    headers = {"accept": "application/json", "content-type": "application/json"}
    if settings.expo_access_token:
        headers["authorization"] = f"Bearer {settings.expo_access_token}"

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(settings.expo_push_url, json=chunk, headers=headers)
    except httpx.RequestError as exc:
        logger.warning("Expo push transport error: %s", exc)
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": str(exc),
            "retryable": True,
        }

    if response.status_code == 429:
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": "rate limited",
            "retryable": True,
        }
    if response.status_code >= 500:
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": f"expo HTTP {response.status_code}",
            "retryable": True,
        }
    if response.status_code >= 400:
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": f"expo HTTP {response.status_code}",
            "retryable": False,
        }

    try:
        body = response.json()
    except ValueError:
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": "invalid JSON from expo",
            "retryable": False,
        }

    if body.get("errors"):
        errs = body["errors"]
        msg = errs[0] if isinstance(errs, list) and errs else str(errs)
        return {
            "tokens_ok": 0,
            "bad_tokens": [],
            "http_failed": True,
            "reason": str(msg),
            "retryable": False,
        }

    tickets = body.get("data") or []
    tokens_ok = 0
    bad_tokens: list[str] = []

    for i, ticket in enumerate(tickets):
        if not isinstance(ticket, dict):
            continue
        status = ticket.get("status")
        if status == "ok":
            tokens_ok += 1
            continue
        if status == "error":
            details = ticket.get("details") or {}
            err_code = details.get("error") if isinstance(details, dict) else None
            push_to = chunk[i].get("to") if i < len(chunk) else None
            if isinstance(push_to, str) and err_code in _DEACTIVATE_TICKET_ERRORS:
                bad_tokens.append(push_to)
            continue

    return {
        "tokens_ok": tokens_ok,
        "bad_tokens": bad_tokens,
        "http_failed": False,
    }
