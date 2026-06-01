from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.brain_dump_proposal import BrainDumpProposal
    from app.models.user import User


class BrainDump(Base):
    __tablename__ = "brain_dumps"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    focus_session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("focus_sessions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    active_task_id: Mapped[UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    active_goal_id: Mapped[UUID | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), nullable=True)
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    signals_extracted: Mapped[dict] = mapped_column(JSON)
    actionable: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    context_snapshot_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User"] = relationship(back_populates="brain_dumps")
    proposals: Mapped[list["BrainDumpProposal"]] = relationship(back_populates="brain_dump", cascade="all, delete-orphan")
