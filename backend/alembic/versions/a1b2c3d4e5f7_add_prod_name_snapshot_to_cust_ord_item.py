"""add prod_name snapshot to cust_ord_item, prod_id -> SET NULL

Revision ID: a1b2c3d4e5f7
Revises: d8e9f0a1b2c3
Create Date: 2026-07-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f7'
down_revision: str | None = 'd8e9f0a1b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cust_ord_item', sa.Column('prod_name', sa.String(length=255), nullable=True))

    op.execute(
        """
        UPDATE cust_ord_item
        SET prod_name = COALESCE(
            (SELECT p.name FROM prod p WHERE p.prod_id = cust_ord_item.prod_id),
            'Silinmiş Ürün'
        )
        WHERE prod_name IS NULL
        """
    )

    op.alter_column('cust_ord_item', 'prod_name', nullable=False)
    op.alter_column('cust_ord_item', 'prod_id', nullable=True)

    op.drop_constraint('cust_ord_item_prod_id_fkey', 'cust_ord_item', type_='foreignkey')
    op.create_foreign_key(
        'fk_cust_ord_item_prod',
        'cust_ord_item', 'prod',
        ['prod_id'], ['prod_id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_cust_ord_item_prod', 'cust_ord_item', type_='foreignkey')
    op.create_foreign_key(
        'cust_ord_item_prod_id_fkey',
        'cust_ord_item', 'prod',
        ['prod_id'], ['prod_id'],
    )
    op.alter_column('cust_ord_item', 'prod_id', nullable=False)
    op.drop_column('cust_ord_item', 'prod_name')
