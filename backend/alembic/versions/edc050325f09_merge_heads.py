"""merge heads

Revision ID: edc050325f09
Revises: ffbc9d40f5f2, b1f2c3d4e5f6
Create Date: 2026-07-14 14:02:08.118444

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'edc050325f09'
down_revision: str | None = ('ffbc9d40f5f2', 'b1f2c3d4e5f6')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
