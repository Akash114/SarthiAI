"""Add work-hours, work-days and personal-slots to coaching preferences.

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_coaching_preferences",
        sa.Column("work_hours_start", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "user_coaching_preferences",
        sa.Column("work_hours_end", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "user_coaching_preferences",
        sa.Column("work_days", sa.JSON(), nullable=True),
    )
    op.add_column(
        "user_coaching_preferences",
        sa.Column("personal_slots", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_coaching_preferences", "personal_slots")
    op.drop_column("user_coaching_preferences", "work_days")
    op.drop_column("user_coaching_preferences", "work_hours_end")
    op.drop_column("user_coaching_preferences", "work_hours_start")
