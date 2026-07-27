"""rename is_hidden_by_customer to is_hidden on cust_ord

Revision ID: c9a4e6b1f208
Revises: b7c3f1a92d44
Create Date: 2026-07-27 15:30:00.000000

"""
from collections.abc import Sequence

from alembic import op


revision: str = 'c9a4e6b1f208'
down_revision: str | None = 'b7c3f1a92d44'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column('cust_ord', 'is_hidden_by_customer', new_column_name='is_hidden')


def downgrade() -> None:
    op.alter_column('cust_ord', 'is_hidden', new_column_name='is_hidden_by_customer')
