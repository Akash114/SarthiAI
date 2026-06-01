from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Intervention(Base):
    __tablename__ = "interventions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    goal_id: Mapped[UUID | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id: Mapped[UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(16), default="medium")
    reason: Mapped[str] = mapped_column(String(120), default="needs_attention")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    summary: Mapped[str] = mapped_column(Text)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
