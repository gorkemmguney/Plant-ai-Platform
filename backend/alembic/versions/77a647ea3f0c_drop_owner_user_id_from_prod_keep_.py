"""drop owner_user_id from prod, keep seller_id

Revision ID: 77a647ea3f0c
Revises: 0c8eaacf2e82
Create Date: 2026-07-15

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '77a647ea3f0c'
down_revision: str | None = '0c8eaacf2e82'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint('fk_prod_owner_user_id_app_user', 'prod', type_='foreignkey')
    op.drop_index('ix_prod_owner_user_id', table_name='prod')
    op.drop_column('prod', 'owner_user_id')


def downgrade() -> None:
    op.add_column('prod', sa.Column('owner_user_id', sa.Integer(), nullable=True))
    op.create_index('ix_prod_owner_user_id', 'prod', ['owner_user_id'])
    op.create_foreign_key(
        'fk_prod_owner_user_id_app_user', 'prod', 'app_user',
        ['owner_user_id'], ['user_id'], ondelete='SET NULL'
    )
