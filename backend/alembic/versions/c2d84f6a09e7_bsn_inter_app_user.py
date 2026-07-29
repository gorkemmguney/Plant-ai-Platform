"""bsn_inter: cust_id -> app_user_id, add cust_ord_item_id, add cancel/return specs

Revision ID: c2d84f6a09e7
Revises: b7c3e91a4f52
Create Date: 2026-07-28 00:05:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'c2d84f6a09e7'
down_revision: str | None = 'b7c3e91a4f52'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('bsn_inter', sa.Column('app_user_id', sa.Integer(), nullable=True))
    op.execute(
        "UPDATE bsn_inter SET app_user_id = cust.user_id FROM cust WHERE cust.cust_id = bsn_inter.cust_id"
    )
    op.alter_column('bsn_inter', 'app_user_id', nullable=False)
    op.create_foreign_key('fk_bsn_inter_app_user', 'bsn_inter', 'app_user', ['app_user_id'], ['user_id'])

    op.drop_index('ix_bsn_inter_cust_id', table_name='bsn_inter')
    op.drop_constraint('bsn_inter_cust_id_fkey', 'bsn_inter', type_='foreignkey')
    op.drop_column('bsn_inter', 'cust_id')
    op.create_index('ix_bsn_inter_app_user_id', 'bsn_inter', ['app_user_id'])

    op.add_column(
        'bsn_inter',
        sa.Column(
            'cust_ord_item_id', sa.Integer(),
            sa.ForeignKey('cust_ord_item.cust_ord_item_id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_bsn_inter_cust_ord_item_id', 'bsn_inter', ['cust_ord_item_id'])

    bsn_spec_table = sa.table(
        'bsn_spec',
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('srt_code', sa.String),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(bsn_spec_table, [
        {'name': 'Ürün İptali', 'description': 'Sipariş kalemi iptal edildi (müşteri veya satıcı tarafından)', 'srt_code': 'PROD_CANCEL', 'is_active': True},
        {'name': 'Ürün İadesi', 'description': 'Sipariş kalemi iade edildi', 'srt_code': 'PROD_RETURN', 'is_active': True},
    ])


def downgrade() -> None:
    op.execute("DELETE FROM bsn_spec WHERE srt_code IN ('PROD_CANCEL', 'PROD_RETURN')")

    op.drop_index('ix_bsn_inter_cust_ord_item_id', table_name='bsn_inter')
    op.drop_column('bsn_inter', 'cust_ord_item_id')

    op.add_column('bsn_inter', sa.Column('cust_id', sa.Integer(), nullable=True))
    op.execute(
        "UPDATE bsn_inter SET cust_id = cust.cust_id FROM cust WHERE cust.user_id = bsn_inter.app_user_id"
    )
    op.alter_column('bsn_inter', 'cust_id', nullable=False)
    op.create_foreign_key('bsn_inter_cust_id_fkey', 'bsn_inter', 'cust', ['cust_id'], ['cust_id'])
    op.create_index('ix_bsn_inter_cust_id', 'bsn_inter', ['cust_id'])

    op.drop_index('ix_bsn_inter_app_user_id', table_name='bsn_inter')
    op.drop_constraint('fk_bsn_inter_app_user', 'bsn_inter', type_='foreignkey')
    op.drop_column('bsn_inter', 'app_user_id')
