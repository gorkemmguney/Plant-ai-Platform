"""add prod soft delete columns (is_active, deleted_at)

Revision ID: c9d1e2f3a4b5
Revises: b2c3d4e5f6a8
Create Date: 2026-07-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9d1e2f3a4b5'
down_revision: str | None = 'b2c3d4e5f6a8'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        'prod',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'prod',
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_prod_is_active', 'prod', ['is_active'])


def downgrade() -> None:
    op.drop_index('idx_prod_is_active', table_name='prod')
    op.drop_column('prod', 'deleted_at')
    op.drop_column('prod', 'is_active')
