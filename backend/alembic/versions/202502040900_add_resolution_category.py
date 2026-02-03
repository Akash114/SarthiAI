"""add resolution category

Revision ID: 202502040900
Revises: 202502010001_add_notification_tokens
Create Date: 2025-02-04 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202502040900"
down_revision: Union[str, None] = "202502010001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TYPE_TO_CATEGORY = {
    "health": "fitness",
    "habit": "fitness",
    "learning": "learning",
    "project": "hobby",
    "finance": "hobby",
}


def upgrade() -> None:
    op.add_column("resolutions", sa.Column("category", sa.String(length=50), nullable=True))
    connection = op.get_bind()
    for res_type, category in TYPE_TO_CATEGORY.items():
        connection.execute(
            sa.text("UPDATE resolutions SET category = :category WHERE type = :type"),
            {"category": category, "type": res_type},
        )
    connection.execute(sa.text("UPDATE resolutions SET category = 'general' WHERE category IS NULL"))


def downgrade() -> None:
    op.drop_column("resolutions", "category")
