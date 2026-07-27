"""dedupe cust rows per user_id and add unique constraint

Revision ID: a3f7d92c6e14
Revises: f6a9c2e83b17
Create Date: 2026-07-27 23:30:00.000000

"""
from collections.abc import Sequence

from alembic import op


revision: str = 'a3f7d92c6e14'
down_revision: str | None = 'f6a9c2e83b17'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Bir race condition (aynı kullanıcı için POST /customers/me'nin neredeyse
    # aynı anda iki kez tetiklenmesi) sonucu bazı kullanıcılar için birden fazla
    # cust satırı oluşmuş olabilir. Her user_id için EN ESKİ cust_id'yi
    # "asıl" kabul edip, ona bağlı olması gereken tüm çocuk kayıtları o satıra
    # taşıyoruz, sonra mükerrer cust satırlarını siliyoruz (ind/org gibi CASCADE
    # olanlar otomatik gider).
    op.execute(
        """
        CREATE TEMP TABLE cust_keep AS
        SELECT user_id, MIN(cust_id) AS keep_cust_id
        FROM cust
        GROUP BY user_id
        HAVING COUNT(*) > 1
        """
    )

    op.execute(
        """
        UPDATE customer_address ca
        SET cust_id = ck.keep_cust_id
        FROM cust c
        JOIN cust_keep ck ON ck.user_id = c.user_id
        WHERE ca.cust_id = c.cust_id AND c.cust_id <> ck.keep_cust_id
        """
    )
    op.execute(
        """
        UPDATE cust_ord co
        SET cust_id = ck.keep_cust_id
        FROM cust c
        JOIN cust_keep ck ON ck.user_id = c.user_id
        WHERE co.cust_id = c.cust_id AND c.cust_id <> ck.keep_cust_id
        """
    )
    op.execute(
        """
        UPDATE bsn_inter bi
        SET cust_id = ck.keep_cust_id
        FROM cust c
        JOIN cust_keep ck ON ck.user_id = c.user_id
        WHERE bi.cust_id = c.cust_id AND c.cust_id <> ck.keep_cust_id
        """
    )
    op.execute(
        """
        UPDATE cust_prod cp
        SET cust_id = ck.keep_cust_id
        FROM cust c
        JOIN cust_keep ck ON ck.user_id = c.user_id
        WHERE cp.cust_id = c.cust_id AND c.cust_id <> ck.keep_cust_id
        """
    )

    # Mükerrer cust satırlarını sil — ind/org bunlara CASCADE bağlı olduğu için
    # otomatik gidiyor (zaten boş/anlamsız kopyalar, taşımaya gerek yok).
    op.execute(
        """
        DELETE FROM cust c
        USING cust_keep ck
        WHERE c.user_id = ck.user_id AND c.cust_id <> ck.keep_cust_id
        """
    )

    op.execute("DROP TABLE cust_keep")

    # Bundan sonra aynı user_id için ikinci bir cust satırı oluşmasını DB
    # seviyesinde tamamen imkansız hale getiriyoruz.
    op.create_unique_constraint('uq_cust_user_id', 'cust', ['user_id'])


def downgrade() -> None:
    # NOT: Silinen mükerrer satırlar geri getirilemez (veri kaybı geri
    # alınamaz) — sadece kısıtı kaldırıyoruz.
    op.drop_constraint('uq_cust_user_id', 'cust', type_='unique')
