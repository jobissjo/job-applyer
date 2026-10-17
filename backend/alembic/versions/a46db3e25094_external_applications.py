"""Track applications submitted outside JobApply."""
from alembic import op
import sqlalchemy as sa

revision = "a46db3e25094"
down_revision = "f35ca2d14983"
branch_labels = None
depends_on = None


def upgrade():
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("applications")}
    if "applied_on" not in columns:
        op.add_column("applications", sa.Column("applied_on", sa.Date(), nullable=True))
    if "application_method" not in columns:
        op.add_column("applications", sa.Column("application_method", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("applications", "application_method")
    op.drop_column("applications", "applied_on")
