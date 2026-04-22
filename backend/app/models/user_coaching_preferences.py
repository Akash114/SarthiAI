from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserCoachingPreferences(Base):
    __tablename__ = "user_coaching_preferences"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    coaching_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    task_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    interventions_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    work_hours_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    work_hours_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    work_days: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    personal_slots: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # 0 = Personal, 1 = Work — synced with mobile Home segmented control
    home_segment_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped["User"] = relationship(back_populates="coaching_preferences")
