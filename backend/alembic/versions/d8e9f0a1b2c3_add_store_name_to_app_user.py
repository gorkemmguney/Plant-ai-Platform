"""add store_name to app_user

Revision ID: d8e9f0a1b2c3
Revises: 77a647ea3f0c
Create Date: 2026-07-15

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd8e9f0a1b2c3'
down_revision: str | None = '77a647ea3f0c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'app_user',
        sa.Column('store_name', sa.String(length=150), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('app_user', 'store_name')
