from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.resolution import Resolution


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    resolution_id: Mapped[UUID] = mapped_column(ForeignKey("resolutions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="open")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    due_window_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_window_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resolution: Mapped["Resolution"] = relationship(back_populates="tasks")
