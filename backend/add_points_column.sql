-- Oyunlaştırma puanı: app_user'a puan alanı
-- Supabase Dashboard → SQL Editor'da bir kez çalıştır ("Run without RLS" gerekmez, kolon ekliyor).

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
