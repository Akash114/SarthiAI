from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.goal import Goal
    from app.models.team import Team
    from app.models.user import User


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)",
            name="ck_task_exactly_one_owner",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=True)
    goal_id: Mapped[UUID | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), index=True, nullable=True)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    assignee_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    completed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open")
    priority: Mapped[str] = mapped_column(String(16), default="normal")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    due_window_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_window_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    source: Mapped[str] = mapped_column(String(32), default="manual")
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id], back_populates="tasks")
    team: Mapped["Team | None"] = relationship(back_populates="tasks")
    goal: Mapped["Goal | None"] = relationship(back_populates="tasks")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id], back_populates="created_tasks")
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_user_id], back_populates="assigned_tasks")
    completed_by: Mapped["User | None"] = relationship(foreign_keys=[completed_by_user_id], back_populates="completed_tasks")
