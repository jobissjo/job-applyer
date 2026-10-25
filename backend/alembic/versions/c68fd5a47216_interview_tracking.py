"""Hiring progress, interview rounds, and change history."""
from alembic import op
import sqlalchemy as sa

revision = "c68fd5a47216"
down_revision = "b57ec4f36105"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "hiring_progress" not in {c["name"] for c in inspector.get_columns("applications")}:
        op.add_column("applications", sa.Column("hiring_progress", sa.String(30), nullable=False, server_default="awaiting_response"))
        op.create_index("ix_applications_hiring_progress", "applications", ["hiring_progress"])
    existing = set(inspector.get_table_names())
    if "interview_rounds" not in existing:
        op.create_table(
            "interview_rounds",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("mode", sa.String(30), nullable=False),
            sa.Column("location", sa.String(2000), nullable=False),
            sa.Column("contact", sa.String(500), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("result", sa.String(30), nullable=False),
            *[sa.Column(k, sa.Text(), nullable=False) for k in ("preparation_notes", "reflection", "went_wrong", "feedback", "improvements")],
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_interview_rounds_application_id", "interview_rounds", ["application_id"])
    if "interview_changes" not in existing:
        op.create_table(
            "interview_changes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("round_id", sa.Integer(), sa.ForeignKey("interview_rounds.id", ondelete="SET NULL"), nullable=True),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("before", sa.JSON(), nullable=False),
            sa.Column("after", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_interview_changes_application_id", "interview_changes", ["application_id"])


def downgrade():
    op.drop_table("interview_changes")
    op.drop_table("interview_rounds")
    op.drop_index("ix_applications_hiring_progress", table_name="applications")
    op.drop_column("applications", "hiring_progress")
