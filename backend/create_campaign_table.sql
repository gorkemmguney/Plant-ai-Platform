-- Kampanya + kupon tabloları (idempotent — tekrar çalıştırılabilir)
-- Supabase Dashboard → SQL Editor'da bir kez çalıştır ("Run without RLS").

-- 1) Kampanya tablosu
CREATE TABLE IF NOT EXISTS campaign (
    campaign_id     SERIAL PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(500),
    required_points INTEGER NOT NULL,
    reward_text     VARCHAR(200),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eski tablo varsa indirim kolonunu ekle
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Örnek kampanyalar (yalnızca tablo boşsa ekler)
INSERT INTO campaign (title, description, required_points, reward_text, discount_amount)
SELECT * FROM (VALUES
    ('₺25 İndirim Kuponu',  'Sepette 25 TL indirim.',  100, '₺25 indirim',  25.00),
    ('₺50 İndirim Kuponu',  'Sepette 50 TL indirim.',  250, '₺50 indirim',  50.00),
    ('₺75 İndirim Kuponu',  'Sepette 75 TL indirim.',  350, '₺75 indirim',  75.00),
    ('₺100 İndirim Kuponu', 'Sepette 100 TL indirim.', 450, '₺100 indirim', 100.00)
) AS v(title, description, required_points, reward_text, discount_amount)
WHERE NOT EXISTS (SELECT 1 FROM campaign);

-- Eski seed'de discount 0 kaldıysa puan eşiğine göre doldur
UPDATE campaign SET discount_amount = 25  WHERE discount_amount = 0 AND required_points = 100;
UPDATE campaign SET discount_amount = 50  WHERE discount_amount = 0 AND required_points = 250;
UPDATE campaign SET discount_amount = 100 WHERE discount_amount = 0 AND required_points = 450;
UPDATE campaign SET discount_amount = 30  WHERE discount_amount = 0 AND required_points = 150;

-- 2) Kullanıcı kuponları (kampanya kullanınca oluşur, sepette harcanır)
CREATE TABLE IF NOT EXISTS user_coupon (
    coupon_id       SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES app_user(user_id),
    code            VARCHAR(30) NOT NULL,
    discount_amount NUMERIC(10,2) NOT NULL,
    is_used         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
