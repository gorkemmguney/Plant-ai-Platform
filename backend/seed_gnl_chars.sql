-- ============================================================
-- gnl_char: Karakteristik TİPLERİ (admin tarafından yönetilir)
-- ============================================================
INSERT INTO gnl_char (name, description) VALUES
  ('Renk', 'Bitkinin yaprak veya çiçek rengi'),
  ('Saksı Boyutu', 'Bitkinin geldiği saksının çapı'),
  ('Işık İhtiyacı', 'Bitkinin ihtiyaç duyduğu gün ışığı miktarı'),
  ('Sulama Sıklığı', 'Önerilen sulama aralığı'),
  ('Bitki Tipi', 'Bitkinin yetiştirilmesi gereken ortam'),
  ('Bakım Zorluğu', 'Bitkinin bakım gerektirme seviyesi'),
  ('Evcil Hayvan Güvenliği', 'Bitkinin evcil hayvanlar için toksisitesi');

-- ============================================================
-- gnl_char_val: Her karakteristiğin olası DEĞERLERİ
-- (subquery ile gnl_char_id otomatik bulunuyor, ID hardcode edilmiyor)
-- ============================================================

-- Renk
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Yeşil','Kırmızı Çiçekli','Sarı Çiçekli','Mor Çiçekli','Alacalı (Variegated)','Beyaz Çiçekli']) AS v
WHERE name = 'Renk';

-- Saksı Boyutu
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Mini (8-10 cm)','Orta (12-17 cm)','Büyük (19-25 cm)','Saksısız (Çıplak Kök)']) AS v
WHERE name = 'Saksı Boyutu';

-- Işık İhtiyacı
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Tam Güneş','Yarı Gölge','Gölge','Yapay Işıkla Uyumlu']) AS v
WHERE name = 'Işık İhtiyacı';

-- Sulama Sıklığı
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Haftada 1 Kez','Haftada 2-3 Kez','Ayda 1-2 Kez','Toprak Kuruyunca']) AS v
WHERE name = 'Sulama Sıklığı';

-- Bitki Tipi
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['İç Mekan','Dış Mekan','İç/Dış Mekan Uyumlu']) AS v
WHERE name = 'Bitki Tipi';

-- Bakım Zorluğu
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Kolay','Orta','Zor']) AS v
WHERE name = 'Bakım Zorluğu';

-- Evcil Hayvan Güvenliği
INSERT INTO gnl_char_val (gnl_char_id, value)
SELECT gnl_char_id, v FROM gnl_char,
  UNNEST(ARRAY['Evcil Dostu','Evcil Hayvanlar İçin Toksik']) AS v
WHERE name = 'Evcil Hayvan Güvenliği';
