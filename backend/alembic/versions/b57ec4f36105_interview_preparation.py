"""Save interview study plans and section progress for applications."""
from alembic import op
import sqlalchemy as sa

revision = "b57ec4f36105"
down_revision = "a46db3e25094"
branch_labels = None
depends_on = None


def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "interview_preparations" not in existing:
        op.create_table(
            "interview_preparations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("generation_id", sa.String(36), nullable=False),
            sa.Column("resume_id", sa.Integer(), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
            sa.Column("resume_title", sa.String(255), nullable=True),
            sa.Column("context", sa.Text(), nullable=True),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "interview_sections" not in existing:
        op.create_table(
            "interview_sections",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("preparation_id", sa.Integer(), sa.ForeignKey("interview_preparations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(150), nullable=False),
            sa.Column("priority", sa.String(20), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("estimated_minutes", sa.Integer(), nullable=False),
            sa.Column("topics", sa.JSON(), nullable=False),
            sa.Column("practice_tasks", sa.JSON(), nullable=False),
            sa.Column("questions", sa.JSON(), nullable=False),
            sa.Column("completed", sa.Boolean(), nullable=False),
        )
        op.create_index("ix_interview_sections_preparation_id", "interview_sections", ["preparation_id"])


def downgrade():
    op.drop_table("interview_sections")
    op.drop_table("interview_preparations")
