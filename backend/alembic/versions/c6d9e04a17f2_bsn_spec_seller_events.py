"""bsn_spec'e PROD_ADD, PROD_UPDATE, PROD_DELETE eklendi

Revision ID: c6d9e04a17f2
Revises: a8c25f61d3b7
Create Date: 2026-07-29 01:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'c6d9e04a17f2'
down_revision: str | None = 'a8c25f61d3b7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bsn_spec_table = sa.table(
        'bsn_spec',
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('srt_code', sa.String),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(bsn_spec_table, [
        {'name': 'Ürün Ekleme', 'description': 'Satıcı yeni bir ürün ekledi', 'srt_code': 'PROD_ADD', 'is_active': True},
        {'name': 'Ürün Güncelleme', 'description': 'Satıcı bir ürünü güncelledi', 'srt_code': 'PROD_UPDATE', 'is_active': True},
        {'name': 'Ürün Silme', 'description': 'Satıcı bir ürünü kaldırdı', 'srt_code': 'PROD_DELETE', 'is_active': True},
    ])


def downgrade() -> None:
    op.execute("DELETE FROM bsn_spec WHERE srt_code IN ('PROD_ADD', 'PROD_UPDATE', 'PROD_DELETE')")
