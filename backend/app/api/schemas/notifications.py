"""Schemas for notification token management."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class NotificationTokenRequest(BaseModel):
    user_id: UUID
    token: str = Field(..., min_length=10)
    platform: str | None = None
    device_name: str | None = None


class NotificationTokenResponse(BaseModel):
    registered: bool
    request_id: str
