"""merge seller_id, owner_user_id and previous merge heads

Revision ID: 0c8eaacf2e82
Revises: 2096bc77f737, c2a3b4d5e6f7, edc050325f09
Create Date: 2026-07-15 20:43:22.953867

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0c8eaacf2e82'
down_revision: str | None = ('2096bc77f737', 'c2a3b4d5e6f7', 'edc050325f09')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
