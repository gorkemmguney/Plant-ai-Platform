"""add prod_spec_id to prod

Revision ID: f17f58d9c373
Revises: b1f2c3d4e5f6
Create Date: 2026-07-14

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'f17f58d9c373'
down_revision: str | None = 'b1f2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'prod',
        sa.Column('prod_spec_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_prod_prod_spec',
        'prod',
        'prod_spec',
        ['prod_spec_id'],
        ['prod_spec_id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_prod_prod_spec', 'prod', type_='foreignkey')
    op.drop_column('prod', 'prod_spec_id')
