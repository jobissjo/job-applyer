"""Add application follow-up history.

Revision ID: b51c6f72a920
Revises: 7833ab33d6d5
"""
from alembic import op
import sqlalchemy as sa

revision = "b51c6f72a920"
down_revision = "7833ab33d6d5"
branch_labels = None
depends_on = None


def upgrade():
    # The local app also creates new tables on startup.
    if sa.inspect(op.get_bind()).has_table("application_follow_ups"):
        return
    op.create_table(
        "application_follow_ups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False, unique=True),
        sa.Column("recipient", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("attach_resume", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_application_follow_ups_application_id", "application_follow_ups", ["application_id"])
    op.create_index("ix_application_follow_ups_user_id", "application_follow_ups", ["user_id"])


def downgrade():
    op.drop_table("application_follow_ups")
