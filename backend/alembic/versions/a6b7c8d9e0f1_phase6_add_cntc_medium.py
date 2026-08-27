"""phase6_add_cntc_medium

Kullanıcının iletişim kanallarını (email/telefon) doğrulama alanlarıyla tutan
cntc_medium tablosunu oluşturur. gnl_tp/gnl_st lookup'larına bağlıdır (phase5).

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-08-10 10:30:00.000000

"""
from collections.abc import Sequence

from alembic import op

revision: str = 'a6b7c8d9e0f1'
down_revision: str | None = 'f5a6b7c8d9e0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cntc_medium') THEN
            CREATE TABLE cntc_medium (
                cntc_medium_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
                data_tp_id INTEGER NOT NULL REFERENCES gnl_tp(gnl_tp_id),
                cntc_data VARCHAR(255) NOT NULL,
                st_id INTEGER REFERENCES gnl_st(gnl_st_id),
                verf_tp_id INTEGER REFERENCES gnl_tp(gnl_tp_id),
                verf_st_id INTEGER REFERENCES gnl_st(gnl_st_id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX ix_cntc_medium_user_id ON cntc_medium(user_id);
        END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cntc_medium;")
