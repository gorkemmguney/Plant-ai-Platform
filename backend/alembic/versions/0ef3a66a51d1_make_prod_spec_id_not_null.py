"""make prod_spec_id not null

Revision ID: 0ef3a66a51d1
Revises: f17f58d9c373
Create Date: 2026-07-14

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0ef3a66a51d1'
down_revision: str | None = 'f17f58d9c373'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column('prod', 'prod_spec_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.alter_column('prod', 'prod_spec_id', existing_type=sa.Integer(), nullable=True)
