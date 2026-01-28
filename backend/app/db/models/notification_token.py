"""Notification push token ORM model."""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class NotificationToken(Base):
    __tablename__ = "notification_tokens"
    __table_args__ = (Index("ix_notification_tokens_user_id", "user_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(length=255), nullable=False, unique=True)
    platform = Column(String(length=20), nullable=True)
    device_name = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
