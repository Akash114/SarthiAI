"""Pydantic schemas for brain dump API."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BrainDumpRequest(BaseModel):
    user_id: UUID
    text: str = Field(..., min_length=1, max_length=2000)


class BrainDumpSignals(BaseModel):
    sentiment_score: float = Field(..., ge=-1.0, le=1.0)
    emotions: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)
    actionable_items: List[str] = Field(default_factory=list)
    acknowledgement: str


class BrainDumpResponse(BaseModel):
    id: UUID
    acknowledgement: str
    signals: BrainDumpSignals
    actionable: bool
