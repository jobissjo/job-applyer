"""Registration email verification; preserve access for existing accounts."""
from alembic import op
import sqlalchemy as sa

revision = "d79ea6b58327"
down_revision = "c68fd5a47216"
branch_labels = None
depends_on = None


def upgrade():
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    if "is_email_verified" not in existing:
        op.add_column("users", sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
        # Existing accounts predate verification and retain access.
        op.execute(sa.text("UPDATE users SET is_email_verified = true"))
    for column in (
        sa.Column("verification_code_hash", sa.String(64)),
        sa.Column("verification_expires_at", sa.DateTime(timezone=True)),
        sa.Column("verification_sent_at", sa.DateTime(timezone=True)),
        sa.Column("verification_attempts", sa.Integer(), nullable=False, server_default="0"),
    ):
        if column.name not in existing:
            op.add_column("users", column)


def downgrade():
    for column in ("verification_attempts", "verification_sent_at", "verification_expires_at", "verification_code_hash", "is_email_verified"):
        op.drop_column("users", column)
