"""add owner_user_id to prod

Revision ID: 2096bc77f737
Revises: 0ef3a66a51d1
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2096bc77f737"
down_revision = "0ef3a66a51d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prod",
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_prod_owner_user_id_app_user",
        "prod",
        "app_user",
        ["owner_user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_prod_owner_user_id",
        "prod",
        ["owner_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_prod_owner_user_id", table_name="prod")
    op.drop_constraint("fk_prod_owner_user_id_app_user", "prod", type_="foreignkey")
    op.drop_column("prod", "owner_user_id")
