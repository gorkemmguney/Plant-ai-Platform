"""add seller_id to prod

Revision ID: c2a3b4d5e6f7
Revises: b1f2c3d4e5f6
Create Date: 2026-07-15

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c2a3b4d5e6f7'
down_revision: str | None = 'b1f2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('prod', sa.Column('seller_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_prod_seller', 'prod', 'app_user', ['seller_id'], ['user_id'])


def downgrade() -> None:
    op.drop_constraint('fk_prod_seller', 'prod', type_='foreignkey')
    op.drop_column('prod', 'seller_id')
