-- Ürün kategorisi (çiçek/malzeme) + hazır paketler
-- Supabase Dashboard → SQL Editor'da bir kez çalıştır ("Run without RLS").

-- 1) Ürünlere kategori: 'plant' (çiçek/bitki) | 'supply' (malzeme)
ALTER TABLE prod ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'plant';

-- 2) Malzemeler için ürün tipi
INSERT INTO prod_spec (prod_spec_id, name) VALUES (7, 'Bitki Malzemeleri')
ON CONFLICT (prod_spec_id) DO NOTHING;

-- 3) Örnek malzeme ürünleri (yoksa ekle)
INSERT INTO prod (name, description, price, stock, gnl_st_id, seller_id, prod_spec_id, category, is_active)
SELECT v.name, v.descr, v.price, v.stock, 1, v.seller_id, 7, 'supply', true
FROM (VALUES
    ('Seramik Saksı (Orta Boy)', 'Dekoratif orta boy seramik saksı.', 120, 30, 20),
    ('Saksı Toprağı 5L', 'İç mekan bitkileri için hazır toprak.', 75, 40, 20),
    ('Bitki Gübresi', 'Sıvı bitki besini, tüm bitkiler için.', 60, 50, 16),
    ('Saksı Altlığı', 'Su toplayan şeffaf saksı altlığı.', 35, 45, 20)
) AS v(name, descr, price, stock, seller_id)
WHERE NOT EXISTS (SELECT 1 FROM prod p WHERE p.name = v.name);

-- 4) Paket tabloları
CREATE TABLE IF NOT EXISTS bundle (
    bundle_id   SERIAL PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_item (
    bundle_item_id SERIAL PRIMARY KEY,
    bundle_id      INTEGER NOT NULL REFERENCES bundle(bundle_id),
    prod_id        INTEGER NOT NULL REFERENCES prod(prod_id),
    quantity       INTEGER NOT NULL DEFAULT 1
);

-- 5) Paketleri seed'le (yalnızca hiç paket yoksa). Ürünler ada göre eşlenir.
INSERT INTO bundle (title, description)
SELECT * FROM (VALUES
    ('Bakımı Kolay Başlangıç Seti', 'Yeni başlayanlar için dayanıklı üç bitki.'),
    ('Renkli Çiçek Seti', 'Eviniz için canlı renkli çiçekler.'),
    ('Orkide Bakım Seti', 'Orkide + saksı + gübre, bakıma hazır paket.'),
    ('Sukulent Başlangıç Seti', 'Sukulent + toprak + altlık; ekmeye hazır.')
) AS v(title, description)
WHERE NOT EXISTS (SELECT 1 FROM bundle);

-- Paket içerikleri (ürün adına göre; yalnızca ilgili paketin içi boşsa ekler)
INSERT INTO bundle_item (bundle_id, prod_id, quantity)
SELECT b.bundle_id, p.prod_id, 1
FROM bundle b
JOIN (VALUES
    ('Bakımı Kolay Başlangıç Seti', 'Zamioculcas'),
    ('Bakımı Kolay Başlangıç Seti', 'Haworthia'),
    ('Bakımı Kolay Başlangıç Seti', 'Echeveria'),
    ('Renkli Çiçek Seti', 'Gerbera'),
    ('Renkli Çiçek Seti', 'Lavanta'),
    ('Renkli Çiçek Seti', 'Gül Fidanı'),
    ('Orkide Bakım Seti', 'Orkide'),
    ('Orkide Bakım Seti', 'Seramik Saksı (Orta Boy)'),
    ('Orkide Bakım Seti', 'Bitki Gübresi'),
    ('Sukulent Başlangıç Seti', 'Sukulent Karışık Saksı'),
    ('Sukulent Başlangıç Seti', 'Saksı Toprağı 5L'),
    ('Sukulent Başlangıç Seti', 'Saksı Altlığı')
) AS m(bundle_title, prod_name) ON m.bundle_title = b.title
JOIN prod p ON p.name = m.prod_name
WHERE NOT EXISTS (SELECT 1 FROM bundle_item bi WHERE bi.bundle_id = b.bundle_id);
