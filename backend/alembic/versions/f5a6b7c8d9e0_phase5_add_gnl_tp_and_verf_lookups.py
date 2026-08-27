"""phase5_add_gnl_tp_and_verf_lookups

gnl_tp lookup tablosunu oluşturur, gnl_st'ye 3 parçalı doğrulama alanlarını ekler
ve CNTC_MEDIUM doğrulama tipleri/durumlarını seed'ler. (Kayıt/doğrulama akışı için.)

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-08-10 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

revision: str = 'f5a6b7c8d9e0'
down_revision: str | None = 'e4f5a6b7c8d9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    DO $$
    BEGIN
        -- gnl_st: 3 parçalı doğrulama lookup alanları (mevcut sipariş/ürün satırları etkilenmez)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gnl_st' AND column_name='ent_code_name') THEN
            ALTER TABLE gnl_st ADD COLUMN ent_code_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gnl_st' AND column_name='ent_name') THEN
            ALTER TABLE gnl_st ADD COLUMN ent_name VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gnl_st' AND column_name='shrt_code') THEN
            ALTER TABLE gnl_st ADD COLUMN shrt_code VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gnl_st' AND column_name='is_actv') THEN
            ALTER TABLE gnl_st ADD COLUMN is_actv BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;

        -- gnl_tp: doğrulama TİPLERİ lookup tablosu
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='gnl_tp') THEN
            CREATE TABLE gnl_tp (
                gnl_tp_id SERIAL PRIMARY KEY,
                ent_code_name VARCHAR(100) NOT NULL,
                ent_name VARCHAR(50) NOT NULL,
                shrt_code VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(255),
                is_actv BOOLEAN NOT NULL DEFAULT TRUE
            );
        END IF;
    END $$;
    """)

    # --- gnl_tp seed: doğrulama tipleri + iletişim veri tipleri (idempotent) ---
    op.execute("""
    INSERT INTO gnl_tp (ent_code_name, ent_name, shrt_code, name, description)
    SELECT v.ent_code_name, v.ent_name, v.shrt_code, v.name, v.description
    FROM (VALUES
        ('CNTC_MEDIUM_VERF_TYPE','EMAIL','OTP_CODE','Doğrulama Kodu','E-postaya gönderilen tek kullanımlık kod'),
        ('CNTC_MEDIUM_VERF_TYPE','EMAIL','LINK','Link ile Doğrulama','E-postaya gönderilen doğrulama linki'),
        ('CNTC_MEDIUM_VERF_TYPE','EMAIL','GOOGLE_AUTH','Google Authenticator','Authenticator uygulaması ile doğrulama'),
        ('CNTC_MEDIUM_VERF_TYPE','GSM','SMS_OTP','SMS Doğrulama Kodu','Telefona SMS ile gönderilen kod'),
        ('CNTC_MEDIUM_DATA_TYPE','EMAIL','EMAIL','E-posta','İletişim verisi: e-posta adresi'),
        ('CNTC_MEDIUM_DATA_TYPE','GSM','GSM','Telefon','İletişim verisi: cep telefonu')
    ) AS v(ent_code_name, ent_name, shrt_code, name, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM gnl_tp t
        WHERE t.ent_code_name = v.ent_code_name AND t.ent_name = v.ent_name AND t.shrt_code = v.shrt_code
    );
    """)

    # --- gnl_st seed: doğrulama durumları (code NOT NULL unique olduğu için code de veriliyor) ---
    op.execute("""
    INSERT INTO gnl_st (code, name, description, ent_code_name, ent_name, shrt_code)
    SELECT v.code, v.name, v.description, v.ent_code_name, v.ent_name, v.shrt_code
    FROM (VALUES
        ('CNTC_VERF_ST_EMAIL_PENDING','Doğrulama Bekleniyor','E-posta doğrulaması bekleniyor','CNTC_MEDIUM_VERF_ST','EMAIL','PENDING'),
        ('CNTC_VERF_ST_EMAIL_VERIFIED','Doğrulandı','E-posta doğrulandı','CNTC_MEDIUM_VERF_ST','EMAIL','VERIFIED'),
        ('CNTC_VERF_ST_EMAIL_FAILED','Başarısız','E-posta doğrulaması başarısız','CNTC_MEDIUM_VERF_ST','EMAIL','FAILED'),
        ('CNTC_VERF_ST_EMAIL_EXPIRED','Süresi Doldu','E-posta doğrulama süresi doldu','CNTC_MEDIUM_VERF_ST','EMAIL','EXPIRED'),
        ('CNTC_VERF_ST_GSM_PENDING','Doğrulama Bekleniyor','Telefon doğrulaması bekleniyor','CNTC_MEDIUM_VERF_ST','GSM','PENDING'),
        ('CNTC_VERF_ST_GSM_VERIFIED','Doğrulandı','Telefon doğrulandı','CNTC_MEDIUM_VERF_ST','GSM','VERIFIED'),
        ('CNTC_VERF_ST_GSM_FAILED','Başarısız','Telefon doğrulaması başarısız','CNTC_MEDIUM_VERF_ST','GSM','FAILED'),
        ('CNTC_VERF_ST_GSM_EXPIRED','Süresi Doldu','Telefon doğrulama süresi doldu','CNTC_MEDIUM_VERF_ST','GSM','EXPIRED')
    ) AS v(code, name, description, ent_code_name, ent_name, shrt_code)
    WHERE NOT EXISTS (SELECT 1 FROM gnl_st s WHERE s.code = v.code);
    """)


def downgrade() -> None:
    op.execute("DELETE FROM gnl_st WHERE ent_code_name = 'CNTC_MEDIUM_VERF_ST';")
    op.execute("DROP TABLE IF EXISTS gnl_tp;")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gnl_st' AND column_name='ent_code_name') THEN
            ALTER TABLE gnl_st DROP COLUMN ent_code_name, DROP COLUMN ent_name, DROP COLUMN shrt_code, DROP COLUMN is_actv;
        END IF;
    END $$;
    """)
