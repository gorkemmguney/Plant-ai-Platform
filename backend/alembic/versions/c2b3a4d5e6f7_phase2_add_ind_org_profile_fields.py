"""phase2_add_ind_org_profile_fields

Revision ID: c2b3a4d5e6f7
Revises: b1a2c3d4e5f6
Create Date: 2026-08-07 01:42:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c2b3a4d5e6f7'
down_revision: str | None = 'b1a2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN
        -- ind table additions
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'username') THEN
            ALTER TABLE ind ADD COLUMN username VARCHAR(80);
            ALTER TABLE ind ADD CONSTRAINT uq_ind_username UNIQUE (username);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'first_name') THEN
            ALTER TABLE ind ADD COLUMN first_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'last_name') THEN
            ALTER TABLE ind ADD COLUMN last_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'email') THEN
            ALTER TABLE ind ADD COLUMN email VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'phone_number') THEN
            ALTER TABLE ind ADD COLUMN phone_number VARCHAR(30);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'created_at') THEN
            ALTER TABLE ind ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'updated_at') THEN
            ALTER TABLE ind ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;

        -- org table additions
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'store_name') THEN
            ALTER TABLE org ADD COLUMN store_name VARCHAR(150);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'seller_status') THEN
            ALTER TABLE org ADD COLUMN seller_status VARCHAR(20) DEFAULT 'none';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'first_name') THEN
            ALTER TABLE org ADD COLUMN first_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'last_name') THEN
            ALTER TABLE org ADD COLUMN last_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'email') THEN
            ALTER TABLE org ADD COLUMN email VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'phone_number') THEN
            ALTER TABLE org ADD COLUMN phone_number VARCHAR(30);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'store_address') THEN
            ALTER TABLE org ADD COLUMN store_address VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'bank_iban') THEN
            ALTER TABLE org ADD COLUMN bank_iban VARCHAR(34);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'logo_url') THEN
            ALTER TABLE org ADD COLUMN logo_url VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'created_at') THEN
            ALTER TABLE org ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'updated_at') THEN
            ALTER TABLE org ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE ind DROP COLUMN IF EXISTS username;
    ALTER TABLE ind DROP COLUMN IF EXISTS first_name;
    ALTER TABLE ind DROP COLUMN IF EXISTS last_name;
    ALTER TABLE ind DROP COLUMN IF EXISTS email;
    ALTER TABLE ind DROP COLUMN IF EXISTS phone_number;
    ALTER TABLE ind DROP COLUMN IF EXISTS created_at;
    ALTER TABLE ind DROP COLUMN IF EXISTS updated_at;

    ALTER TABLE org DROP COLUMN IF EXISTS store_name;
    ALTER TABLE org DROP COLUMN IF EXISTS seller_status;
    ALTER TABLE org DROP COLUMN IF EXISTS first_name;
    ALTER TABLE org DROP COLUMN IF EXISTS last_name;
    ALTER TABLE org DROP COLUMN IF EXISTS email;
    ALTER TABLE org DROP COLUMN IF EXISTS phone_number;
    ALTER TABLE org DROP COLUMN IF EXISTS store_address;
    ALTER TABLE org DROP COLUMN IF EXISTS bank_iban;
    ALTER TABLE org DROP COLUMN IF EXISTS logo_url;
    ALTER TABLE org DROP COLUMN IF EXISTS created_at;
    ALTER TABLE org DROP COLUMN IF EXISTS updated_at;
    """)
