"""User preferences ORM model."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    coaching_paused = Column(Boolean, nullable=False, server_default="false")
    weekly_plans_enabled = Column(Boolean, nullable=False, server_default="true")
    interventions_enabled = Column(Boolean, nullable=False, server_default="true")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
