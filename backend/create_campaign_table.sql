-- Kampanya + kupon tabloları (mağaza bazlı, tek seferlik)
-- Supabase Dashboard → SQL Editor'da bir kez çalıştır ("Run without RLS").

-- 1) Kampanya tablosu (her kampanya bir mağazaya ait)
CREATE TABLE IF NOT EXISTS campaign (
    campaign_id     SERIAL PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(500),
    required_points INTEGER NOT NULL,
    reward_text     VARCHAR(200),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    seller_id       INTEGER REFERENCES app_user(user_id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eski tablo varsa yeni kolonları ekle
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES app_user(user_id);

-- 2) Kullanıcı kuponları (kampanya kullanınca oluşur; belirli bir mağazada geçerli)
CREATE TABLE IF NOT EXISTS user_coupon (
    coupon_id       SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES app_user(user_id),
    campaign_id     INTEGER REFERENCES campaign(campaign_id),
    seller_id       INTEGER REFERENCES app_user(user_id),
    code            VARCHAR(30) NOT NULL,
    discount_amount NUMERIC(10,2) NOT NULL,
    is_used         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_coupon ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaign(campaign_id);
ALTER TABLE user_coupon ADD COLUMN IF NOT EXISTS seller_id   INTEGER REFERENCES app_user(user_id);

-- 3) Her mağazaya farklı kampanyalar (açıklamada gerçek mağaza adı; yalnızca hiç kampanya yoksa ekler)
INSERT INTO campaign (title, description, required_points, reward_text, discount_amount, seller_id)
SELECT '₺' || v.d || ' İndirim',
       COALESCE(u.store_name, u.first_name) || ' mağazasında ' || v.d || ' TL indirim.',
       v.p, '₺' || v.d || ' indirim', v.d, v.sid
FROM (VALUES
    (16, 20, 80),  (16, 60, 300),
    (17, 15, 60),  (17, 40, 200),
    (18, 30, 120), (18, 75, 350),
    (19, 25, 100), (19, 50, 250),
    (20, 35, 140), (20, 100, 450)
) AS v(sid, d, p)
JOIN app_user u ON u.user_id = v.sid
WHERE NOT EXISTS (SELECT 1 FROM campaign);
