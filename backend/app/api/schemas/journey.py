"""Pydantic schemas for the daily journey widget."""
from __future__ import annotations

from typing import List
from uuid import UUID

from pydantic import BaseModel


class JourneyCategoryPayload(BaseModel):
    category: str
    display_name: str
    resolution_title: str
    total_tasks: int
    completed_tasks: int


class DailyJourneyResponse(BaseModel):
    user_id: UUID
    categories: List[JourneyCategoryPayload]
    request_id: str
