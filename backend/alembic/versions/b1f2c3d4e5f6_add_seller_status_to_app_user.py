"""add seller_status to app_user

Revision ID: b1f2c3d4e5f6
Revises: a57119a8b471
Create Date: 2026-07-13

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b1f2c3d4e5f6'
down_revision: str | None = 'a57119a8b471'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'app_user',
        sa.Column('seller_status', sa.String(length=20), server_default='none', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('app_user', 'seller_status')
