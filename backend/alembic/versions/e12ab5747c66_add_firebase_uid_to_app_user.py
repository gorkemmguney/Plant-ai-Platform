
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = 'e12ab5747c66'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "app_user",
        sa.Column("firebase_uid", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "app_user",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )
    op.add_column(
        "app_user",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
    )
    op.alter_column("app_user", "password_hash", existing_type=sa.Text(), nullable=True)
    op.create_unique_constraint("uq_app_user_firebase_uid", "app_user", ["firebase_uid"])
    op.create_index("ix_app_user_firebase_uid", "app_user", ["firebase_uid"])


def downgrade() -> None:
    op.drop_index("ix_app_user_firebase_uid", table_name="app_user")
    op.drop_constraint("uq_app_user_firebase_uid", "app_user", type_="unique")
    op.drop_column("app_user", "is_active")
    op.drop_column("app_user", "updated_at")
    op.drop_column("app_user", "firebase_uid")
