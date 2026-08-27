"""add tmforum party profile columns to app_user

Revision ID: e7f8a9b0c1d2
Revises: b8c9d0e1f2a3
Create Date: 2026-08-05 13:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f8a9b0c1d2'
down_revision = ('b8c9d0e1f2a3', 'c6d9e04a17f2')
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('app_user')]

    if 'bio' not in columns:
        op.add_column('app_user', sa.Column('bio', sa.String(length=500), nullable=True))
    if 'city' not in columns:
        op.add_column('app_user', sa.Column('city', sa.String(length=100), nullable=True))
    if 'avatar_url' not in columns:
        op.add_column('app_user', sa.Column('avatar_url', sa.String(length=500), nullable=True))
    if 'rating_score' not in columns:
        op.add_column('app_user', sa.Column('rating_score', sa.Float(), server_default='5.0', nullable=False))
    if 'review_count' not in columns:
        op.add_column('app_user', sa.Column('review_count', sa.Integer(), server_default='0', nullable=False))
    if 'badges' not in columns:
        op.add_column('app_user', sa.Column('badges', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('app_user', 'badges')
    op.drop_column('app_user', 'review_count')
    op.drop_column('app_user', 'rating_score')
    op.drop_column('app_user', 'avatar_url')
    op.drop_column('app_user', 'city')
    op.drop_column('app_user', 'bio')
