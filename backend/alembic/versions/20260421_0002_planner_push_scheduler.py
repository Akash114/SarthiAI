"""planner metadata, push token invalidation, reminders, plan snapshots

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("resolutions", sa.Column("plan_metadata_json", sa.JSON(), nullable=True))
    op.add_column(
        "device_push_tokens",
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "plan_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("resolution_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("planner_version", sa.String(length=64), nullable=False),
        sa.Column("tasks_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["resolution_id"], ["resolutions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plan_snapshots_user_id"), "plan_snapshots", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_plan_snapshots_resolution_id"),
        "plan_snapshots",
        ["resolution_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_plan_snapshots_created_at"),
        "plan_snapshots",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_plan_snapshots_created_at"), table_name="plan_snapshots")
    op.drop_index(op.f("ix_plan_snapshots_resolution_id"), table_name="plan_snapshots")
    op.drop_index(op.f("ix_plan_snapshots_user_id"), table_name="plan_snapshots")
    op.drop_table("plan_snapshots")
    op.drop_column("tasks", "reminder_sent_at")
    op.drop_column("device_push_tokens", "invalidated_at")
    op.drop_column("resolutions", "plan_metadata_json")
