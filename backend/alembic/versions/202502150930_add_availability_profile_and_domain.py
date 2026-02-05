"""Add availability profile to users and domain to resolutions.

Revision ID: 202502150930
Revises: 202502040900
Create Date: 2025-02-15 09:30:00.000000
"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "202502150930"
down_revision: Union[str, None] = "202502040900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_PROFILE = {
    "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "work_start": "09:00",
    "work_end": "18:00",
    "peak_energy": "morning",
}


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "availability_profile",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "resolutions",
        sa.Column("domain", sa.String(length=20), nullable=False, server_default=sa.text("'personal'")),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE users SET availability_profile = :profile WHERE availability_profile IS NULL"),
        {"profile": json.dumps(DEFAULT_PROFILE)},
    )
    connection.execute(sa.text("UPDATE resolutions SET domain = 'personal' WHERE domain IS NULL"))


def downgrade() -> None:
    op.drop_column("resolutions", "domain")
    op.drop_column("users", "availability_profile")
