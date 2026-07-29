"""add actor_role_id to bsn_inter — aynı kişi hem müşteri hem satıcı olabildiği için rolü de logla

Revision ID: f3b7e29a5c14
Revises: e4a6c1d92f83
Create Date: 2026-07-29 00:20:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'f3b7e29a5c14'
down_revision: str | None = 'e4a6c1d92f83'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'bsn_inter',
        sa.Column(
            'actor_role_id', sa.Integer(),
            sa.ForeignKey('role.role_id', name='fk_bsn_inter_actor_role'),
            nullable=True,
        ),
    )
    op.create_index('ix_bsn_inter_actor_role_id', 'bsn_inter', ['actor_role_id'])


def downgrade() -> None:
    op.drop_index('ix_bsn_inter_actor_role_id', table_name='bsn_inter')
    op.drop_constraint('fk_bsn_inter_actor_role', 'bsn_inter', type_='foreignkey')
    op.drop_column('bsn_inter', 'actor_role_id')
