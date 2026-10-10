"""Track ownership of manually added jobs.

Revision ID: c92a76e81034
Revises: b51c6f72a920
"""
from alembic import op
import sqlalchemy as sa

revision = "c92a76e81034"
down_revision = "b51c6f72a920"
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("manual_job_ownership"):
        return
    op.create_table(
        "manual_job_ownership",
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_manual_job_ownership_user_id", "manual_job_ownership", ["user_id"])


def downgrade():
    op.drop_table("manual_job_ownership")
