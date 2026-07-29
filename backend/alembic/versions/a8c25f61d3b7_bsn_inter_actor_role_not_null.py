"""make bsn_inter.actor_role_id required, backfill existing rows as customer

Revision ID: a8c25f61d3b7
Revises: f3b7e29a5c14
Create Date: 2026-07-29 00:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'a8c25f61d3b7'
down_revision: str | None = 'f3b7e29a5c14'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE bsn_inter SET actor_role_id = (SELECT role_id FROM role WHERE role_name = 'customer') "
        "WHERE actor_role_id IS NULL"
    )
    op.alter_column('bsn_inter', 'actor_role_id', nullable=False)


def downgrade() -> None:
    op.alter_column('bsn_inter', 'actor_role_id', nullable=True)
