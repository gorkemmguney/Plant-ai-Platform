"""rebuild bsn_inter around new bsn_spec (spec/instance pattern)

Revision ID: d4e8f2a71b93
Revises: c9a4e6b1f208
Create Date: 2026-07-27 19:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'd4e8f2a71b93'
down_revision: str | None = 'c9a4e6b1f208'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # bsn_inter_spec / eski bsn_inter hiçbir router veya serviste kullanılmıyordu (ölü iskelet tablo) — güvenle kaldırılabilir
    op.drop_table('bsn_inter_spec')
    op.drop_table('bsn_inter')

    op.create_table(
        'bsn_spec',
        sa.Column('bsn_spec_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('srt_code', sa.String(length=50), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('cdate', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'bsn_inter',
        sa.Column('bsn_inter_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('bsn_spec_id', sa.Integer(), sa.ForeignKey('bsn_spec.bsn_spec_id'), nullable=False),
        sa.Column('cust_id', sa.Integer(), sa.ForeignKey('cust.cust_id'), nullable=False),
        sa.Column('sale_cnl_id', sa.Integer(), sa.ForeignKey('sale_cnl.sale_cnl_id'), nullable=True),
        sa.Column('cdate', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_bsn_inter_cust_id', 'bsn_inter', ['cust_id'])
    op.create_index('ix_bsn_inter_bsn_spec_id', 'bsn_inter', ['bsn_spec_id'])

    bsn_spec_table = sa.table(
        'bsn_spec',
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('srt_code', sa.String),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(bsn_spec_table, [
        {'name': 'Ürün Görüntüleme', 'description': 'Müşteri bir ürün detayını görüntüledi', 'srt_code': 'PROD_VIEW', 'is_active': True},
        {'name': 'Sepete Ekleme', 'description': 'Müşteri bir ürünü sepete ekledi', 'srt_code': 'ADD_CART', 'is_active': True},
        {'name': 'Satın Alma', 'description': 'Müşteri siparişi tamamladı', 'srt_code': 'PURCHASE', 'is_active': True},
        {'name': 'Favorilere Ekleme', 'description': 'Müşteri bir ürünü favorilerine ekledi', 'srt_code': 'FAVORITE_ADD', 'is_active': True},
        {'name': 'Favorilerden Çıkarma', 'description': 'Müşteri bir ürünü favorilerinden çıkardı', 'srt_code': 'FAVORITE_REMOVE', 'is_active': True},
        {'name': 'Değerlendirme Gönderme', 'description': 'Müşteri bir ürüne puan/yorum bıraktı', 'srt_code': 'REVIEW_SUBMIT', 'is_active': True},
        {'name': 'Destek Talebi', 'description': 'Müşteri destek/şikayet talebi oluşturdu', 'srt_code': 'SUPPORT_TICKET', 'is_active': True},
        {'name': 'Bitki Analizi', 'description': 'Müşteri AI ile bitki görseli analiz ettirdi', 'srt_code': 'AI_ANALYSIS', 'is_active': True},
        {'name': 'Mağaza Ziyareti', 'description': 'Müşteri bir satıcı mağazasını görüntüledi', 'srt_code': 'STORE_VISIT', 'is_active': True},
        {'name': 'Kupon Kullanımı', 'description': 'Müşteri bir kuponu siparişte kullandı', 'srt_code': 'COUPON_USE', 'is_active': True},
    ])


def downgrade() -> None:
    op.drop_index('ix_bsn_inter_bsn_spec_id', table_name='bsn_inter')
    op.drop_index('ix_bsn_inter_cust_id', table_name='bsn_inter')
    op.drop_table('bsn_inter')
    op.drop_table('bsn_spec')

    op.create_table(
        'bsn_inter',
        sa.Column('bsn_inter_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('cust_id', sa.Integer(), sa.ForeignKey('cust.cust_id'), nullable=False),
        sa.Column('prod_id', sa.Integer(), sa.ForeignKey('prod.prod_id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_table(
        'bsn_inter_spec',
        sa.Column('bsn_inter_spec_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('bsn_inter_id', sa.Integer(), sa.ForeignKey('bsn_inter.bsn_inter_id', ondelete='CASCADE'), nullable=False),
        sa.Column('action_type', sa.String(length=50), nullable=False),
        sa.Column('action_value', sa.String(length=255), nullable=True),
    )
