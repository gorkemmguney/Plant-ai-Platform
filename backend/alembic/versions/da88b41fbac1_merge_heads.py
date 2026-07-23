"""merge heads

Revision ID: da88b41fbac1
Revises: 691dea865e88, c9d1e2f3a4b5
Create Date: 2026-07-22 16:12:12.636840

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'da88b41fbac1'
down_revision: str | None = ('691dea865e88', 'c9d1e2f3a4b5')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
