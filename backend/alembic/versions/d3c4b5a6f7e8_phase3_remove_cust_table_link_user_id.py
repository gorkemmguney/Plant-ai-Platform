"""phase3_remove_cust_table_link_user_id

Revision ID: d3c4b5a6f7e8
Revises: c2b3a4d5e6f7
Create Date: 2026-08-07 01:50:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd3c4b5a6f7e8'
down_revision: str | None = 'c2b3a4d5e6f7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN
        -- 1. Ensure user_id column exists in ind, org, cust_ord, cust_prod, customer_address
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'user_id') THEN
            ALTER TABLE ind ADD COLUMN user_id INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'user_id') THEN
            ALTER TABLE org ADD COLUMN user_id INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_ord' AND column_name = 'user_id') THEN
            ALTER TABLE cust_ord ADD COLUMN user_id INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_prod' AND column_name = 'user_id') THEN
            ALTER TABLE cust_prod ADD COLUMN user_id INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_address' AND column_name = 'user_id') THEN
            ALTER TABLE customer_address ADD COLUMN user_id INTEGER;
        END IF;

        -- 2. Populate user_id from cust table if cust_id exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cust') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'cust_id') THEN
                UPDATE ind i SET user_id = c.user_id FROM cust c WHERE i.cust_id = c.cust_id AND i.user_id IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'cust_id') THEN
                UPDATE org o SET user_id = c.user_id FROM cust c WHERE o.cust_id = c.cust_id AND o.user_id IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_ord' AND column_name = 'cust_id') THEN
                UPDATE cust_ord co SET user_id = c.user_id FROM cust c WHERE co.cust_id = c.cust_id AND co.user_id IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_prod' AND column_name = 'cust_id') THEN
                UPDATE cust_prod cp SET user_id = c.user_id FROM cust c WHERE cp.cust_id = c.cust_id AND cp.user_id IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_address' AND column_name = 'cust_id') THEN
                UPDATE customer_address ca SET user_id = c.user_id FROM cust c WHERE ca.cust_id = c.cust_id AND ca.user_id IS NULL;
            END IF;
        END IF;

        -- Copy app_user data to ind/org before dropping app_user columns
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_user' AND column_name = 'first_name') THEN
            UPDATE ind i
            SET first_name = COALESCE(i.first_name, u.first_name),
                last_name = COALESCE(i.last_name, u.last_name),
                email = COALESCE(i.email, u.email)
            FROM app_user u
            WHERE i.user_id = u.user_id;

            UPDATE org o
            SET store_name = COALESCE(o.store_name, u.store_name),
                seller_status = COALESCE(o.seller_status, u.seller_status, 'none')
            FROM app_user u
            WHERE o.user_id = u.user_id;
        END IF;

        -- Drop foreign key constraints on cust_id
        ALTER TABLE ind DROP CONSTRAINT IF EXISTS ind_cust_id_fkey;
        ALTER TABLE org DROP CONSTRAINT IF EXISTS org_cust_id_fkey;
        ALTER TABLE cust_ord DROP CONSTRAINT IF EXISTS cust_ord_cust_id_fkey;
        ALTER TABLE cust_prod DROP CONSTRAINT IF EXISTS cust_prod_cust_id_fkey;
        ALTER TABLE customer_address DROP CONSTRAINT IF EXISTS customer_address_cust_id_fkey;

        -- Drop cust_id columns
        ALTER TABLE ind DROP COLUMN IF EXISTS cust_id;
        ALTER TABLE org DROP COLUMN IF EXISTS cust_id;
        ALTER TABLE cust_ord DROP COLUMN IF EXISTS cust_id;
        ALTER TABLE cust_prod DROP COLUMN IF EXISTS cust_id;
        ALTER TABLE customer_address DROP COLUMN IF EXISTS cust_id;

        -- Drop cust table
        DROP TABLE IF EXISTS cust CASCADE;

        -- Drop old deprecated columns from app_user
        ALTER TABLE app_user DROP COLUMN IF EXISTS first_name;
        ALTER TABLE app_user DROP COLUMN IF EXISTS last_name;
        ALTER TABLE app_user DROP COLUMN IF EXISTS email;
        ALTER TABLE app_user DROP COLUMN IF EXISTS password_hash;
        ALTER TABLE app_user DROP COLUMN IF EXISTS seller_status;
        ALTER TABLE app_user DROP COLUMN IF EXISTS store_name;
    END $$;
    """)


def downgrade() -> None:
    pass
