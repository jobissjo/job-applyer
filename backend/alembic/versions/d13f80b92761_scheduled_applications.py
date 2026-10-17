"""Scheduled manual application delivery."""
from alembic import op
import sqlalchemy as sa
revision = "d13f80b92761"
down_revision = "c92a76e81034"
branch_labels = None
depends_on = None


def upgrade():
    if "scheduled_at" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("applications")}:
        op.add_column("applications", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))
    indexes = {i["name"] for i in sa.inspect(op.get_bind()).get_indexes("applications")}
    if "ix_applications_scheduled_at" not in indexes:
        op.create_index("ix_applications_scheduled_at", "applications", ["scheduled_at"])


def downgrade():
    op.drop_index("ix_applications_scheduled_at", table_name="applications")
    op.drop_column("applications", "scheduled_at")
