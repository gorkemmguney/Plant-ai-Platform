-- Değerlendirme (yorum + puan) tablosu
-- Supabase Dashboard → SQL Editor'da bir kez çalıştır.

CREATE TABLE IF NOT EXISTS review (
    review_id     SERIAL PRIMARY KEY,
    prod_id       INTEGER NOT NULL REFERENCES prod(prod_id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       VARCHAR(1000),
    seller_reply  VARCHAR(1000),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Bir kullanıcı aynı ürüne tek yorum yazabilir (tekrar yazınca güncellenir)
    CONSTRAINT uq_review_user_prod UNIQUE (user_id, prod_id)
);
