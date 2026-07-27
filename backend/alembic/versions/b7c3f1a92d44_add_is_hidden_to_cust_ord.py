"""add is_hidden_by_customer to cust_ord

Revision ID: b7c3f1a92d44
Revises: e1b02d5965d7
Create Date: 2026-07-27 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'b7c3f1a92d44'
down_revision: str | None = 'e1b02d5965d7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'cust_ord',
        sa.Column('is_hidden_by_customer', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('cust_ord', 'is_hidden_by_customer')
