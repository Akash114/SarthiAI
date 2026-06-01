from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user_coaching_preferences import UserCoachingPreferences

if TYPE_CHECKING:
    from app.models.auth_identity import AuthIdentity
    from app.models.brain_dump import BrainDump
    from app.models.companion_notification import CompanionNotification
    from app.models.email_verification import EmailVerificationToken
    from app.models.focus_session import FocusSession
    from app.models.goal import Goal
    from app.models.refresh_token import RefreshToken
    from app.models.task import Task
    from app.models.team_member import TeamMember


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    profile_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    identities: Mapped[list[AuthIdentity]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    email_verification_tokens: Mapped[list[EmailVerificationToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    coaching_preferences: Mapped[UserCoachingPreferences | None] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    goals: Mapped[list[Goal]] = relationship(
        foreign_keys="Goal.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    created_goals: Mapped[list[Goal]] = relationship(
        foreign_keys="Goal.created_by_user_id",
        back_populates="created_by",
    )
    tasks: Mapped[list[Task]] = relationship(
        foreign_keys="Task.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    created_tasks: Mapped[list[Task]] = relationship(
        foreign_keys="Task.created_by_user_id",
        back_populates="created_by",
    )
    assigned_tasks: Mapped[list[Task]] = relationship(
        foreign_keys="Task.assignee_user_id",
        back_populates="assignee",
    )
    completed_tasks: Mapped[list[Task]] = relationship(
        foreign_keys="Task.completed_by_user_id",
        back_populates="completed_by",
    )
    focus_sessions: Mapped[list[FocusSession]] = relationship(cascade="all, delete-orphan")
    brain_dumps: Mapped[list[BrainDump]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list[CompanionNotification]] = relationship(cascade="all, delete-orphan")
    team_memberships: Mapped[list[TeamMember]] = relationship(
        cascade="all, delete-orphan",
        foreign_keys="TeamMember.user_id",
        back_populates="user",
    )
