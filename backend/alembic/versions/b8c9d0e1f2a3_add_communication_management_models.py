"""add communication management models

Revision ID: b8c9d0e1f2a3
Revises: e1b02d5965d7
Create Date: 2026-08-05 11:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'b8c9d0e1f2a3'
down_revision: str | None = 'e1b02d5965d7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'comm_interaction' not in tables:
        op.create_table(
            'comm_interaction',
            sa.Column('comm_interaction_id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('interaction_type', sa.String(length=50), server_default='SELLER_CHAT', nullable=False),
            sa.Column('status', sa.String(length=50), server_default='OPEN', nullable=False),
            sa.Column('channel_type', sa.String(length=50), server_default='IN_APP_CHAT', nullable=False),
            sa.Column('subject', sa.String(length=255), nullable=True),
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('seller_id', sa.Integer(), nullable=False),
            sa.Column('related_prod_id', sa.Integer(), nullable=True),
            sa.Column('related_ord_id', sa.Integer(), nullable=True),
            sa.Column('last_message_text', sa.String(length=512), nullable=True),
            sa.Column('last_message_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['customer_id'], ['app_user.user_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['seller_id'], ['app_user.user_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['related_prod_id'], ['prod.prod_id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['related_ord_id'], ['cust_ord.cust_ord_id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('comm_interaction_id')
        )

    if 'comm_message' not in tables:
        op.create_table(
            'comm_message',
            sa.Column('comm_message_id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('comm_interaction_id', sa.Integer(), nullable=False),
            sa.Column('sender_id', sa.Integer(), nullable=False),
            sa.Column('sender_role', sa.String(length=30), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('message_state', sa.String(length=30), server_default='SENT', nullable=False),
            sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['comm_interaction_id'], ['comm_interaction.comm_interaction_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['sender_id'], ['app_user.user_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('comm_message_id')
        )

    if 'comm_attachment' not in tables:
        op.create_table(
            'comm_attachment',
            sa.Column('comm_attachment_id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('comm_message_id', sa.Integer(), nullable=False),
            sa.Column('attachment_type', sa.String(length=50), server_default='IMAGE', nullable=False),
            sa.Column('url', sa.String(length=1024), nullable=False),
            sa.Column('mime_type', sa.String(length=100), nullable=True),
            sa.Column('file_name', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['comm_message_id'], ['comm_message.comm_message_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('comm_attachment_id')
        )


def downgrade() -> None:
    op.drop_table('comm_attachment')
    op.drop_table('comm_message')
    op.drop_table('comm_interaction')
