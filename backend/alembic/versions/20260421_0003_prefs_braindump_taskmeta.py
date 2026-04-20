"""user coaching preferences, brain_dumps, task metadata_json

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_coaching_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("coaching_paused", sa.Boolean(), nullable=False),
        sa.Column("task_reminders_enabled", sa.Boolean(), nullable=False),
        sa.Column("interventions_enabled", sa.Boolean(), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "brain_dumps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("signals_extracted", sa.JSON(), nullable=False),
        sa.Column("actionable", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_brain_dumps_user_id"), "brain_dumps", ["user_id"], unique=False)
    op.add_column("tasks", sa.Column("metadata_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "metadata_json")
    op.drop_index(op.f("ix_brain_dumps_user_id"), table_name="brain_dumps")
    op.drop_table("brain_dumps")
    op.drop_table("user_coaching_preferences")
