from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.resolution import Resolution
    from app.models.user import User


class PlanSnapshot(Base):
    """Stored week-1 plan preview or committed generation for history APIs."""

    __tablename__ = "plan_snapshots"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resolution_id: Mapped[UUID] = mapped_column(ForeignKey("resolutions.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32), index=False)
    planner_version: Mapped[str] = mapped_column(String(64))
    tasks_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)

    user: Mapped["User"] = relationship()
    resolution: Mapped["Resolution"] = relationship()
