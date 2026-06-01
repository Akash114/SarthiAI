from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.brain_dump import BrainDump


class BrainDumpProposal(Base):
    __tablename__ = "brain_dump_proposed_changes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    brain_dump_id: Mapped[UUID] = mapped_column(ForeignKey("brain_dumps.id", ondelete="CASCADE"), index=True)
    change_type: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[UUID | None] = mapped_column(index=True, nullable=True)
    payload_json: Mapped[dict] = mapped_column(JSON)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    brain_dump: Mapped["BrainDump"] = relationship(back_populates="proposals")
