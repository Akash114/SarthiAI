"""Schemas for user preferences endpoints."""
from __future__ import annotations

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PersonalSlots(BaseModel):
    fitness: Literal["morning", "afternoon", "evening"] = "morning"
    learning: Literal["morning", "afternoon", "evening"] = "evening"
    admin: Literal["weekend", "evenings"] = "weekend"


class AvailabilityProfile(BaseModel):
    work_days: List[Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]] = Field(
        default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri"]
    )
    work_start: str = "09:00"
    work_end: str = "18:00"
    peak_energy: Literal["morning", "evening"] = "morning"
    work_mode_enabled: bool = False
    personal_slots: PersonalSlots = PersonalSlots()


class PreferencesResponse(BaseModel):
    user_id: UUID
    coaching_paused: bool
    weekly_plans_enabled: bool
    interventions_enabled: bool
    availability_profile: AvailabilityProfile
    request_id: str


class PreferencesUpdateRequest(BaseModel):
    user_id: UUID
    coaching_paused: Optional[bool] = None
    weekly_plans_enabled: Optional[bool] = None
    interventions_enabled: Optional[bool] = None
    availability_profile: Optional[AvailabilityProfile] = None
