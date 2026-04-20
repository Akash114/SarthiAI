from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.onboarding import UserOnboarding
    from app.models.refresh_token import RefreshToken
    from app.models.resolution import Resolution


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    onboarding: Mapped[UserOnboarding | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    resolutions: Mapped[list[Resolution]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
