"""Shared keyset cursor encoding for list endpoints."""

from __future__ import annotations

import base64
import json
from datetime import datetime
from uuid import UUID


def encode_cursor(created_at: datetime, row_id: UUID) -> str:
    raw = json.dumps({"t": created_at.isoformat(), "id": str(row_id)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cur: str | None) -> tuple[datetime, UUID] | None:
    if not cur:
        return None
    try:
        raw = base64.urlsafe_b64decode(cur.encode()).decode()
        d = json.loads(raw)
        return datetime.fromisoformat(d["t"]), UUID(d["id"])
    except (ValueError, json.JSONDecodeError, KeyError):
        return None
