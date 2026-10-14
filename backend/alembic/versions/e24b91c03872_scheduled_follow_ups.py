"""Schedule follow-up email delivery."""
from alembic import op
import sqlalchemy as sa
revision = "e24b91c03872"
down_revision = "d13f80b92761"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("application_follow_ups", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_application_follow_ups_scheduled_at", "application_follow_ups", ["scheduled_at"])


def downgrade():
    op.drop_index("ix_application_follow_ups_scheduled_at", table_name="application_follow_ups")
    op.drop_column("application_follow_ups", "scheduled_at")
