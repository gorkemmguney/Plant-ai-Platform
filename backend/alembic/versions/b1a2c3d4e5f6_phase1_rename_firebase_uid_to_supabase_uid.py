"""phase1_rename_firebase_uid_to_supabase_uid

Revision ID: b1a2c3d4e5f6
Revises: e8f9a0b1c2d4
Create Date: 2026-08-07 01:34:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b1a2c3d4e5f6'
down_revision: str | None = 'e8f9a0b1c2d4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Safely ensure app_user has supabase_uid and not firebase_uid
    op.execute("""
    DO $$ 
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_user' AND column_name = 'firebase_uid') 
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_user' AND column_name = 'supabase_uid') THEN
            ALTER TABLE app_user DROP COLUMN firebase_uid;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_user' AND column_name = 'firebase_uid') THEN
            ALTER TABLE app_user RENAME COLUMN firebase_uid TO supabase_uid;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ix_app_user_firebase_uid') 
           AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ix_app_user_supabase_uid') THEN
            ALTER INDEX ix_app_user_firebase_uid RENAME TO ix_app_user_supabase_uid;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_user' AND column_name = 'firebase_uid') THEN
            ALTER TABLE app_user RENAME COLUMN supabase_uid TO firebase_uid;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ix_app_user_supabase_uid') THEN
            ALTER INDEX ix_app_user_supabase_uid RENAME TO ix_app_user_firebase_uid;
        END IF;
    END $$;
    """)
