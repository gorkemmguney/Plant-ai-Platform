-- Plant AI Platform — başlangıç (seed) verisi
-- DBeaver'da `alembic upgrade head` çalıştıktan SONRA bir kez çalıştır.
-- Tekrar çalıştırılabilir (idempotent): var olan satırları atlar.

-- 1) Roller (login sonrası rol atanabilmesi için ŞART)
INSERT INTO role (role_name, description, is_active)
VALUES
  ('admin',    'Yönetici',  true),
  ('seller',   'Satıcı',    true),
  ('customer', 'Müşteri',   true)
ON CONFLICT (role_name) DO NOTHING;

-- 2) Genel durumlar (gnl_st) — sabit id'ler koda gömülü olduğu için açıkça veriyoruz
--    id 1  -> ürün "aktif" durumu (ProductCreateIn.gnl_st_id varsayılanı)
--    id 5-9 -> sipariş durumları (order_service.py ile birebir)
INSERT INTO gnl_st (gnl_st_id, code, name, description)
VALUES
  (1, 'PROD_ACTIVE',   'Aktif',        'Satışta olan ürün'),
  (5, 'ORD_RECEIVED',  'Alındı',       'Sipariş alındı'),
  (6, 'ORD_PREPARING', 'Hazırlanıyor', 'Sipariş hazırlanıyor'),
  (7, 'ORD_SHIPPED',   'Kargoda',      'Sipariş kargoya verildi'),
  (8, 'ORD_DELIVERED', 'Teslim',       'Sipariş teslim edildi'),
  (9, 'ORD_CANCELLED', 'İptal',        'Sipariş iptal edildi')
ON CONFLICT (gnl_st_id) DO NOTHING;

-- gnl_st sequence'ini elle verdiğimiz id'lerin üstüne çek (sonraki otomatik id'ler çakışmasın)
SELECT setval(pg_get_serial_sequence('gnl_st', 'gnl_st_id'), (SELECT MAX(gnl_st_id) FROM gnl_st));

-- 3) En az bir satış kanalı (sipariş oluşturmak için gerekli: OrderCreateIn.sale_cnl_id)
INSERT INTO sale_cnl (name, description)
SELECT 'Mobil Uygulama', 'Mobil uygulama üzerinden satış'
WHERE NOT EXISTS (SELECT 1 FROM sale_cnl);
