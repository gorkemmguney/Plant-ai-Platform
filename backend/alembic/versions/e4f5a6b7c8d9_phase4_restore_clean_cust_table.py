"""phase4_restore_clean_cust_table

Revision ID: e4f5a6b7c8d9
Revises: d3c4b5a6f7e8
Create Date: 2026-08-07 09:50:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'e4f5a6b7c8d9'
down_revision: str | None = 'd3c4b5a6f7e8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN
        -- 1. Create cust table if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cust') THEN
            CREATE TABLE cust (
                cust_id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
                customer_type VARCHAR(50) NOT NULL DEFAULT 'IND',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        END IF;

        -- 2. Populate cust table for all existing app_users
        INSERT INTO cust (user_id, customer_type, is_active)
        SELECT u.user_id, 'IND', u.is_active
        FROM app_user u
        WHERE NOT EXISTS (SELECT 1 FROM cust c WHERE c.user_id = u.user_id);

        -- 3. Add cust_id column to ind if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ind' AND column_name = 'cust_id') THEN
            ALTER TABLE ind ADD COLUMN cust_id INTEGER UNIQUE REFERENCES cust(cust_id) ON DELETE CASCADE;
        END IF;

        -- 4. Add cust_id column to org if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org' AND column_name = 'cust_id') THEN
            ALTER TABLE org ADD COLUMN cust_id INTEGER UNIQUE REFERENCES cust(cust_id) ON DELETE CASCADE;
        END IF;

        -- 5. Add cust_id column to cust_ord if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_ord' AND column_name = 'cust_id') THEN
            ALTER TABLE cust_ord ADD COLUMN cust_id INTEGER REFERENCES cust(cust_id) ON DELETE CASCADE;
        END IF;

        -- 6. Add cust_id column to cust_prod if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cust_prod' AND column_name = 'cust_id') THEN
            ALTER TABLE cust_prod ADD COLUMN cust_id INTEGER REFERENCES cust(cust_id) ON DELETE CASCADE;
        END IF;

        -- 7. Add cust_id column to customer_address if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_address' AND column_name = 'cust_id') THEN
            ALTER TABLE customer_address ADD COLUMN cust_id INTEGER REFERENCES cust(cust_id) ON DELETE CASCADE;
        END IF;

        -- 8. Populate cust_id foreign keys from cust table
        UPDATE ind i SET cust_id = c.cust_id FROM cust c WHERE i.user_id = c.user_id AND i.cust_id IS NULL;
        UPDATE org o SET cust_id = c.cust_id FROM cust c WHERE o.user_id = c.user_id AND o.cust_id IS NULL;
        UPDATE cust_ord co SET cust_id = c.cust_id FROM cust c WHERE co.user_id = c.user_id AND co.cust_id IS NULL;
        UPDATE cust_prod cp SET cust_id = c.cust_id FROM cust c WHERE cp.user_id = c.user_id AND cp.cust_id IS NULL;
        UPDATE customer_address ca SET cust_id = c.cust_id FROM cust c WHERE ca.user_id = c.user_id AND ca.cust_id IS NULL;

    END $$;
    """)


def downgrade() -> None:
    pass
