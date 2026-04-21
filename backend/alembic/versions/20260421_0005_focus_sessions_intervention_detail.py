"""Add focus_sessions table and interventions.detail_json.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-21

Required before running the API build that includes ``Intervention.detail_json`` in the ORM;
otherwise ``GET /v1/interventions/current`` fails with undefined column.

Deploy: ``cd backend && alembic upgrade head`` (same DATABASE_URL as the app server).

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "focus_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_seconds", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_focus_sessions_user_id"), "focus_sessions", ["user_id"], unique=False)
    op.add_column(
        "interventions",
        sa.Column("detail_json", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("interventions", "detail_json")
    op.drop_index(op.f("ix_focus_sessions_user_id"), table_name="focus_sessions")
    op.drop_table("focus_sessions")
