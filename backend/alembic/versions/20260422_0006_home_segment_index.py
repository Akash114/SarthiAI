"""Add home_segment_index to user coaching preferences.

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-22
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_coaching_preferences",
        sa.Column("home_segment_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("user_coaching_preferences", "home_segment_index", server_default=None)


def downgrade() -> None:
    op.drop_column("user_coaching_preferences", "home_segment_index")
