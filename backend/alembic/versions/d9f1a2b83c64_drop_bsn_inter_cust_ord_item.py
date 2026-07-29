"""drop cust_ord_item_id from bsn_inter (not needed for now)

Revision ID: d9f1a2b83c64
Revises: c2d84f6a09e7
Create Date: 2026-07-29 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'd9f1a2b83c64'
down_revision: str | None = 'c2d84f6a09e7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index('ix_bsn_inter_cust_ord_item_id', table_name='bsn_inter')
    op.drop_constraint('bsn_inter_cust_ord_item_id_fkey', 'bsn_inter', type_='foreignkey')
    op.drop_column('bsn_inter', 'cust_ord_item_id')


def downgrade() -> None:
    op.add_column(
        'bsn_inter',
        sa.Column(
            'cust_ord_item_id', sa.Integer(),
            sa.ForeignKey('cust_ord_item.cust_ord_item_id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_bsn_inter_cust_ord_item_id', 'bsn_inter', ['cust_ord_item_id'])
