"""Schemas for user preferences endpoints."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PreferencesResponse(BaseModel):
    user_id: UUID
    coaching_paused: bool
    weekly_plans_enabled: bool
    interventions_enabled: bool
    request_id: str


class PreferencesUpdateRequest(BaseModel):
    user_id: UUID
    coaching_paused: Optional[bool] = None
    weekly_plans_enabled: Optional[bool] = None
    interventions_enabled: Optional[bool] = None
