"""Add learning skills, job links, notes, and resources."""
from alembic import op
import sqlalchemy as sa

revision = "f35ca2d14983"
down_revision = "e24b91c03872"
branch_labels = None
depends_on = None


def upgrade():
    # Startup may already have created these tables via metadata.create_all.
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "learning_items" not in existing:
        op.create_table(
            "learning_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("skill", sa.String(150), nullable=False),
            sa.Column("skill_key", sa.String(150), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "skill_key", name="uq_learning_user_skill"),
        )
        op.create_index("ix_learning_items_user_id", "learning_items", ["user_id"])
    if "learning_jobs" not in existing:
        op.create_table(
            "learning_jobs",
            sa.Column("item_id", sa.Integer(), sa.ForeignKey("learning_items.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
        )
    if "learning_entries" not in existing:
        op.create_table(
            "learning_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("item_id", sa.Integer(), sa.ForeignKey("learning_items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", sa.String(20), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("url", sa.String(2000), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_learning_entries_item_id", "learning_entries", ["item_id"])


def downgrade():
    op.drop_table("learning_entries")
    op.drop_table("learning_jobs")
    op.drop_table("learning_items")
