"""phase7_add_srvc_log

Revision ID: 6e00f4c6eb1a
Revises: a6b7c8d9e0f1
Create Date: 2026-08-13 11:21:39.961542

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '6e00f4c6eb1a'
down_revision: str | None = 'a6b7c8d9e0f1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srvc_log') THEN
            CREATE TABLE srvc_log (
                srvc_log_id SERIAL PRIMARY KEY,
                srvc_name VARCHAR(50) NOT NULL,
                srvc_code VARCHAR(50) NOT NULL,
                user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE,
                cntc_medium_id INTEGER REFERENCES cntc_medium(cntc_medium_id) ON DELETE CASCADE,
                pl_in TEXT,
                pl_out TEXT,
                srvc_msg VARCHAR(255),
                http_status INTEGER,
                cost NUMERIC(10, 4),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        END IF;
    END $$;
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS srvc_log;")
