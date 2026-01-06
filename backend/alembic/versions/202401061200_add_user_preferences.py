"""add user preferences table"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "202401061200"
down_revision = "202410041200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("coaching_paused", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("weekly_plans_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("interventions_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
