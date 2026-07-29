"""repoint ind/org to app_user_id so sellers can have individual/org profiles

Revision ID: b7c3e91a4f52
Revises: a3f7d92c6e14
Create Date: 2026-07-28 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'b7c3e91a4f52'
down_revision: str | None = 'a3f7d92c6e14'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('ind', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('org', sa.Column('user_id', sa.Integer(), nullable=True))

    op.execute(
        "UPDATE ind SET user_id = cust.user_id FROM cust WHERE cust.cust_id = ind.cust_id"
    )
    op.execute(
        "UPDATE org SET user_id = cust.user_id FROM cust WHERE cust.cust_id = org.cust_id"
    )

    op.alter_column('ind', 'user_id', nullable=False)
    op.alter_column('org', 'user_id', nullable=False)

    op.create_foreign_key('fk_ind_app_user', 'ind', 'app_user', ['user_id'], ['user_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_org_app_user', 'org', 'app_user', ['user_id'], ['user_id'], ondelete='CASCADE')

    op.drop_constraint('ind_cust_id_fkey', 'ind', type_='foreignkey')
    op.drop_constraint('org_cust_id_fkey', 'org', type_='foreignkey')
    op.drop_column('ind', 'cust_id')
    op.drop_column('org', 'cust_id')


def downgrade() -> None:
    op.add_column('ind', sa.Column('cust_id', sa.Integer(), nullable=True))
    op.add_column('org', sa.Column('cust_id', sa.Integer(), nullable=True))

    op.execute(
        "UPDATE ind SET cust_id = cust.cust_id FROM cust WHERE cust.user_id = ind.user_id"
    )
    op.execute(
        "UPDATE org SET cust_id = cust.cust_id FROM cust WHERE cust.user_id = org.user_id"
    )

    op.alter_column('ind', 'cust_id', nullable=False)
    op.alter_column('org', 'cust_id', nullable=False)

    op.create_foreign_key('ind_cust_id_fkey', 'ind', 'cust', ['cust_id'], ['cust_id'], ondelete='CASCADE')
    op.create_foreign_key('org_cust_id_fkey', 'org', 'cust', ['cust_id'], ['cust_id'], ondelete='CASCADE')

    op.drop_constraint('fk_ind_app_user', 'ind', type_='foreignkey')
    op.drop_constraint('fk_org_app_user', 'org', type_='foreignkey')
    op.drop_column('ind', 'user_id')
    op.drop_column('org', 'user_id')
