"""Schemas for intervention preview endpoint."""
from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

class WeekWindowPayload(BaseModel):
    start: date
    end: date


class SlippagePayload(BaseModel):
    flagged: bool
    reason: Optional[str]
    completion_rate: float
    missed_scheduled: int


class InterventionOption(BaseModel):
    key: str
    label: str
    details: str


class InterventionCard(BaseModel):
    title: str
    message: str
    options: List[InterventionOption]


class InterventionPreviewResponse(BaseModel):
    user_id: UUID
    week: WeekWindowPayload
    slippage: SlippagePayload
    card: Optional[InterventionCard] = None
    request_id: str


class InterventionResponse(InterventionPreviewResponse):
    pass


class InterventionRunRequest(BaseModel):
    user_id: UUID
    force: bool = False


class InterventionHistoryItem(BaseModel):
    id: UUID
    created_at: str
    week_start: str
    week_end: str
    flagged: bool
    reason: Optional[str]


class InterventionHistoryResponse(BaseModel):
    user_id: UUID
    items: list[InterventionHistoryItem]
    next_cursor: Optional[str]
    request_id: str


class InterventionHistoryDetailResponse(BaseModel):
    id: UUID
    user_id: UUID
    created_at: str
    week_start: str
    week_end: str
    snapshot: InterventionResponse
    request_id: str
