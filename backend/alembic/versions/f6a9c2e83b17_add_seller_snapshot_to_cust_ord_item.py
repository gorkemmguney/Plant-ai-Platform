"""add seller snapshot (app_user) to cust_ord_item

Revision ID: f6a9c2e83b17
Revises: e5f7a8c19d02
Create Date: 2026-07-27 20:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'f6a9c2e83b17'
down_revision: str | None = 'e5f7a8c19d02'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # prod_name'de olduğu gibi: ürün/satıcı hesabı silinse bile sipariş geçmişinde
    # "hangi satıcıdan alındığı" bozulmadan görünsün diye seller_id nullable + SET
    # NULL, gösterilecek mağaza adı ise sipariş anında seller_store_name alanına
    # "donduruluyor" (canlı app_user verisine bağımlı değil).
    op.add_column(
        'cust_ord_item',
        sa.Column(
            'seller_id',
            sa.Integer(),
            sa.ForeignKey('app_user.user_id', ondelete='SET NULL', name='fk_cust_ord_item_seller'),
            nullable=True,
        ),
    )
    op.add_column('cust_ord_item', sa.Column('seller_store_name', sa.String(length=150), nullable=True))

    op.execute(
        """
        UPDATE cust_ord_item ci
        SET seller_id = p.seller_id,
            seller_store_name = COALESCE(u.store_name, u.first_name || ' ' || u.last_name)
        FROM prod p
        LEFT JOIN app_user u ON u.user_id = p.seller_id
        WHERE ci.prod_id = p.prod_id
        """
    )

    # Ürünü zaten silinmiş (prod_id NULL olmuş) eski satırlar için satıcı bilgisi
    # kurtarılamıyor — en azından gösterilecek bir metin bırakalım.
    op.execute(
        """
        UPDATE cust_ord_item
        SET seller_store_name = 'Bilinmeyen Satıcı'
        WHERE prod_id IS NULL AND seller_store_name IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column('cust_ord_item', 'seller_store_name')
    op.drop_constraint('fk_cust_ord_item_seller', 'cust_ord_item', type_='foreignkey')
    op.drop_column('cust_ord_item', 'seller_id')
