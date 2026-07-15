"""prod.seller_id fk_prod_seller -> ON DELETE CASCADE

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-07-15 00:00:00.000000
"""
from alembic import op

revision: str = 'b2c3d4e5f6a8'
down_revision: str | None = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('fk_prod_seller', 'prod', type_='foreignkey')
    op.create_foreign_key(
        'fk_prod_seller',
        'prod', 'app_user',
        ['seller_id'], ['user_id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('fk_prod_seller', 'prod', type_='foreignkey')
    op.create_foreign_key(
        'fk_prod_seller',
        'prod', 'app_user',
        ['seller_id'], ['user_id'],
    )
