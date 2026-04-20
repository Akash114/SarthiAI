from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.idempotency import IdempotencyRecord


def replay_if_exists(
    db: Session,
    *,
    user_id: UUID,
    idempotency_key: str | None,
    scope: str,
) -> JSONResponse | None:
    if not idempotency_key or len(idempotency_key) < 8:
        return None
    row = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.idempotency_key == idempotency_key,
            IdempotencyRecord.scope == scope,
        )
    )
    if row is None:
        return None
    return JSONResponse(
        status_code=row.response_status,
        content=json.loads(row.response_body),
    )


def store(
    db: Session,
    *,
    user_id: UUID,
    idempotency_key: str | None,
    scope: str,
    response_status: int,
    body: dict[str, Any],
) -> None:
    if not idempotency_key or len(idempotency_key) < 8:
        return
    row = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.idempotency_key == idempotency_key,
            IdempotencyRecord.scope == scope,
        )
    )
    payload = json.dumps(body)
    if row:
        row.response_status = response_status
        row.response_body = payload
    else:
        db.add(
            IdempotencyRecord(
                user_id=user_id,
                idempotency_key=idempotency_key,
                scope=scope,
                response_status=response_status,
                response_body=payload,
            )
        )
