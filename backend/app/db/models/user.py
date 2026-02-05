"""User ORM model."""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.db.types import JSONBCompat


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    availability_profile = Column(JSONBCompat, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
