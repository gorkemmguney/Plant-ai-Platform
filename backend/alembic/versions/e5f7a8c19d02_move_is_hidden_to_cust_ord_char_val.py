"""move cust_ord.is_hidden into generic cust_ord_char_val (tmforum char pattern)

Revision ID: e5f7a8c19d02
Revises: d4e8f2a71b93
Create Date: 2026-07-27 19:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'e5f7a8c19d02'
down_revision: str | None = 'd4e8f2a71b93'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IS_HIDDEN_CODE = 'IS_HIDDEN'


def upgrade() -> None:
    # gnl_char'a tmforum tarzı entity code kolonu ekliyoruz — isim (name) yerine
    # sabit bir koda göre programatik olarak karakteristik türü aranabilsin diye
    # (örn. IS_HIDDEN). Mevcut kayıtlar (Renk, Saksı Boyutu, ...) için code NULL kalır.
    op.add_column('gnl_char', sa.Column('code', sa.String(length=50), nullable=True))
    op.create_unique_constraint('uq_gnl_char_code', 'gnl_char', ['code'])

    gnl_char_table = sa.table(
        'gnl_char',
        sa.column('gnl_char_id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('code', sa.String),
    )
    op.bulk_insert(gnl_char_table, [
        {
            'name': 'Sipariş Gizleme (Müşteri)',
            'description': 'Müşteri siparişi kendi listesinde gizlemiş mi (satıcı/admin tarafını etkilemez)',
            'code': IS_HIDDEN_CODE,
        },
    ])

    conn = op.get_bind()
    is_hidden_gnl_char_id = conn.execute(
        sa.text("SELECT gnl_char_id FROM gnl_char WHERE code = :code"),
        {'code': IS_HIDDEN_CODE},
    ).scalar_one()

    # Halihazırda is_hidden = true olan siparişleri cust_ord_char_val'e taşı
    conn.execute(
        sa.text(
            """
            INSERT INTO cust_ord_char_val (cust_ord_id, gnl_char_id, value)
            SELECT cust_ord_id, :gnl_char_id, 'true'
            FROM cust_ord
            WHERE is_hidden = true
            """
        ),
        {'gnl_char_id': is_hidden_gnl_char_id},
    )

    op.drop_column('cust_ord', 'is_hidden')


def downgrade() -> None:
    op.add_column(
        'cust_ord',
        sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'),
    )

    conn = op.get_bind()
    is_hidden_gnl_char_id = conn.execute(
        sa.text("SELECT gnl_char_id FROM gnl_char WHERE code = :code"),
        {'code': IS_HIDDEN_CODE},
    ).scalar_one_or_none()

    if is_hidden_gnl_char_id is not None:
        conn.execute(
            sa.text(
                """
                UPDATE cust_ord SET is_hidden = true
                WHERE cust_ord_id IN (
                    SELECT cust_ord_id FROM cust_ord_char_val
                    WHERE gnl_char_id = :gnl_char_id AND value = 'true'
                )
                """
            ),
            {'gnl_char_id': is_hidden_gnl_char_id},
        )
        conn.execute(
            sa.text("DELETE FROM cust_ord_char_val WHERE gnl_char_id = :gnl_char_id"),
            {'gnl_char_id': is_hidden_gnl_char_id},
        )
        conn.execute(
            sa.text("DELETE FROM gnl_char WHERE gnl_char_id = :gnl_char_id"),
            {'gnl_char_id': is_hidden_gnl_char_id},
        )

    op.drop_constraint('uq_gnl_char_code', 'gnl_char', type_='unique')
    op.drop_column('gnl_char', 'code')
