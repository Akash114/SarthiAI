from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.goal import Goal
    from app.models.task import Task
    from app.models.team_member import TeamMember
    from app.models.user import User


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    invite_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id])
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="team", cascade="all, delete-orphan")
