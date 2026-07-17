"""merge multiple heads from repo sync

Revision ID: a65f19f543dd
Revises: 2096bc77f737, c2a3b4d5e6f7, edc050325f09
Create Date: 2026-07-15 23:19:59.275517

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'a65f19f543dd'
down_revision: str | None = ('2096bc77f737', 'c2a3b4d5e6f7', 'edc050325f09')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
