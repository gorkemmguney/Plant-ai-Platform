"""add user_follow table and cover_image_url

Revision ID: e8f9a0b1c2d4
Revises: e7f8a9b0c1d2
Create Date: 2026-08-05 13:33:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e8f9a0b1c2d4'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'user_follow' not in tables:
        op.create_table(
            'user_follow',
            sa.Column('follow_id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('follower_id', sa.Integer(), nullable=False),
            sa.Column('following_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['follower_id'], ['app_user.user_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['following_id'], ['app_user.user_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('follow_id')
        )
        op.create_index('ix_user_follow_follower_id', 'user_follow', ['follower_id'], unique=False)
        op.create_index('ix_user_follow_following_id', 'user_follow', ['following_id'], unique=False)

    columns = [c['name'] for c in inspector.get_columns('app_user')]
    if 'cover_image_url' not in columns:
        op.add_column('app_user', sa.Column('cover_image_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('app_user', 'cover_image_url')
    op.drop_index('ix_user_follow_following_id', table_name='user_follow')
    op.drop_index('ix_user_follow_follower_id', table_name='user_follow')
    op.drop_table('user_follow')
