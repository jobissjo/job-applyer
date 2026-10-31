"""Add personal job removal, token revocation and login throttling records."""
from alembic import op
import sqlalchemy as sa

revision = "e80fb7c69438"
down_revision = "d79ea6b58327"
branch_labels = None
depends_on = None


def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "hidden_jobs" not in existing:
        op.create_table("hidden_jobs",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True))
    if "revoked_tokens" not in existing:
        op.create_table("revoked_tokens",
            sa.Column("token_hash", sa.String(64), primary_key=True),
            sa.Column("expires_at", sa.Integer(), nullable=False))
        op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])
    if "login_attempts" not in existing:
        op.create_table("login_attempts",
            sa.Column("scope_hash", sa.String(64), primary_key=True),
            sa.Column("window_start", sa.Integer(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False))
        op.create_index("ix_login_attempts_window_start", "login_attempts", ["window_start"])


def downgrade():
    op.drop_table("login_attempts")
    op.drop_table("revoked_tokens")
    op.drop_table("hidden_jobs")
