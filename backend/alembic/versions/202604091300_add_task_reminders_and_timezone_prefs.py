"""Add task_reminders_enabled and timezone to user_preferences.

Revision ID: 202604091300
Revises: 202504091200
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202604091300"
down_revision: Union[str, None] = "202504091200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "task_reminders_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "timezone")
    op.drop_column("user_preferences", "task_reminders_enabled")
